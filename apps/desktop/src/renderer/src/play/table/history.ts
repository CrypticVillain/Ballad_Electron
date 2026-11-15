import { tabletopDefaults } from '@/lib/sections';
import type { Collection } from '@/lib/model';
import { observeChanges, useVault, type Observed } from '@/stores/vault';
import { stamp } from '../common';
import type { Speaker } from './actions';
import { describeEvent, type DescribeContext } from './describe';
import type { EventChange, GameEvent } from './model';
import { diff, merge, redoable, undoable } from './events';
import { rulesOf } from './rules';

/**
 * Play → the game's history: everything done in Play's window, kept as the
 * game log (GameEvent, shared with the table), each with what it changed,
 * record by record, so the GM can undo it and redo it.
 *
 *   startHistory()   records this window's changes: those made together (a
 *                    click: a card and the hit points it took) as one event;
 *                    one record edited again and again (typing a name) as one
 *   undo()           the GM: the last thing done, undone; the board freezes
 *                    (no one moves anything) until Save or Redo back to now
 *   redo()           the GM: what was undone, done again, as long as nothing
 *                    new has happened since (then it can't be: it's gone)
 *   saveRewind()     the GM: keeps the board as it was rewound to; unfreezes
 *
 * Who sees an event, and which Undo and Redo take: play/table/events.
 */

const store = () => useVault.getState();

/** What the game log records: the table's own things (not the Library, the Scratchpad, music tracks). */
const GAME: Collection[] = ['tokens', 'pcs', 'playScenes', 'worlds', 'templates', 'marks', 'handouts', 'tableLog'];

/** How long a burst of changes counts as one thing done (a click's changes land within a few milliseconds). */
const GROUP_MS = 150;
/** The same record edited again within this long (typing): the same event. */
const SAME_MS = 2500;
/** How many events a campaign keeps (the oldest go). */
const KEEP = 400;

type Rec = Record<string, unknown> & { worldId?: string | null; kind?: string };

let speaker: Speaker | null = null;
let suppressed = 0;
let pending: Observed[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
/** The event recorded last, to fold a repeat edit into: its id, which fields of which records, when, and its changes in full. */
let last: { id: string; key: string; at: number; changes: Observed[] } | null = null;

/** Whether a change is the game's: this campaign's, one of the table's things, not a ping or the board freezing. */
function inGame(c: Observed, worldId: string): boolean {
  if (!GAME.includes(c.collection)) return false;
  const r = (c.after ?? c.before) as Rec | null;
  if (!r) return false;
  if (c.collection === 'worlds') return (r as { id: string }).id === worldId;
  if (r.worldId !== worldId) return false;
  if (c.collection === 'tableLog' && (r.kind === 'ping' || r.kind === 'chat' || r.kind === 'emote' || r.kind === 'system')) return false;
  return true;
}

/** What the log's words need: names, the scene the table sees, the table's settings. */
function contextFor(worldId: string): DescribeContext {
  const v = store().vault;
  const tokenName = (t: Record<string, unknown>) => {
    const pc = t.kind === 'pc' && typeof t.refId === 'string' ? v.pcs[t.refId] : undefined;
    return (pc?.name || (t.name as string)) || 'A token';
  };
  return {
    worldId,
    liveSceneId: v.worlds[worldId]?.tabletop?.live?.sceneId ?? null,
    rules: rulesOf(worldId),
    tokenName,
    tokenNameById: (id) => (v.tokens[id] ? tokenName(v.tokens[id] as unknown as Record<string, unknown>) : 'Someone'),
    sceneName: (id) => v.playScenes[id]?.name || 'Untitled Scene',
    trackName: (id) => v.music[id]?.name || 'a track',
  };
}

/** Writes the game log without that being recorded (or sent back here) as something done. */
function quietly(fn: () => void) {
  suppressed++;
  try {
    fn();
  } finally {
    suppressed--;
  }
}

function flush() {
  timer = null;
  const s = speaker;
  const changes = merge(pending);
  pending = [];
  if (!s || !changes.length) return;
  const key = changes.map((c) => `${c.collection}:${c.id}:${diff(c).after ? Object.keys(diff(c).after!).sort().join(',') : '-'}`).join('|');
  const at = Date.now();
  // The same fields of the same records again, just now (typing a name): the event before, carried on.
  if (last && last.key === key && at - last.at < SAME_MS && store().vault.gameLog[last.id] && !store().vault.gameLog[last.id]!.undone) {
    const all = merge([...last.changes, ...changes]);
    last = { ...last, at, changes: all };
    const words = describeEvent(all, contextFor(s.worldId));
    quietly(() => store().patch('gameLog', last!.id, { ...words, changes: all.map(diff) }));
    return;
  }
  const words = describeEvent(changes, contextFor(s.worldId));
  const event: GameEvent = { ...stamp(), worldId: s.worldId, accountId: s.accountId, who: s.who, ...words, changes: changes.map(diff) };
  last = { id: event.id, key, at, changes };
  quietly(() => {
    store().put('gameLog', event);
    // Only so many kept: the oldest go.
    const all = eventsOf(s.worldId);
    for (const old of all.slice(0, Math.max(0, all.length - KEEP))) store().purge('gameLog', old.id);
  });
}

/** Records what this window does at the table, as `who`. Returns the stop. */
export function startHistory(who: Speaker): () => void {
  speaker = who;
  observeChanges((c) => {
    if (suppressed || !speaker || !inGame(c, speaker.worldId)) return;
    pending.push(c);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, GROUP_MS);
  });
  return () => {
    if (timer) flush();
    observeChanges(null);
    speaker = null;
  };
}

/** Who's doing things here now (the speaker's name changes as characters do). */
export const setHistorySpeaker = (who: Speaker) => {
  speaker = who;
};

/** A campaign's events, oldest first. */
export function eventsOf(worldId: string, log = store().vault.gameLog): GameEvent[] {
  return Object.values(log)
    .filter((e) => !e.deletedAt && e.worldId === worldId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Puts one side of an event's changes back (before: undo; after: redo). */
function put(change: EventChange, side: 'before' | 'after') {
  const values = change[side];
  const other = change[side === 'before' ? 'after' : 'before'];
  const now = store().vault[change.collection][change.id];
  if (values === null) {
    if (now) store().purge(change.collection, change.id);
    return;
  }
  // The whole record (it came or went): put back as it was.
  if (other === null) return store().put(change.collection, values as never);
  if (now) store().patch(change.collection, change.id, values as never);
}

/** Freezes the board (an undo) or lets it go (Save, or redone back to now). */
function freeze(worldId: string, on: boolean) {
  const world = store().vault.worlds[worldId];
  if (!world || Boolean(world.tabletop?.frozen) === on) return;
  store().patch('worlds', worldId, { tabletop: { ...tabletopDefaults(), ...world.tabletop, frozen: on ? { at: new Date().toISOString() } : null } });
}

/** The GM: undoes the last thing done, and freezes the board. */
export function undo(worldId: string): GameEvent | undefined {
  if (timer) flush();
  const event = undoable(eventsOf(worldId));
  if (!event) return undefined;
  quietly(() => {
    for (const c of [...event.changes].reverse()) put(c, 'before');
    store().patch('gameLog', event.id, { undone: true });
    freeze(worldId, true);
  });
  last = null;
  return event;
}

/** The GM: does again what was undone (if nothing new happened since); back at now, the board unfreezes. */
export function redo(worldId: string): GameEvent | undefined {
  if (timer) flush();
  const event = redoable(eventsOf(worldId));
  if (!event) return undefined;
  quietly(() => {
    for (const c of event.changes) put(c, 'after');
    store().patch('gameLog', event.id, { undone: false });
    if (!redoable(eventsOf(worldId))) freeze(worldId, false);
  });
  return event;
}

/** The GM: keeps the board as it was rewound to, and unfreezes it (what's undone can still be redone, till something new happens). */
export const saveRewind = (worldId: string) => quietly(() => freeze(worldId, false));

/** The GM shows the players an event that was the GM's alone (or hides it again). */
export const showEvent = (event: GameEvent, shown: boolean) => quietly(() => store().patch('gameLog', event.id, { shown }));

/** Whether the board's frozen: the GM undid something, and hasn't saved or redone back to now. */
export const useFrozen = (worldId: string) => useVault((s) => Boolean(s.vault.worlds[worldId]?.tabletop?.frozen));

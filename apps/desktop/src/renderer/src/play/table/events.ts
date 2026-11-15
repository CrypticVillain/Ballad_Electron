import type { Observed } from '@/stores/vault';
import type { EventChange, GameEvent } from './model';

/**
 * Play → the game log's rules (pure, with tests beside it; play/table/history
 * keeps the log): what a change records, which event Undo and Redo take,
 * and who sees an event and in which words.
 */

/** A change's fields, before and after: only those that changed (the whole record when it came or went). */
export function diff(c: Observed): EventChange {
  const b = c.before as Record<string, unknown> | null;
  const a = c.after as Record<string, unknown> | null;
  if (!b || !a) return { collection: c.collection, id: c.id, before: b, after: a };
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => k !== 'updatedAt' && JSON.stringify(b[k] ?? null) !== JSON.stringify(a[k] ?? null));
  const pick = (r: Record<string, unknown>) => Object.fromEntries(keys.map((k) => [k, r[k] ?? null]));
  return { collection: c.collection, id: c.id, before: pick(b), after: pick(a) };
}

/** Changes to the same record folded together: its first before, its last after. */
export function merge(changes: Observed[]): Observed[] {
  const out = new Map<string, Observed>();
  for (const c of changes) {
    const key = `${c.collection}:${c.id}`;
    const seen = out.get(key);
    out.set(key, seen ? { ...seen, after: c.after } : c);
  }
  return [...out.values()];
}

/** What Undo would undo: the last event not undone. */
export const undoable = (events: GameEvent[]) => [...events].reverse().find((e) => !e.undone && e.changes.length);

/** What Redo would redo: the first of the undone events at the end (none once something new happened after them). */
export function redoable(events: GameEvent[]): GameEvent | undefined {
  let i = events.length;
  while (i > 0 && events[i - 1]!.undone) i--;
  return events[i];
}

/** Whether this viewer sees an event: the GM everything; a player their own, and what's for the players (or the GM showed them). */
export function seesEvent(e: GameEvent, accountId: string, gm: boolean): boolean {
  if (gm || e.accountId === accountId) return true;
  if (e.to) return e.to.includes(accountId);
  return e.playerText !== null || Boolean(e.shown);
}

/** An event's words for this viewer: the GM's (or shown by the GM), else the players' (one's own of what's the GM's alone: the GM's). */
export const eventText = (e: GameEvent, gm: boolean) => (gm || e.shown || e.playerText == null ? e.text : e.playerText);

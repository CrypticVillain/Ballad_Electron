import type { Observed } from '@/stores/vault';
import type { RollCard } from '../sheet/rolls';
import { activeToken } from './logic';
import type { TableEntry, TurnOrder } from './model';
import type { TableRules } from './rules';

/**
 * Play → the game log's words (pure, with tests beside it): what a change
 * made at the table says, as the GM reads it (everything) and as the
 * players do: a creature's hit points only when Table Settings shows them,
 * nothing of what's hidden (a hidden token, a scene the table can't see,
 * fog and walls, a roll for the GM only).
 */

type Rec = Record<string, unknown> & { id: string; worldId?: string; deletedAt?: string | null };
type Hp = { current: number; max: number; temp: number } | null;

/** What the log needs to know besides the change: names, the scene the table sees, the table's settings. */
export type DescribeContext = {
  worldId: string;
  /** The scene the players see (started or shown), or null. */
  liveSceneId: string | null;
  rules: TableRules;
  /** A token's name (a party member's: their sheet's). */
  tokenName: (token: Rec) => string;
  /** A token's name by id (the turn order's). */
  tokenNameById: (id: string) => string;
  sceneName: (id: string) => string;
  trackName: (id: string) => string;
};

/** A change's words: for the GM, for the players (none: the GM's alone), and (a whisper) whom it's for. */
export type Described = { gm: string[]; players: string[]; to?: string[] };

const sentence = (subject: string, phrases: string[]) => (phrases.length ? `${subject} ${phrases.join(', ')}.` : '');
const changedKeys = (b: Rec | null, a: Rec | null) => [...new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})])].filter((k) => k !== 'updatedAt' && JSON.stringify(b?.[k] ?? null) !== JSON.stringify(a?.[k] ?? null));
const ord = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
const gone = (r: Rec | null) => !r || Boolean(r.deletedAt);

/** Hit points changing: damage or healing, with the numbers (the GM's, and the players' when they may see them). */
function hpPhrases(b: Hp, a: Hp, numbers: boolean): { gm: string[]; players: string[] } {
  if (!b || !a) return { gm: [a ? 'has hit points tracked' : 'has hit points no longer tracked'], players: [] };
  const was = b.current + b.temp;
  const now = a.current + a.temp;
  if (now < was) {
    const gm = `takes ${was - now} damage (${b.current} → ${a.current} HP)${a.current <= 0 && b.current > 0 ? ' and drops to 0' : ''}`;
    return { gm: [gm], players: [numbers ? gm : 'is hurt'] };
  }
  if (now > was) {
    const gm = `heals ${now - was} (${b.current} → ${a.current} HP)`;
    return { gm: [gm], players: [numbers ? gm : 'is healed'] };
  }
  return { gm: [`has ${a.current} of ${a.max} HP`], players: numbers ? [`has ${a.current} of ${a.max} HP`] : [] };
}

function conditionPhrases(b: unknown, a: unknown): string[] {
  const before = (b as string[] | undefined) ?? [];
  const after = (a as string[] | undefined) ?? [];
  return [...after.filter((c) => !before.includes(c)).map((c) => `is ${c}`), ...before.filter((c) => !after.includes(c)).map((c) => `is no longer ${c}`)];
}

function concentrationPhrase(b: unknown, a: unknown): string {
  return a ? `concentrates on ${a as string}` : `stops concentrating on ${b as string}`;
}

function token(b: Rec | null, a: Rec | null, ctx: DescribeContext): Described {
  const t = (a ?? b)!;
  const name = ctx.tokenName(t);
  // The players see it if it's on the scene they see, not hidden (before and after: one that appears, they see appear).
  const onTable = t.sceneId === ctx.liveSceneId;
  const secret = !onTable || (Boolean(a?.hidden) && Boolean(b?.hidden ?? true));
  if (!b || (gone(b) && !gone(a))) {
    const s = `${name} ${b ? 'is back on the board' : 'is put on the board'}.`;
    return { gm: [s], players: secret || a?.hidden ? [] : [s] };
  }
  if (gone(a)) {
    const s = `${name} is taken off the board.`;
    return { gm: [s], players: secret || b.hidden ? [] : [s] };
  }
  const gm: string[] = [];
  const players: string[] = [];
  const both = (s: string) => (gm.push(s), players.push(s));
  const numbers = t.kind === 'pc' || ctx.rules.creatureHpBars;
  for (const key of changedKeys(b, a)) {
    if (key === 'x' || key === 'y') {
      if (!gm.includes('moves')) both('moves');
    } else if (key === 'hp') {
      const p = hpPhrases(b.hp as Hp, a!.hp as Hp, numbers);
      gm.push(...p.gm);
      players.push(...p.players);
    } else if (key === 'conditions') conditionPhrases(b.conditions, a!.conditions).forEach(both);
    else if (key === 'concentrating') both(concentrationPhrase(b.concentrating, a!.concentrating));
    else if (key === 'fate') both(a!.fate === 'dead' ? 'is dead' : a!.fate === 'downed' ? 'is down' : b.fate === 'dead' ? 'isn’t dead after all' : 'is up again');
    else if (key === 'hidden') {
      if (a!.hidden) gm.push('is hidden from the players');
      else both('appears');
    } else if (key === 'ac') gm.push(`has AC ${(a!.ac as number | null) ?? '–'}`);
    else if (key === 'name') both(`is renamed ${a!.name as string}`);
    else if (key === 'order') continue;
    else if (!gm.includes('has its token changed')) gm.push('has its token changed');
  }
  const appeared = b.hidden && !a!.hidden;
  return { gm: [sentence(name, gm)].filter(Boolean), players: !onTable || (secret && !appeared) ? [] : [sentence(name, players)].filter(Boolean) };
}

const SHEET_PARTS: Record<string, string> = { inventory: 'items', traits: 'features', attacks: 'attacks', spells: 'spells', xp: 'XP', inspiration: 'inspiration', coins: 'coins', notes: 'notes', level: 'level' };

function sheet(b: Rec | null, a: Rec | null): Described {
  const pc = (a ?? b)!;
  const name = (pc.name as string) || 'A character';
  if (!b) return { gm: [`${name} joins the party.`], players: [`${name} joins the party.`] };
  if (gone(a)) return { gm: [`${name} leaves the party.`], players: [`${name} leaves the party.`] };
  const phrases: string[] = [];
  const other = new Set<string>();
  for (const key of changedKeys(b, a)) {
    if (key === 'hp') phrases.push(...hpPhrases(b.hp as Hp, a!.hp as Hp, true).gm);
    else if (key === 'slots') {
      const used = (s: unknown) => ((s as [number, number][]) ?? []).map((x) => x[1]);
      const was = used(b.slots);
      const now = used(a!.slots);
      const spent = now.findIndex((n, i) => n > (was[i] ?? 0));
      if (spent >= 0) phrases.push(`spends a ${ord(spent + 1)}-level slot`);
      else phrases.push('gets spell slots back');
    } else if (key === 'conditions') phrases.push(...conditionPhrases(b.conditions, a!.conditions));
    else if (key === 'concentrating') phrases.push(concentrationPhrase(b.concentrating, a!.concentrating));
    else if (key === 'deathSaves') {
      const s = a!.deathSaves as { successes: number; failures: number };
      phrases.push(`has ${s.successes} death save ${s.successes === 1 ? 'success' : 'successes'} and ${s.failures} ${s.failures === 1 ? 'failure' : 'failures'}`);
    } else if (key === 'worldId' || key === 'mine' || key === 'ownerAccountId') continue;
    else other.add(SHEET_PARTS[key] ?? 'sheet');
  }
  if (other.size) phrases.push(`has ${[...other].join(' and ')} changed`);
  const s = sentence(name, phrases);
  return { gm: s ? [s] : [], players: s ? [s] : [] };
}

function scene(b: Rec | null, a: Rec | null, ctx: DescribeContext): Described {
  const s = (a ?? b)!;
  const name = (s.name as string) || 'Untitled Scene';
  const live = s.id === ctx.liveSceneId;
  if (!b) return { gm: [`The scene ${name} is made.`], players: [] };
  if (gone(a)) return { gm: [`The scene ${name} is deleted.`], players: [] };
  const gm: string[] = [];
  const players: string[] = [];
  const both = (x: string) => (gm.push(x), live && players.push(x));
  let map = false;
  for (const key of changedKeys(b, a)) {
    if (key === 'combat') {
      const was = b.combat as TurnOrder | null | undefined;
      const now = a!.combat as TurnOrder | null | undefined;
      const up = activeToken(now);
      if (!was && now) both(`Combat starts${up ? `: ${ctx.tokenNameById(up)} goes first` : ''}.`);
      else if (was && !now) both('Combat ends.');
      else if (was && now) {
        if (now.entries.length > was.entries.length) both(`${now.entries.length - was.entries.length === 1 ? 'Someone joins' : 'More join'} the fight.`);
        else if (now.entries.length < was.entries.length) both(`${was.entries.length - now.entries.length === 1 ? 'Someone leaves' : 'Some leave'} the fight.`);
        if (now.round !== was.round) both(`Round ${now.round}${up ? `: ${ctx.tokenNameById(up)}’s turn` : ''}.`);
        else if (now.turn !== was.turn && up) both(`${ctx.tokenNameById(up)}’s turn.`);
        else if (now.entries.length === was.entries.length) gm.push('The initiative changes.');
      }
    } else if (key === 'nowPlaying') {
      const now = a!.nowPlaying as { trackId: string } | null | undefined;
      both(now ? `The music: ${ctx.trackName(now.trackId)}.` : 'The music stops.');
    } else if (['fog', 'walls', 'grid', 'vision', 'image', 'background', 'width', 'height', 'credit'].includes(key)) map = true;
    else if (key !== 'order') gm.push(`The scene ${name}’s settings change.`);
  }
  if (map) gm.push(`The map of ${name} changes (its fog, walls or grid).`);
  return { gm: [...new Set(gm)], players: [...new Set(players)] };
}

function campaign(b: Rec | null, a: Rec | null, ctx: DescribeContext): Described | null {
  const tb = (b?.tabletop ?? {}) as Record<string, unknown>;
  const ta = (a?.tabletop ?? {}) as Record<string, unknown>;
  const keys = changedKeys(tb as Rec, ta as Rec);
  const out: Described = { gm: [], players: [] };
  for (const key of keys) {
    if (key === 'live') {
      const was = tb.live as { sceneId: string; shownOnly?: boolean } | null | undefined;
      const now = ta.live as { sceneId: string; shownOnly?: boolean } | null | undefined;
      const s = now ? `The GM ${now.shownOnly ? 'shows' : 'starts'} the scene ${ctx.sceneName(now.sceneId)}.` : was ? `The GM ${was.shownOnly ? 'hides' : 'stops'} the scene ${ctx.sceneName(was.sceneId)}.` : '';
      if (s) {
        out.gm.push(s);
        out.players.push(s);
      }
    } else if (key === 'table') out.gm.push('The GM changes the Table Settings.');
    else if (key === 'frozen') continue;
    else out.gm.push('The campaign’s details change.');
  }
  if (!keys.length && changedKeys(b, a).some((k) => k !== 'tabletop')) out.gm.push('The campaign’s details change.');
  return out.gm.length ? out : null;
}

/** A card or roll posted to the chat: its rolls' totals (a whisper's, only for whom it's for). */
function chatEntry(b: Rec | null, a: Rec | null): Described | null {
  const e = (a ?? b) as unknown as TableEntry;
  if (!a || b) {
    // A card changed after it was posted: a target's save, a concentration save rolled.
    const card = e.card as RollCard | undefined;
    const before = (b as unknown as TableEntry | null)?.card;
    if (!card || !before) return null;
    const out: string[] = [];
    const check = card.check;
    if (check?.result && !before.check?.result) out.push(`${(card.subtitle ?? '').split(' · ')[0] || 'They'} ${check.result.success ? 'keeps' : 'loses'} concentration on ${check.spell} (${check.result.total} against DC ${check.dc}).`);
    for (const t of card.targets ?? []) if (t.save && !before.targets?.find((x) => x.tokenId === t.tokenId)?.save) out.push(`${t.name} ${t.save.success ? 'saves' : 'fails its save'} against ${card.title} (${t.save.total}).`);
    return out.length ? { gm: out, players: out, ...(e.to ? { to: e.to } : {}) } : null;
  }
  if (e.kind === 'card' && e.card) {
    const rolls = e.card.rolls.map((r) => `${r.label} ${r.total}`).join(', ');
    const s = `${e.card.title}${e.card.subtitle ? ` (${e.card.subtitle})` : ''}${rolls ? `: ${rolls}` : ''}.`;
    return { gm: [s], players: e.to && !e.to.length ? [] : [s], ...(e.to ? { to: e.to } : {}) };
  }
  if (e.kind === 'roll' && e.roll) {
    const s = `Rolls ${e.text ? `${e.text}: ` : ''}${e.roll.total} (${e.roll.expression}).`;
    return { gm: [s], players: e.to && !e.to.length ? [] : [s], ...(e.to ? { to: e.to } : {}) };
  }
  return null;
}

/** What a change says in the game log, or null if it says nothing (a ping, a chat message: the chat has those). */
export function describeChange(c: Observed, ctx: DescribeContext): Described | null {
  const b = c.before as Rec | null;
  const a = c.after as Rec | null;
  const r = (a ?? b)!;
  if (c.collection === 'tokens') return token(b, a, ctx);
  if (c.collection === 'pcs') return sheet(b, a);
  if (c.collection === 'playScenes') return scene(b, a, ctx);
  if (c.collection === 'worlds') return campaign(b, a, ctx);
  if (c.collection === 'tableLog') return chatEntry(b, a);
  const live = r.sceneId === ctx.liveSceneId;
  if (c.collection === 'templates') {
    const s = gone(a) ? 'Clears an area from the board.' : `Lays a ${(r.shape as string) ?? 'shape'} on the board.`;
    return { gm: [s], players: live ? [s] : [] };
  }
  if (c.collection === 'marks') {
    const s = gone(a) ? 'Clears marks from the board.' : 'Draws on the board.';
    return { gm: [s], players: live && !r.hidden ? [s] : [] };
  }
  if (c.collection === 'handouts') {
    const name = (r.name as string) || 'a handout';
    if (b && a && b.hidden && !a.hidden) return { gm: [`The GM shows the handout ${name}.`], players: live ? [`The GM shows the handout ${name}.`] : [] };
    if (b && a && !b.hidden && a.hidden) return { gm: [`The GM hides the handout ${name}.`], players: [] };
    return { gm: [!b ? `The handout ${name} is made.` : gone(a) ? `The handout ${name} is deleted.` : `The handout ${name} changes.`], players: [] };
  }
  return null;
}

/** An event's words, from all its changes: the GM's text and the players' (null: the GM's alone), and whom a whisper's for. */
export function describeEvent(changes: Observed[], ctx: DescribeContext): { text: string; playerText: string | null; to?: string[] } {
  const gm: string[] = [];
  const players: string[] = [];
  let to: string[] | undefined;
  for (const c of changes) {
    const d = describeChange(c, ctx);
    if (!d) continue;
    gm.push(...d.gm);
    players.push(...d.players);
    if (d.to) to = [...new Set([...(to ?? []), ...d.to])];
  }
  return { text: gm.join(' ') || 'Something changes.', playerText: players.length ? players.join(' ') : null, ...(to ? { to } : {}) };
}

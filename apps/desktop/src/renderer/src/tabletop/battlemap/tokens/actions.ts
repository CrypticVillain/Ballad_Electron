import { damage, heal } from '@/lib/tabletop';
import { live, newId, now, type Encounter, type Entry, type Monster, type PlayerCharacter } from '@/lib/model';
import { useVault } from '@/stores/vault';
import type { Point } from '../geometry/grid';
import { freeSpot, nextName, sizeFromKind, snapToken } from '../geometry/tokens';
import type { GridSettings, Token } from '../model';

/**
 * Tabletop → Battle maps: putting tokens on a map (a Play scene, an
 * encounter's prepared map), moving them, and changing their hit points and
 * conditions. A party member's go to their sheet; everyone else's to the token.
 */

const store = () => useVault.getState();
const tokensOn = (boardId: string) => live(store().vault.tokens).filter((t) => t.sceneId === boardId);
const stamp = () => {
  const t = now();
  return { id: newId(), createdAt: t, updatedAt: t, deletedAt: null };
};

/** The map tokens go on: its id (a scene's or an encounter's), its campaign and its grid. */
export type TokenBoard = { id: string; worldId: string; grid: GridSettings };

/** What a new token stands for. */
export type TokenSource = { kind: 'pc'; pc: PlayerCharacter } | { kind: 'monster'; monster: Monster } | { kind: 'npc'; entry: Entry } | { kind: 'other'; name?: string };

/** What the Add Tokens tray puts on a drag: `{ kind, id }`. */
export const TOKEN_MIME = 'application/x-ballad-token';

/** A dragged `{ kind, id }` back to what it stands for (null if it's gone). */
export function sourceOf({ kind, id }: { kind: TokenSource['kind']; id: string | null }): TokenSource | null {
  const v = store().vault;
  const alive = <T extends { deletedAt?: string | null }>(r: T | undefined) => (r && !r.deletedAt ? r : undefined);
  if (kind === 'pc') {
    const pc = alive(v.pcs[id ?? '']);
    return pc ? { kind, pc } : null;
  }
  if (kind === 'monster') {
    const monster = alive(v.monsters[id ?? '']);
    return monster ? { kind, monster } : null;
  }
  if (kind === 'npc') {
    const entry = alive(v.entries[id ?? '']);
    return entry ? { kind, entry } : null;
  }
  return { kind: 'other' };
}

/**
 * A token on a scene, snapped to its grid at `at`. A party member is on a
 * scene once (adding them again returns the one there); creatures and NPCs
 * can be many, numbered ("Brine Ghoul 2"), each with the stat block's hit
 * points to start.
 */
export function addToken(board: TokenBoard, source: TokenSource, at: Point, input: Partial<Token> = {}): { token: Token; existing: boolean } {
  const here = tokensOn(board.id);
  if (source.kind === 'pc') {
    const there = here.find((t) => t.kind === 'pc' && t.refId === source.pc.id);
    if (there) return { token: there, existing: true };
  }
  const base =
    source.kind === 'pc'
      ? { kind: 'pc' as const, refId: source.pc.id, name: source.pc.name || 'Character', size: 'medium' as const, hp: null }
      : source.kind === 'monster'
        ? { kind: 'monster' as const, refId: source.monster.id, name: source.monster.name || 'Creature', size: sizeFromKind(source.monster.kind), hp: { current: source.monster.hp, max: source.monster.hp, temp: 0 } }
        : source.kind === 'npc'
          ? { kind: 'npc' as const, refId: source.entry.id, name: source.entry.name || 'NPC', size: 'medium' as const, hp: null }
          : { kind: 'other' as const, refId: null, name: source.name || 'Token', size: 'medium' as const, hp: null };
  const name = base.kind === 'pc' ? base.name : nextName(base.name, here.map((t) => t.name));
  const { x, y } = snapToken(board.grid, at, base.size);
  const token: Token = {
    ...stamp(),
    worldId: board.worldId,
    sceneId: board.id,
    ...base,
    name,
    x,
    y,
    ac: null,
    conditions: [],
    hidden: false,
    aura: { radius: 0, color: '#f59e0b' },
    order: here.length ? Math.max(...here.map((t) => t.order)) + 1 : 0,
    ...input,
  };
  store().put('tokens', token);
  return { token, existing: false };
}

export const updateToken = (id: string, changes: Partial<Token>) => store().patch('tokens', id, changes);

/** Moves tokens to where they were dropped (already snapped). */
export function moveTokens(moves: { id: string; x: number; y: number }[]) {
  for (const m of moves) updateToken(m.id, { x: m.x, y: m.y });
}

/** Takes tokens off the board (soft); returns their undo. */
export function removeTokens(ids: string[]): () => void {
  for (const id of ids) store().remove('tokens', id);
  return () => {
    for (const id of ids) store().restore('tokens', id);
  };
}

/** Puts tokens above every other on their scene. */
export function bringToFront(ids: string[]) {
  const first = store().vault.tokens[ids[0] ?? ''];
  if (!first) return;
  let top = Math.max(0, ...tokensOn(first.sceneId).map((t) => t.order));
  for (const id of ids) updateToken(id, { order: ++top });
}

const sheet = (token: Token) => (token.kind === 'pc' && token.refId ? store().vault.pcs[token.refId] : undefined);

/** Damage (temporary hit points first) or healing: a party member's sheet, or the token's own. */
export function changeHp(token: Token, amount: number, how: 'damage' | 'heal') {
  const pc = sheet(token);
  if (pc) return store().patch('pcs', pc.id, { hp: how === 'damage' ? damage(pc.hp, amount) : heal(pc.hp, amount) });
  if (token.hp) updateToken(token.id, { hp: how === 'damage' ? damage(token.hp, amount) : heal(token.hp, amount) });
}

/** Sets hit points outright (or, for a token without them, starts tracking them). */
export function setHp(token: Token, hp: { current: number; max: number; temp: number } | null) {
  const pc = sheet(token);
  if (pc) {
    if (hp) store().patch('pcs', pc.id, { hp });
    return;
  }
  updateToken(token.id, { hp });
}

/** Turns a condition on or off: a party member's sheet, or the token's own. */
export function toggleCondition(token: Token, condition: string) {
  const pc = sheet(token);
  const now = pc ? pc.conditions : token.conditions;
  const next = now.includes(condition) ? now.filter((c) => c !== condition) : [...now, condition];
  if (pc) store().patch('pcs', pc.id, { conditions: next });
  else updateToken(token.id, { conditions: next });
}

/** What an encounter's combatant is, as a token's source (a combatant of no one in particular is a plain token by its name). */
function combatantSource(c: Encounter['combatants'][number]): TokenSource {
  const v = store().vault;
  const pc = c.kind === 'pc' && c.refId ? v.pcs[c.refId] : undefined;
  if (pc && !pc.deletedAt) return { kind: 'pc', pc };
  const monster = c.kind === 'monster' && c.refId ? v.monsters[c.refId] : undefined;
  if (monster && !monster.deletedAt) return { kind: 'monster', monster };
  return { kind: 'other', name: c.name };
}

/**
 * An encounter's combatants as tokens on a map, each on the free square
 * nearest `at`, named and hurt as they are in the encounter. `only`: just
 * these combatants (an encounter's own map places the ones not on it yet).
 */
export function placeCombatants(board: TokenBoard, encounter: Encounter, at: Point, only?: (c: Encounter['combatants'][number]) => boolean): Token[] {
  const placed: Token[] = [];
  for (const c of encounter.combatants.filter((x) => !only || only(x))) {
    const source = combatantSource(c);
    const others = tokensOn(board.id).map((t) => ({ x: t.x, y: t.y, size: t.size }));
    const size = source.kind === 'monster' ? sizeFromKind(source.monster.kind) : 'medium';
    const spot = freeSpot(board.grid, at, size, others);
    const own = source.kind === 'pc' ? {} : { name: c.name, hp: { current: c.hp, max: c.maxHp, temp: 0 }, ac: c.ac || null, conditions: c.conditions };
    const { token } = addToken(board, source, spot, { combatantId: board.id === encounter.id ? c.id : undefined, ...own });
    placed.push(token);
  }
  return placed;
}

/** Copies a map's tokens to another (a scene made from an encounter gets the tokens placed on its map). */
export function copyTokens(fromBoardId: string, to: TokenBoard): Token[] {
  return tokensOn(fromBoardId).map((t) => {
    const copy: Token = { ...t, ...stamp(), worldId: to.worldId, sceneId: to.id, combatantId: undefined };
    store().put('tokens', copy);
    return copy;
  });
}

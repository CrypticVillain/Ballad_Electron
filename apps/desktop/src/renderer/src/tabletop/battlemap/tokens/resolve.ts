import type { Entry, Monster, PlayerCharacter } from '@/lib/model';
import type { Token } from '../model';

/**
 * Tabletop → Battle maps: a token as the board shows it (pure). A party member's
 * name, hit points, AC and conditions come from their sheet; a creature's
 * picture and AC from its stat block unless the token has its own; an NPC's
 * picture from their entry. `missing`: what it stood for was deleted (it
 * keeps what the token itself knows).
 */

export type TokenView = {
  token: Token;
  name: string;
  image?: string;
  hp: { current: number; max: number; temp: number } | null;
  ac: number | null;
  conditions: string[];
  /** The spell it's concentrating on (a party member's sheet's, else the token's own), or null. */
  concentrating: string | null;
  /** Where its sheet, stat block or entry is, if it has one. */
  link?: string;
  missing: boolean;
  /** The accounts that can move it besides the GM: its own, else (a party member's) their sheet's owner. */
  assignees: string[];
};

export type Sources = { pcs: Map<string, PlayerCharacter>; monsters: Map<string, Monster>; entries: Map<string, Entry> };

export function resolveToken(token: Token, { pcs, monsters, entries }: Sources): TokenView {
  const sheetOwner = token.kind === 'pc' && token.refId ? pcs.get(token.refId)?.ownerAccountId : undefined;
  const assignees = token.assignees ?? (sheetOwner ? [sheetOwner] : []);
  const own = { token, name: token.name, image: token.image, hp: token.hp, ac: token.ac, conditions: token.conditions, concentrating: token.concentrating ?? null, assignees };
  if (token.kind === 'pc' && token.refId) {
    const pc = pcs.get(token.refId);
    if (!pc) return { ...own, missing: true };
    return { token, name: pc.name || token.name, image: token.image ?? pc.image, hp: pc.hp, ac: pc.ac, conditions: pc.conditions, concentrating: pc.concentrating ?? null, link: `/party/${pc.id}`, missing: false, assignees };
  }
  if (token.kind === 'monster' && token.refId) {
    const m = monsters.get(token.refId);
    if (!m) return { ...own, missing: true };
    return { ...own, image: token.image ?? m.image, ac: token.ac ?? m.ac, link: `/bestiary/${m.id}`, missing: false };
  }
  if (token.kind === 'npc' && token.refId) {
    const e = entries.get(token.refId);
    if (!e) return { ...own, missing: true };
    return { ...own, image: token.image ?? e.image, link: `/bible/character/${e.id}`, missing: false };
  }
  return { ...own, missing: false };
}

/** Its ring's color by what it is: the party green, creatures red, NPCs blue, anything else gray. */
export const KIND_TONE: Record<Token['kind'], string> = {
  pc: 'var(--online)',
  monster: 'var(--destructive)',
  npc: '#3b82f6',
  other: '#94a3b8',
};

/** How hurt, for the bar's color: fine, hurt, bloodied (half or less), down. */
export function hpState(hp: { current: number; max: number }): 'fine' | 'hurt' | 'bloodied' | 'down' {
  if (hp.current <= 0) return 'down';
  if (hp.current <= hp.max / 2) return 'bloodied';
  return hp.current < hp.max ? 'hurt' : 'fine';
}

/** Who's looking at a board: the GM (the campaign's owner: everything), or another account (online: a player). */
export type BoardAccess = { gm: boolean; accountId: string };

/** Whether this viewer can move (and pick) a token: the GM any, a player the ones assigned to them. */
export const canMove = (access: BoardAccess, view: TokenView) => access.gm || view.assignees.includes(access.accountId);

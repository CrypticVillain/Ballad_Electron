import type { Point } from '@/tabletop/battlemap/geometry/grid';
import type { BoardTemplate, TableEntry, TurnOrder } from './model';

/**
 * Play → the table (pure, with tests beside it): who sees a log entry, the
 * initiative order and stepping through it, and a template's outline.
 */

/** Whether `me` sees an entry: everyone sees what isn't a whisper; a whisper, the GM, its writer and who it's to. */
export const seesEntry = (entry: TableEntry, me: string, gm: boolean) => !entry.to || gm || entry.accountId === me || entry.to.includes(me);

/** How long a ping shows, in ms. */
export const PING_MS = 4000;

/** The order the fight goes in: highest initiative first, ties in the order they joined; no initiative yet, last. */
export function ordered(order: TurnOrder): TurnOrder['entries'] {
  return order.entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (b.e.initiative ?? -Infinity) - (a.e.initiative ?? -Infinity) || a.i - b.i)
    .map(({ e }) => e);
}

/** The next turn (or, -1, the one before): past the last, the next round starts; before the first of round 1, nothing moves. */
export function stepTurn(order: TurnOrder, direction: 1 | -1): TurnOrder {
  const n = order.entries.length;
  if (!n) return order;
  let turn = Math.min(order.turn, n - 1) + direction;
  let round = order.round;
  if (turn >= n) {
    turn = 0;
    round += 1;
  } else if (turn < 0) {
    if (round <= 1) return order;
    turn = n - 1;
    round -= 1;
  }
  return { ...order, turn, round };
}

/** Whose turn it is (a token's id), if anyone's. */
export const activeToken = (order: TurnOrder | null | undefined) => (order && order.entries.length ? ordered(order)[Math.min(order.turn, order.entries.length - 1)]?.tokenId : undefined);

/** Takes tokens out of the fight, keeping the turn on whoever's turn it was (or the one after, if theirs was taken). */
export function withoutTokens(order: TurnOrder, ids: string[]): TurnOrder {
  const before = ordered(order);
  const current = before[Math.min(order.turn, before.length - 1)]?.tokenId;
  const entries = order.entries.filter((e) => !ids.includes(e.tokenId));
  const after = ordered({ ...order, entries });
  let turn = after.findIndex((e) => e.tokenId === current);
  if (turn < 0) {
    // Theirs was taken: whoever was next.
    const next = before.slice(Math.min(order.turn, before.length - 1)).find((e) => !ids.includes(e.tokenId));
    turn = next ? after.findIndex((e) => e.tokenId === next.tokenId) : 0;
  }
  return { ...order, entries, turn: Math.max(0, turn) };
}

/** A 5e cone is as wide at its end as it is long: half its angle either side. */
const CONE_HALF = Math.atan(0.5);

/** A template's outline on the map, as points (a circle's are its center and a point on its edge: draw it as a circle). */
export function templateOutline(t: Pick<BoardTemplate, 'shape' | 'x' | 'y' | 'angle' | 'length'>, lineWidth: number): Point[] {
  const at = (angle: number, distance: number, from: Point = t) => ({ x: from.x + Math.cos(angle) * distance, y: from.y + Math.sin(angle) * distance });
  const side = t.angle + Math.PI / 2;
  if (t.shape === 'circle') return [{ x: t.x, y: t.y }, at(t.angle, t.length)];
  if (t.shape === 'cone') {
    const reach = t.length / Math.cos(CONE_HALF);
    return [{ x: t.x, y: t.y }, at(t.angle - CONE_HALF, reach), at(t.angle + CONE_HALF, reach)];
  }
  // A line (so wide) or a square (as wide as it's long), from the middle of its near edge.
  const half = (t.shape === 'line' ? lineWidth : t.length) / 2;
  const end = at(t.angle, t.length);
  return [at(side, half), at(side, half, end), at(side, -half, end), at(side, -half)];
}

/** How big a template is, said in the grid's unit: "20 ft". */
export const templateSize = (length: number, cell: number, distance: number, unit: string) => `${Math.round(((length / cell) * distance) / 5) * 5 || Math.round((length / cell) * distance)} ${unit}`;

/** A color per account, for its pings and templates (the same at every window). */
export function accountColor(accountId: string): string {
  const colors = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#eab308', '#14b8a6', '#ef4444'];
  let h = 0;
  for (const c of accountId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return colors[h % colors.length]!;
}

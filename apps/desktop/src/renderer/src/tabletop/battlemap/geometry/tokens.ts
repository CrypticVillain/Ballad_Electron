import { TOKEN_SIZES, type TokenSize } from '../model';
import { cellAt, cellCenter, type Cell, type Grid, type Point } from './grid';

/**
 * Tabletop → Battle maps: tokens' geometry (pure). How big a token is, where it
 * snaps (a square's middle, or a corner for a 2×2 or 4×4 one, so it covers
 * whole squares), where an arrow key moves it, a creature's size from its
 * type ("Large beast, unaligned"), and numbering more of the same.
 */

export const tokenCells = (size: TokenSize): number => TOKEN_SIZES.find((s) => s.value === size)?.cells ?? 1;

/** A token's width on the scene, in pixels. */
export const tokenWidth = (grid: Pick<Grid, 'size'>, size: TokenSize) => grid.size * tokenCells(size);

/** Where a token whose middle is at `p` settles: squares' middles, or corners for even sizes; hexes' middles. */
export function snapToken(grid: Grid, p: Point, size: TokenSize): Point {
  const cells = tokenCells(size);
  if (grid.kind === 'square' && cells >= 2 && cells % 2 === 0) {
    const s = grid.size;
    return { x: grid.offsetX + Math.round((p.x - grid.offsetX) / s) * s, y: grid.offsetY + Math.round((p.y - grid.offsetY) / s) * s };
  }
  return cellCenter(grid, cellAt(grid, p));
}

/** A hex's six neighbors, in axial steps. */
const HEX_STEPS: Cell[] = [
  { col: 1, row: 0 },
  { col: -1, row: 0 },
  { col: 0, row: 1 },
  { col: 0, row: -1 },
  { col: 1, row: -1 },
  { col: -1, row: 1 },
];

/**
 * One step in a direction (an arrow key: dx and dy of -1, 0 or 1): a square
 * over, or the neighboring hex that lies most that way.
 */
export function nudge(grid: Grid, p: Point, dx: number, dy: number): Point {
  if (grid.kind === 'square') return { x: p.x + dx * grid.size, y: p.y + dy * grid.size };
  const here = cellAt(grid, p);
  const from = cellCenter(grid, here);
  let best: Point = from;
  let score = -Infinity;
  for (const step of HEX_STEPS) {
    const c = cellCenter(grid, { col: here.col + step.col, row: here.row + step.row });
    const vx = c.x - from.x;
    const vy = c.y - from.y;
    const dot = (vx * dx + vy * dy) / Math.hypot(vx, vy);
    if (dot > score) {
      score = dot;
      best = c;
    }
  }
  return best;
}

/** A creature's size from the start of its type ("Huge aberration…"); medium if it doesn't say. */
export function sizeFromKind(kind: string): TokenSize {
  const word = kind.trim().split(/[\s,]/)[0]?.toLowerCase() ?? '';
  return TOKEN_SIZES.find((s) => s.value === word)?.value ?? 'medium';
}

/** The next free name for another of the same ("Brine Ghoul", then "Brine Ghoul 2", "Brine Ghoul 3"…). */
export function nextName(base: string, taken: string[]): string {
  const names = new Set(taken.map((n) => n.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
}

/**
 * The nearest spot to `at` where a token of this size doesn't overlap any of
 * `others`: the square (or hex) there, then the ones around it, ring by ring.
 * `at` itself if nothing is free nearby.
 */
export function freeSpot(grid: Grid, at: Point, size: TokenSize, others: (Point & { size: TokenSize })[]): Point {
  const half = (s: TokenSize) => (grid.size * tokenCells(s)) / 2;
  const overlaps = (p: Point) => others.some((o) => Math.abs(p.x - o.x) < half(size) + half(o.size) - 0.5 && Math.abs(p.y - o.y) < half(size) + half(o.size) - 0.5);
  const start = cellAt(grid, at);
  for (let ring = 0; ring <= 12; ring++) {
    let best: Point | null = null;
    let bestDistance = Infinity;
    for (let dc = -ring; dc <= ring; dc++) {
      for (let dr = -ring; dr <= ring; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue;
        const p = snapToken(grid, cellCenter(grid, { col: start.col + dc, row: start.row + dr }), size);
        const d = Math.hypot(p.x - at.x, p.y - at.y);
        if (d < bestDistance && !overlaps(p)) {
          best = p;
          bestDistance = d;
        }
      }
    }
    if (best) return best;
  }
  return snapToken(grid, at, size);
}

/** The tokens whose middles are inside a box (any corner to any corner). */
export function inBox<T extends Point & { id: string }>(tokens: T[], a: Point, b: Point): string[] {
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  return tokens.filter((t) => t.x >= x0 && t.x <= x1 && t.y >= y0 && t.y <= y1).map((t) => t.id);
}

import type { GridSettings } from '../model';

/**
 * Tabletop → Play: the grid's geometry (pure). Points are in the scene's own
 * pixels. Squares are numbered by column and row from the grid's offset;
 * hexes by axial coordinates (q, r), hex 0,0 centered on the offset.
 *
 *   cellAt / cellCenter / snap   which square or hex a point is in, its middle
 *   measure                      how far a path goes, in squares and in feet
 *   lineUp                       the grid from a box dragged over one square
 *   gridPath                     the lines to draw, as an SVG path
 */

export type Point = { x: number; y: number };
export type Cell = { col: number; row: number };
export type Grid = Pick<GridSettings, 'kind' | 'size' | 'offsetX' | 'offsetY'>;

const SQRT3 = Math.sqrt(3);

/** A hex's radius (center to corner) from its width across the flats. */
export const hexRadius = (size: number) => size / SQRT3;

/** Rounds fractional axial coordinates to the hex they fall in. */
function hexRound(q: number, r: number): Cell {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  // Never -0: it reads (and compares, in tests) as 0.
  return { col: rq + 0, row: rr + 0 };
}

export function cellAt(grid: Grid, p: Point): Cell {
  const x = p.x - grid.offsetX;
  const y = p.y - grid.offsetY;
  const s = grid.size;
  if (grid.kind === 'square') return { col: Math.floor(x / s), row: Math.floor(y / s) };
  const r = hexRadius(s);
  if (grid.kind === 'hexRows') return hexRound(((SQRT3 / 3) * x - y / 3) / r, ((2 / 3) * y) / r);
  return hexRound(((2 / 3) * x) / r, (-x / 3 + (SQRT3 / 3) * y) / r);
}

export function cellCenter(grid: Grid, c: Cell): Point {
  const s = grid.size;
  if (grid.kind === 'square') return { x: grid.offsetX + (c.col + 0.5) * s, y: grid.offsetY + (c.row + 0.5) * s };
  const r = hexRadius(s);
  if (grid.kind === 'hexRows') return { x: grid.offsetX + r * (SQRT3 * c.col + (SQRT3 / 2) * c.row), y: grid.offsetY + r * 1.5 * c.row };
  return { x: grid.offsetX + r * 1.5 * c.col, y: grid.offsetY + r * ((SQRT3 / 2) * c.col + SQRT3 * c.row) };
}

/** The middle of the square or hex a point is in. */
export const snap = (grid: Grid, p: Point): Point => cellCenter(grid, cellAt(grid, p));

/** Hexes apart (axial). */
const hexDistance = (a: Cell, b: Cell) => (Math.abs(a.col - b.col) + Math.abs(a.row - b.row) + Math.abs(a.col + a.row - b.col - b.row)) / 2;

export type Measure = { cells: number; distance: number };

/**
 * How far a path goes (its points in order: the start, any waypoints, the
 * end), in squares or hexes and in the grid's unit. On squares, diagonals
 * follow the rule: every one a square, alternating one and two (counted over
 * the whole path, as the rule says), or the true distance. Hexes are hexes.
 */
export function measure(grid: GridSettings, points: Point[]): Measure {
  let cells = 0;
  let straight = 0;
  let diagonal = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (grid.kind !== 'square') {
      cells += hexDistance(cellAt(grid, a), cellAt(grid, b));
    } else if (grid.diagonals === 'euclidean') {
      cells += Math.hypot(b.x - a.x, b.y - a.y) / grid.size;
    } else {
      const ca = cellAt(grid, a);
      const cb = cellAt(grid, b);
      const dx = Math.abs(cb.col - ca.col);
      const dy = Math.abs(cb.row - ca.row);
      if (grid.diagonals === 'fives') cells += Math.max(dx, dy);
      else {
        diagonal += Math.min(dx, dy);
        straight += Math.abs(dx - dy);
      }
    }
  }
  if (grid.kind === 'square' && grid.diagonals === 'alternating') cells = straight + diagonal + Math.floor(diagonal / 2);
  const round = (n: number) => Math.round(n * 10) / 10;
  return { cells: round(cells), distance: round(cells * grid.distance) };
}

/** "35 ft". */
export const formatDistance = (grid: Pick<GridSettings, 'unit'>, m: Measure) => `${m.distance} ${grid.unit}`.trim();

/**
 * The grid that fits a box dragged over one square (or hex) of the map: its
 * size, and the offset that puts a square's corner (a hex's middle) there.
 * Squares take the box's average side; hexes in rows its width (across the
 * flats), in columns its height.
 */
export function lineUp(kind: GridSettings['kind'], box: { x: number; y: number; w: number; h: number }): Pick<GridSettings, 'size' | 'offsetX' | 'offsetY'> | null {
  const x = Math.min(box.x, box.x + box.w);
  const y = Math.min(box.y, box.y + box.h);
  const w = Math.abs(box.w);
  const h = Math.abs(box.h);
  const round = (n: number) => Math.round(n * 100) / 100;
  if (kind === 'square') {
    const size = (w + h) / 2;
    if (size < 4) return null;
    const mod = (n: number) => ((n % size) + size) % size;
    return { size: round(size), offsetX: round(mod(x)), offsetY: round(mod(y)) };
  }
  const size = kind === 'hexRows' ? w : h;
  if (size < 4) return null;
  return { size: round(size), offsetX: round(x + w / 2), offsetY: round(y + h / 2) };
}

/** A hex's six corners around its middle. */
export function hexCorners(kind: GridSettings['kind'], size: number, c: Point): Point[] {
  const r = hexRadius(size);
  const start = kind === 'hexRows' ? 30 : 0;
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((start + 60 * i) * Math.PI) / 180;
    return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
  });
}

/** At most this many hexes are drawn (a huge map with tiny hexes would otherwise hang the page). */
export const MAX_HEXES = 40000;

/**
 * The grid's lines over a width × height scene, as one SVG path: squares as
 * long lines, hexes as outlines. Null for hexes too small to draw.
 */
export function gridPath(grid: Grid, width: number, height: number): string | null {
  const s = grid.size;
  if (!(s >= 4)) return null;
  const n = (v: number) => Math.round(v * 100) / 100;
  if (grid.kind === 'square') {
    const parts: string[] = [];
    const first = (offset: number) => offset - Math.ceil(offset / s) * s;
    for (let x = first(grid.offsetX); x <= width; x += s) if (x >= 0) parts.push(`M${n(x)} 0V${n(height)}`);
    for (let y = first(grid.offsetY); y <= height; y += s) if (y >= 0) parts.push(`M0 ${n(y)}H${n(width)}`);
    return parts.join('');
  }
  const r = hexRadius(s);
  // Step across and down in offset coordinates, wide enough to cover the edges.
  const stepX = grid.kind === 'hexRows' ? s : 1.5 * r;
  const stepY = grid.kind === 'hexRows' ? 1.5 * r : s;
  const cols = [Math.floor(-grid.offsetX / stepX) - 2, Math.ceil((width - grid.offsetX) / stepX) + 2] as const;
  const rows = [Math.floor(-grid.offsetY / stepY) - 2, Math.ceil((height - grid.offsetY) / stepY) + 2] as const;
  if ((cols[1] - cols[0]) * (rows[1] - rows[0]) > MAX_HEXES) return null;
  const odd = (v: number) => ((v % 2) + 2) % 2;
  const parts: string[] = [];
  for (let row = rows[0]; row <= rows[1]; row++) {
    for (let col = cols[0]; col <= cols[1]; col++) {
      const c =
        grid.kind === 'hexRows'
          ? { x: grid.offsetX + s * (col + 0.5 * odd(row)), y: grid.offsetY + stepY * row }
          : { x: grid.offsetX + stepX * col, y: grid.offsetY + s * (row + 0.5 * odd(col)) };
      if (c.x < -r || c.y < -r || c.x > width + r || c.y > height + r) continue;
      const pts = hexCorners(grid.kind, s, c);
      parts.push(`M${pts.map((p) => `${n(p.x)} ${n(p.y)}`).join('L')}Z`);
    }
  }
  return parts.join('');
}

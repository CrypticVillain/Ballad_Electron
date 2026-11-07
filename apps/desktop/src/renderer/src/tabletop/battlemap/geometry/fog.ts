import type { Fog, FogOp } from '../model';
import type { Point } from './grid';

/**
 * Tabletop → Battle maps: fog of war's geometry (pure). With fog on, the map
 * starts covered; each stroke, in order, reveals or hides a box, a shape, or
 * everything. The board draws the same strokes as a mask.
 */

/** Whether a point is inside a polygon (even-odd). */
export function inPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** The box a stroke's two corners make, as four points. */
export function rectPoints(a: Point, b: Point): Point[] {
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/** How far a point is from a path (a single point: from it). */
export function distanceToPath(p: Point, path: Point[]): number {
  if (path.length === 1) return Math.hypot(p.x - path[0]!.x, p.y - path[0]!.y);
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
}

const covers = (op: FogOp, p: Point) => (op.shape === 'all' ? true : op.shape === 'brush' ? distanceToPath(p, op.points) <= (op.radius ?? 0) : inPolygon(p, op.points));

/** Whether a point is under fog (false whenever fog is off). */
export function fogged(fog: Fog | undefined, p: Point): boolean {
  if (!fog?.enabled) return false;
  let covered = true;
  for (const op of fog.ops) if (covers(op, p)) covered = op.mode === 'hide';
  return covered;
}

/**
 * A stroke added to the fog. Revealing or hiding everything clears the
 * strokes before it (nothing under it shows any more), so the list stays short.
 */
export function addFogOp(fog: Fog, op: FogOp): Fog {
  if (op.shape === 'all') return { ...fog, ops: [op] };
  return { ...fog, ops: [...fog.ops, op] };
}

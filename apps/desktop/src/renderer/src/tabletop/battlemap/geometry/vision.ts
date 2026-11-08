import type { Point } from './grid';

/**
 * Tabletop → Battle maps: walls, line of sight and light (pure, with tests
 * beside it). Walls are lines on the map that block sight. What a token sees
 * is its visibility polygon (everything a straight line reaches from it
 * without crossing a wall, out to the map's edge), and of that, in a dark
 * scene, only what's lit (a light's own visibility, out to its reach) or
 * within its darkvision; in bright light, all of it.
 */

export type Wall = { id: string; points: Point[] };
export type Segment = [Point, Point];

/** The scene's light: bright or dim (everything in sight is seen; dim, shaded darker), or dark (only what's lit, or in darkvision). */
export type Lighting = 'bright' | 'dim' | 'dark';
export type VisionSettings = { enabled: boolean; lighting: Lighting };

/** A light a token carries, in the grid's unit (feet): bright out to `bright`, dim as far again. */
export type TokenLight = { bright: number; dim: number };

export const LIGHTS: { label: string; light: TokenLight | null }[] = [
  { label: 'None', light: null },
  { label: 'Candle (5 / 5 ft)', light: { bright: 5, dim: 5 } },
  { label: 'Torch (20 / 20 ft)', light: { bright: 20, dim: 20 } },
  { label: 'Lantern (30 / 30 ft)', light: { bright: 30, dim: 30 } },
  { label: 'Light Cantrip (20 / 20 ft)', light: { bright: 20, dim: 20 } },
  { label: 'Daylight (60 / 60 ft)', light: { bright: 60, dim: 60 } },
];

/** Every wall's segments, and the map's edges. */
export function segments(walls: Wall[], width: number, height: number): Segment[] {
  const out: Segment[] = [];
  for (const w of walls) for (let i = 1; i < w.points.length; i++) out.push([w.points[i - 1]!, w.points[i]!]);
  const c = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  for (let i = 0; i < 4; i++) out.push([c[i]!, c[(i + 1) % 4]!]);
  return out;
}

/** Where a ray from `o` at `angle` first meets a segment: the distance along it, or null. */
function hit(o: Point, dx: number, dy: number, [a, b]: Segment): number | null {
  const sx = b.x - a.x;
  const sy = b.y - a.y;
  const den = dx * sy - dy * sx;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((a.x - o.x) * sy - (a.y - o.y) * sx) / den;
  const u = ((a.x - o.x) * dy - (a.y - o.y) * dx) / den;
  return t >= 0 && u >= -1e-9 && u <= 1 + 1e-9 ? t : null;
}

/** Everything a straight line from `o` reaches without crossing a segment: a polygon, its points in order around `o`. */
export function visibility(o: Point, segs: Segment[]): Point[] {
  const angles: number[] = [];
  for (const [a, b] of segs)
    for (const p of [a, b]) {
      const angle = Math.atan2(p.y - o.y, p.x - o.x);
      angles.push(angle - 1e-5, angle, angle + 1e-5);
    }
  const points: { angle: number; p: Point }[] = [];
  for (const angle of angles) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let best = Infinity;
    for (const s of segs) {
      const t = hit(o, dx, dy, s);
      if (t !== null && t < best) best = t;
    }
    if (best < Infinity) points.push({ angle, p: { x: o.x + dx * best, y: o.y + dy * best } });
  }
  return points.sort((a, b) => a.angle - b.angle).map((x) => x.p);
}

/** Whether `p` is inside a polygon (even-odd). */
export function inside(p: Point, poly: Point[]): boolean {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) yes = !yes;
  }
  return yes;
}

/** Whether a wall stands between two points. */
export function blocked(from: Point, to: Point, walls: Wall[]): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  for (const w of walls)
    for (let i = 1; i < w.points.length; i++) {
      const t = hit(from, dx, dy, [w.points[i - 1]!, w.points[i]!]);
      if (t !== null && t > 1e-9 && t < 1 - 1e-9) return true;
    }
  return false;
}

/** Someone who sees (a player's token): where, and how far in the dark (darkvision, in map pixels). */
export type Viewer = Point & { darkvision: number };
/** A light on the map: where, and how far it reaches (bright and dim together, in map pixels). */
export type LightSource = Point & { reach: number };

/** Whether any viewer sees `p`: in their sight, and (unless the scene's bright) lit or within their darkvision. */
export function sees(p: Point, viewers: Viewer[], lights: LightSource[], walls: Wall[], lighting: Lighting): boolean {
  return viewers.some((v) => {
    if (blocked(v, p, walls)) return false;
    if (lighting !== 'dark') return true;
    if (Math.hypot(p.x - v.x, p.y - v.y) <= v.darkvision) return true;
    return lights.some((l) => Math.hypot(p.x - l.x, p.y - l.y) <= l.reach && !blocked(l, p, walls));
  });
}

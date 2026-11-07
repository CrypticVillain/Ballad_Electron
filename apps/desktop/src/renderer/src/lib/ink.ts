/**
 * ink.ts — handwriting's geometry, apart from the screen: packing a stroke's
 * points small, drawing a stroke's outline (perfect-freehand: pressure makes
 * it thicker, speed thinner), the eraser (whole strokes, or just the part
 * under it), the lasso, moving and resizing, and the ink as an SVG picture.
 *
 * Ink lives in a box 1000 units wide (INK_WIDTH) and as tall as it needs, so
 * it scales with the page.
 */
import { getStroke } from 'perfect-freehand';
import type { InkColor, InkStroke } from './model';

export const INK_WIDTH = 1000;

/** A note's sheet (Play's note handouts, Tabletop's lore documents): 1000 across, this tall. */
export const NOTE_SIZE = { width: 1000, height: 700 };

/** A point as drawn: x, y (ink units) and pressure (0–1). */
export type InkPoint = [number, number, number];

// ── Packing ─────────────────────────────────────────────────────────────────
// x and y to a tenth of a unit, pressure to a hundredth, each as the change
// from the point before (small numbers, so the vault's JSON stays small).

export function encodePoints(points: InkPoint[]): number[] {
  const out: number[] = [];
  let [px, py, pp] = [0, 0, 0];
  for (const [x, y, p] of points) {
    const [qx, qy, qp] = [Math.round(x * 10), Math.round(y * 10), Math.round(p * 100)];
    out.push(qx - px, qy - py, qp - pp);
    [px, py, pp] = [qx, qy, qp];
  }
  return out;
}

export function decodePoints(packed: number[]): InkPoint[] {
  const out: InkPoint[] = [];
  let [x, y, p] = [0, 0, 0];
  for (let i = 0; i + 2 < packed.length; i += 3) {
    x += packed[i]!;
    y += packed[i + 1]!;
    p += packed[i + 2]!;
    out.push([x / 10, y / 10, p / 100]);
  }
  return out;
}

const cache = new WeakMap<number[], InkPoint[]>();
/** A stroke's points (decoded once per stroke). */
export function pointsOf(stroke: Pick<InkStroke, 'points'>): InkPoint[] {
  let points = cache.get(stroke.points);
  if (!points) cache.set(stroke.points, (points = decodePoints(stroke.points)));
  return points;
}

// ── Drawing ─────────────────────────────────────────────────────────────────

export const PEN_SIZES = [3, 6, 11] as const;
export const HIGHLIGHTER_SIZES = [16, 26, 40] as const;

/** A stroke's outline as an SVG path (filled, not stroked). `pressured`: false for a mouse or a finger (pressure is guessed from speed). */
export function strokePath(points: InkPoint[], tool: InkStroke['tool'], size: number, pressured = true, last = true): string {
  if (!points.length) return '';
  const outline = getStroke(points, {
    size,
    thinning: tool === 'highlighter' ? 0 : 0.55,
    smoothing: 0.5,
    streamline: tool === 'highlighter' ? 0.6 : 0.45,
    simulatePressure: !pressured,
    last,
    start: { cap: true },
    end: { cap: true },
  });
  if (outline.length < 2) return '';
  const r = (n: number) => Math.round(n * 10) / 10;
  // Smooth through the outline's midpoints.
  let d = `M${r(outline[0]![0])} ${r(outline[0]![1])} Q`;
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i]!;
    const [x1, y1] = outline[(i + 1) % outline.length]!;
    d += `${r(x0)} ${r(y0)} ${r((x0 + x1) / 2)} ${r((y0 + y1) / 2)} `;
  }
  return `${d.trimEnd()} Z`;
}

/** Whether a stroke's pressures are real (a pen) rather than all the same (a mouse or a finger). */
export const hasPressure = (points: InkPoint[]) => points.some((p) => Math.abs(p[2] - points[0]![2]) > 0.02);

/** A color as CSS: `ink` follows the theme; the rest are fixed, so they read the same on a map in either theme. */
export function inkColor(color: InkColor): string {
  if (color === 'ink') return 'var(--foreground)';
  const tones: Record<Exclude<InkColor, 'ink'>, string> = {
    gray: '#6b7280',
    orange: '#ea580c',
    green: '#16a34a',
    blue: '#2563eb',
    purple: '#7c3aed',
    red: '#dc2626',
    yellow: '#ca8a04',
  };
  return tones[color];
}

// ── Boxes and hits ──────────────────────────────────────────────────────────

export type Box = { x: number; y: number; w: number; h: number };

export function strokeBox(stroke: InkStroke): Box {
  const pts = pointsOf(stroke);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = stroke.size / 2;
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}

/** How far the bottom of the ink goes. */
export const inkBottom = (strokes: InkStroke[]) => unionBox(strokes.map(strokeBox))?.y ?? 0;

/** Distance from a point to a segment. */
function toSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Whether a stroke passes within `radius` of a point. */
export function strokeHit(stroke: InkStroke, x: number, y: number, radius: number): boolean {
  const pts = pointsOf(stroke);
  const reach = radius + stroke.size / 2;
  if (pts.length === 1) return Math.hypot(pts[0]![0] - x, pts[0]![1] - y) <= reach;
  for (let i = 1; i < pts.length; i++) if (toSegment(x, y, pts[i - 1]![0], pts[i - 1]![1], pts[i]![0], pts[i]![1]) <= reach) return true;
  return false;
}

// ── Erasing ─────────────────────────────────────────────────────────────────

/** The whole-stroke eraser: strokes the eraser touches go. */
export function eraseStrokes(strokes: InkStroke[], path: [number, number][], radius: number): InkStroke[] {
  return strokes.filter((s) => !path.some(([x, y]) => strokeHit(s, x, y, radius)));
}

/**
 * The partial eraser: only the points under the eraser go, so a stroke can
 * be cut in two (each piece keeps its color and size, with a new id).
 */
export function erasePoints(strokes: InkStroke[], path: [number, number][], radius: number, newId: () => string): InkStroke[] {
  const out: InkStroke[] = [];
  for (const stroke of strokes) {
    const reach = radius + stroke.size / 3;
    const pts = pointsOf(stroke);
    const keep = pts.map(([x, y]) => !path.some(([ex, ey]) => Math.hypot(ex - x, ey - y) <= reach));
    if (keep.every(Boolean)) {
      out.push(stroke);
      continue;
    }
    let run: InkPoint[] = [];
    const flush = () => {
      if (run.length >= 2) out.push({ ...stroke, id: newId(), points: encodePoints(run) });
      run = [];
    };
    pts.forEach((p, i) => (keep[i] ? run.push(p) : flush()));
    flush();
  }
  return out;
}

// ── The lasso ───────────────────────────────────────────────────────────────

export function insidePolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Strokes mostly inside the lasso (more than half their points). */
export function lassoed(strokes: InkStroke[], polygon: [number, number][]): string[] {
  if (polygon.length < 3) return [];
  return strokes
    .filter((s) => {
      const pts = pointsOf(s);
      return pts.filter(([x, y]) => insidePolygon(x, y, polygon)).length > pts.length / 2;
    })
    .map((s) => s.id);
}

/** Moves and scales strokes: each point goes from `from` to `to` (boxes), sizes scale too. */
export function transformStrokes(strokes: InkStroke[], ids: Set<string>, from: Box, to: Box): InkStroke[] {
  const sx = from.w ? to.w / from.w : 1;
  const sy = from.h ? to.h / from.h : 1;
  const scale = Math.sqrt(Math.abs(sx * sy)) || 1;
  return strokes.map((s) =>
    ids.has(s.id)
      ? {
          ...s,
          size: Math.max(1, Math.round(s.size * scale * 10) / 10),
          points: encodePoints(pointsOf(s).map(([x, y, p]) => [to.x + (x - from.x) * sx, to.y + (y - from.y) * sy, p] as InkPoint)),
        }
      : s,
  );
}

// ── As a picture ────────────────────────────────────────────────────────────

/** The ink as a standalone SVG (Export), cropped to what's drawn, in the given colors (CSS colors, so the theme's own when exported). */
export function inkSvg(strokes: InkStroke[], colors: (color: InkColor) => string, options: { background?: string | null; pad?: number } = {}): { svg: string; width: number; height: number } {
  const pad = options.pad ?? 24;
  const box = unionBox(strokes.map(strokeBox)) ?? { x: 0, y: 0, w: 1, h: 1 };
  const width = Math.ceil(box.w + pad * 2);
  const height = Math.ceil(box.h + pad * 2);
  const paths = [...strokes]
    .sort((a, b) => Number(b.tool === 'highlighter') - Number(a.tool === 'highlighter'))
    .map((s) => {
      const pts = pointsOf(s);
      const d = strokePath(pts, s.tool, s.size, hasPressure(pts));
      return `<path d="${d}" fill="${colors(s.color)}"${s.tool === 'highlighter' ? ' fill-opacity="0.35"' : ''}/>`;
    });
  const bg = options.background ? `<rect x="${box.x - pad}" y="${box.y - pad}" width="${width}" height="${height}" fill="${options.background}"/>` : '';
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${box.x - pad} ${box.y - pad} ${width} ${height}">${bg}${paths.join('')}</svg>`,
    width,
    height,
  };
}

/** Strokes as an SVG the size of what they're drawn on (`width` units across, `height` down): for drawing them onto a picture. */
export function inkFrameSvg(strokes: InkStroke[], width: number, height: number, colors: (color: InkColor) => string): string {
  const paths = [...strokes]
    .sort((a, b) => Number(b.tool === 'highlighter') - Number(a.tool === 'highlighter'))
    .map((s) => {
      const pts = pointsOf(s);
      return `<path d="${strokePath(pts, s.tool, s.size, hasPressure(pts))}" fill="${colors(s.color)}"${s.tool === 'highlighter' ? ' fill-opacity="0.35"' : ''}/>`;
    });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths.join('')}</svg>`;
}

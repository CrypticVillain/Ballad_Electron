/**
 * dice3d.ts — the dice as solids, for the 3D throw (components/tabletop/dice3d):
 * each die's corners and faces, which face (a d4: which corner) ends up on
 * top once it has stopped rolling, and the numbering that puts the rolled
 * number there. The roll itself is lib/tabletop.ts's; the throw is only shown. No
 * three.js here, so the tests run in Node. Tests beside it.
 */

export type Vec = [number, number, number];
/** A rotation as a quaternion [x, y, z, w]. */
export type Quat = [number, number, number, number];

export type Solid = {
  /** The die it is: 4, 6, 8, 10, 12, 20. */
  shape: number;
  /** Corners, at a circumradius of 1 (scale by the die's size). */
  vertices: Vec[];
  /** Faces as corner indexes, counterclockwise seen from outside. For kites (d10) the far corner comes first. */
  faces: number[][];
  /** A d4 is read at the corner that points up (each face shows its three corners' numbers); the rest by the face on top. */
  readAt: 'face' | 'vertex';
};

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a: Vec) => Math.sqrt(dot(a, a));
export const normalize = (a: Vec): Vec => scale(a, 1 / (length(a) || 1));

/** The centre of a face's corners. */
export function faceCenter(solid: Pick<Solid, 'vertices'>, face: number[]): Vec {
  return scale(face.reduce<Vec>((sum, i) => add(sum, solid.vertices[i]!), [0, 0, 0]), 1 / face.length);
}

/** A face's outward normal (Newell's method, so any polygon works). */
export function faceNormal(solid: Pick<Solid, 'vertices'>, face: number[]): Vec {
  const n: Vec = [0, 0, 0];
  face.forEach((index, k) => {
    const a = solid.vertices[index]!;
    const b = solid.vertices[face[(k + 1) % face.length]!]!;
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  });
  return normalize(n);
}

/** Orders a face's corners counterclockwise seen from outside, starting from the one farthest from its centre (a kite's tip). */
function orderFace(vertices: Vec[], corners: number[]): number[] {
  const center = faceCenter({ vertices }, corners);
  let normal = normalize(cross(sub(vertices[corners[1]!]!, vertices[corners[0]!]!), sub(vertices[corners[2]!]!, vertices[corners[0]!]!)));
  if (dot(normal, center) < 0) normal = scale(normal, -1);
  const u = normalize(sub(vertices[corners[0]!]!, center));
  const w = cross(normal, u);
  const angle = (i: number) => {
    const p = sub(vertices[i]!, center);
    return Math.atan2(dot(p, w), dot(p, u));
  };
  const ordered = [...corners].sort((a, b) => angle(a) - angle(b));
  const far = ordered.reduce((best, i) => (length(sub(vertices[i]!, center)) > length(sub(vertices[best]!, center)) + 1e-9 ? i : best), ordered[0]!);
  const at = ordered.indexOf(far);
  return [...ordered.slice(at), ...ordered.slice(0, at)];
}

/** A convex solid's faces from its corners alone: every plane through three corners with all the others behind it. */
function hullFaces(vertices: Vec[]): number[][] {
  const faces: number[][] = [];
  const seen = new Set<string>();
  const n = vertices.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        const [a, b, c] = [vertices[i]!, vertices[j]!, vertices[k]!];
        let normal = cross(sub(b, a), sub(c, a));
        if (length(normal) < 1e-9) continue;
        normal = normalize(normal);
        if (dot(normal, a) < 0) normal = scale(normal, -1);
        const d = dot(normal, a);
        const reach = vertices.map((v) => dot(normal, v) - d);
        if (reach.some((r) => r > 1e-6)) continue;
        const corners = vertices.map((_, index) => index).filter((index) => Math.abs(reach[index]!) <= 1e-6);
        const key = corners.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        faces.push(orderFace(vertices, corners));
      }
  return faces;
}

const unit = (vertices: Vec[]) => {
  const r = Math.max(...vertices.map(length));
  return vertices.map((v) => scale(v, 1 / r));
};

const PHI = (1 + Math.sqrt(5)) / 2;
const signs = [1, -1];
const each = <T>(f: (a: number, b: number, c: number) => T) => signs.flatMap((a) => signs.flatMap((b) => signs.map((c) => f(a, b, c))));

function build(shape: number): Solid {
  switch (shape) {
    case 4: {
      const vertices = unit([
        [1, 1, 1],
        [-1, -1, 1],
        [-1, 1, -1],
        [1, -1, -1],
      ]);
      return { shape, vertices, faces: hullFaces(vertices), readAt: 'vertex' };
    }
    case 6: {
      const vertices = unit(each((a, b, c) => [a, b, c] as Vec));
      return { shape, vertices, faces: hullFaces(vertices), readAt: 'face' };
    }
    case 8: {
      const vertices: Vec[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      return { shape, vertices, faces: hullFaces(vertices), readAt: 'face' };
    }
    case 12: {
      const vertices = unit([
        ...each((a, b, c) => [a, b, c] as Vec),
        ...signs.flatMap((a) => signs.flatMap((b) => [[0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [a * PHI, 0, b / PHI]] as Vec[])),
      ]);
      return { shape, vertices, faces: hullFaces(vertices), readAt: 'face' };
    }
    case 20: {
      const vertices = unit(signs.flatMap((a) => signs.flatMap((b) => [[0, a, b * PHI], [a, b * PHI, 0], [a * PHI, 0, b]] as Vec[])));
      return { shape, vertices, faces: hullFaces(vertices), readAt: 'face' };
    }
    case 10: {
      // A pentagonal trapezohedron: two rings of five, a little above and below the middle, and two tips. The tips'
      // height makes each kite flat: H = k (1 + cos 36°) / (1 − cos 36°).
      const k = 0.1;
      const c36 = Math.cos(Math.PI / 5);
      const tip = (k * (1 + c36)) / (1 - c36);
      const ring: Vec[] = Array.from({ length: 10 }, (_, i) => [Math.cos((i * Math.PI) / 5), i % 2 ? -k : k, Math.sin((i * Math.PI) / 5)] as Vec);
      const vertices = unit([...ring, [0, tip, 0], [0, -tip, 0]]);
      const faces = Array.from({ length: 5 }, (_, j) => [
        orderFace(vertices, [10, 2 * j, 2 * j + 1, (2 * j + 2) % 10]),
        orderFace(vertices, [11, 2 * j + 1, (2 * j + 2) % 10, (2 * j + 3) % 10]),
      ]).flat();
      return { shape, vertices, faces, readAt: 'face' };
    }
    default:
      return build(6);
  }
}

const SOLIDS = new Map<number, Solid>();

/** The solid a die is drawn as: its own, or (a d3, a d7…) a cube. */
export function solidFor(sides: number): Solid {
  const shape = [4, 6, 8, 10, 12, 20].includes(sides) ? sides : sides === 100 ? 10 : 6;
  let solid = SOLIDS.get(shape);
  if (!solid) SOLIDS.set(shape, (solid = build(shape)));
  return solid;
}

/** Rotates a vector by a quaternion. */
export function rotate(v: Vec, [x, y, z, w]: Quat): Vec {
  const q: Vec = [x, y, z];
  const t = scale(cross(q, v), 2);
  return add(add(v, scale(t, w)), cross(q, t));
}

/** Which face (a d4: which corner) points up once the die has stopped, turned by `rotation`. */
export function upward(solid: Solid, rotation: Quat): number {
  const heights = solid.readAt === 'vertex' ? solid.vertices.map((v) => rotate(v, rotation)[1]) : solid.faces.map((f) => rotate(faceNormal(solid, f), rotation)[1]);
  return heights.indexOf(Math.max(...heights));
}

/**
 * The numbers on a die's faces (a d4's corners), so the one on top reads
 * `value`: the die's own numbers, with `value` swapped onto the top. A d100
 * is a pair of d10s ("40" and "7"); a die that isn't one of the six (a d3) a
 * cube, its numbers repeating.
 */
export function numbering(solid: Solid, sides: number, top: number, value: string, faces: string[] = defaultNumbers(solid, sides)): string[] {
  const labels = [...faces];
  const at = labels.indexOf(value);
  if (at >= 0) [labels[at], labels[top]] = [labels[top]!, labels[at]!];
  else labels[top] = value;
  return labels;
}

function defaultNumbers(solid: Solid, sides: number): string[] {
  const count = solid.readAt === 'vertex' ? solid.vertices.length : solid.faces.length;
  return Array.from({ length: count }, (_, i) => String((i % sides) + 1));
}

/** A d100's two d10s: the tens ("00"…"90") and the units ("0"…"9"). 100 is "00" and "0". */
export function percentile(value: number): { tens: string; units: string } {
  const v = value % 100;
  return { tens: String(Math.floor(v / 10) * 10).padStart(2, '0'), units: String(v % 10) };
}
export const TENS = Array.from({ length: 10 }, (_, i) => String(i * 10).padStart(2, '0'));
export const UNITS = Array.from({ length: 10 }, (_, i) => String(i));

import { BufferGeometry, Float32BufferAttribute, Mesh, type Material } from 'three';
import { dot, faceCenter, faceNormal, normalize, type Solid, type Vec } from '@/lib/dice3d';
import type { DiceLook } from '@/lib/diceLooks';
import { faceTextures, LOOKS } from './looks';

/** How big each die is, in table units (a cube's corner is this far from its middle). */
export const DIE_RADIUS: Record<number, number> = { 4: 1.3, 6: 1.02, 8: 1.12, 10: 1.08, 12: 1.14, 20: 1.2 };

/** `reach`: how far a face's corners are from its middle, in table units (what the painted polygon spans). */
type Built = { geometry: BufferGeometry; polygon: [number, number][]; reach: number };
const GEOMETRY = new Map<string, Built>();

/** How far each face's corners pull in toward its middle: the width of the rounded edges, as a share of the face. */
const BEVEL = 0.13;

/**
 * A solid as a mesh with rounded edges (a chamfer): each face pulled in a
 * little, a strip along every edge and a small cap at every corner between
 * them. The strips and caps blend the normals of the faces they join, so the
 * light rolls round the edge the way it does on a real die. Each face is its
 * own group (its own material, so its own number), the strips and caps going
 * with the face beside them, painted with its plain stock. Every face maps to
 * the same polygon (starting from the same corner), so one painted shape fits
 * them all.
 */
export function dieGeometry(solid: Solid, radius: number): Built {
  const key = `${solid.shape}|${radius}`;
  const hit = GEOMETRY.get(key);
  if (hit) return hit;
  const groups = solid.faces.map(() => ({ positions: [] as number[], normals: [] as number[], uvs: [] as number[] }));
  const PLAIN: [number, number] = [0.02, 0.02];
  let polygon: [number, number][] = [];
  let faceReach = 1;

  const normalsOf = solid.faces.map((face) => faceNormal(solid, face));
  /** Where a corner of a face ends up, pulled in toward the face's middle. */
  const pulled = solid.faces.map((face) => {
    const c = faceCenter(solid, face);
    return face.map((i) => {
      const v = solid.vertices[i]!;
      return [v[0] + (c[0] - v[0]) * BEVEL, v[1] + (c[1] - v[1]) * BEVEL, v[2] + (c[2] - v[2]) * BEVEL] as Vec;
    });
  });
  /** A triangle, wound to face outward (every die is convex round its middle). */
  const tri = (g: number, pts: [Vec, Vec, Vec], ns: [Vec, Vec, Vec], uv: [[number, number], [number, number], [number, number]]) => {
    const [a, b, c] = pts;
    const n: Vec = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
    const out: Vec = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const order = dot(n, out) >= 0 ? [0, 1, 2] : [0, 2, 1];
    const into = groups[g]!;
    for (const k of order) {
      into.positions.push(pts[k]![0] * radius, pts[k]![1] * radius, pts[k]![2] * radius);
      into.normals.push(...ns[k]!);
      into.uvs.push(...uv[k]!);
    }
  };

  // The faces, pulled in.
  solid.faces.forEach((face, f) => {
    const n = normalsOf[f]!;
    const pts = pulled[f]!;
    const center = faceCenter(solid, face);
    const u = normalize([pts[0]![0] - center[0], pts[0]![1] - center[1], pts[0]![2] - center[2]]);
    const w: Vec = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    const flat = pts.map((p) => {
      const d: Vec = [p[0] - center[0], p[1] - center[1], p[2] - center[2]];
      return [dot(d, u), dot(d, w)] as [number, number];
    });
    const reach = Math.max(...flat.map(([x, y]) => Math.hypot(x, y)));
    const uv = flat.map(([x, y]) => [0.5 + (x / reach) * 0.47, 0.5 + (y / reach) * 0.47] as [number, number]);
    if (f === 0) {
      polygon = uv;
      faceReach = reach * radius;
    }
    face.forEach((_, k) => {
      const next = (k + 1) % face.length;
      tri(f, [center, pts[k]!, pts[next]!], [n, n, n], [[0.5, 0.5], uv[k]!, uv[next]!]);
    });
  });

  // A strip along each edge, between the two faces that share it.
  solid.faces.forEach((face, f) => {
    face.forEach((a, k) => {
      const b = face[(k + 1) % face.length]!;
      const g = solid.faces.findIndex((other, o) => o !== f && other.includes(a) && other.includes(b));
      if (g < f) return; // once per edge
      const other = solid.faces[g]!;
      const af = pulled[f]![k]!;
      const bf = pulled[f]![(k + 1) % face.length]!;
      const ag = pulled[g]![other.indexOf(a)]!;
      const bg = pulled[g]![other.indexOf(b)]!;
      const nf = normalsOf[f]!;
      const ng = normalsOf[g]!;
      tri(f, [af, bf, bg], [nf, nf, ng], [PLAIN, PLAIN, PLAIN]);
      tri(g, [af, bg, ag], [nf, ng, ng], [PLAIN, PLAIN, PLAIN]);
    });
  });

  // A cap at each corner, where its faces' pulled-in corners meet.
  solid.vertices.forEach((v, i) => {
    const around = solid.faces.map((face, f) => ({ face, f })).filter(({ face }) => face.includes(i));
    const outward = normalize(v);
    const ref = normalize(sub(pulled[around[0]!.f]![around[0]!.face.indexOf(i)]!, v));
    const side: Vec = [outward[1] * ref[2] - outward[2] * ref[1], outward[2] * ref[0] - outward[0] * ref[2], outward[0] * ref[1] - outward[1] * ref[0]];
    const ring = around
      .map(({ face, f }) => {
        const p = pulled[f]![face.indexOf(i)]!;
        const d = sub(p, v);
        return { p, n: normalsOf[f]!, f, angle: Math.atan2(dot(d, side), dot(d, ref)) };
      })
      .sort((x, y) => x.angle - y.angle);
    const middle = ring.reduce<Vec>((m, r) => [m[0] + r.p[0] / ring.length, m[1] + r.p[1] / ring.length, m[2] + r.p[2] / ring.length], [0, 0, 0]);
    ring.forEach((r, k) => {
      const s = ring[(k + 1) % ring.length]!;
      tri(r.f, [middle, r.p, s.p], [outward, r.n, s.n], [PLAIN, PLAIN, PLAIN]);
    });
  });

  const geometry = new BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  groups.forEach((group, f) => {
    const start = positions.length / 3;
    positions.push(...group.positions);
    normals.push(...group.normals);
    uvs.push(...group.uvs);
    geometry.addGroup(start, group.positions.length / 3, f);
  });
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  const built = { geometry, polygon, reach: faceReach };
  GEOMETRY.set(key, built);
  return built;
}

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** A die in a look with its numbers: per face (a d4: per corner, each face showing its three). */
export function dieMesh(solid: Solid, look: DiceLook, labels: string[]): Mesh {
  const radius = DIE_RADIUS[solid.shape] ?? 1;
  const { geometry, polygon, reach } = dieGeometry(solid, radius);
  const materials: Material[] = solid.faces.map((face, f) => {
    const corners = solid.readAt === 'vertex';
    return LOOKS[look].material(faceTextures(look, polygon, corners ? face.map((i) => labels[i] ?? '') : [labels[f] ?? ''], corners, reach));
  });
  const mesh = new Mesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Dims a die advantage set aside, once it has landed. */
export function fade(mesh: Mesh, opacity: number) {
  for (const material of mesh.material as Material[]) {
    material.transparent = opacity < 1;
    material.opacity = opacity;
    material.needsUpdate = true;
  }
}

export function disposeMesh(mesh: Mesh) {
  for (const material of mesh.material as Material[]) material.dispose();
}

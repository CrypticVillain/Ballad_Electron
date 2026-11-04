import { CanvasTexture, MeshPhysicalMaterial, MeshStandardMaterial, SRGBColorSpace, type Material } from 'three';
import type { DiceLook } from '@/lib/diceLooks';

/**
 * The dice looks in 3D (names and genres: lib/diceLooks.ts). Each paints a
 * face onto a canvas (its stock, a line inside the edge, the number) and
 * dresses the die in a material: glossy, metal, stone. A look can paint its
 * numbers into two more maps: an emissive one (they glow: neon, phosphor,
 * embers) and a metalness one (gold leaf, silver, brass on a stone die).
 */
export type Textures = { map: CanvasTexture; emissive: CanvasTexture | null; metal: CanvasTexture | null };

type Look = {
  /** The numbers' font, "{px}" for the size. */
  font: string;
  ink: string;
  /** Bigger or smaller numbers than the face's usual. */
  scale?: number;
  /** Paints the face's stock across the whole canvas (it shows on the rounded edges too). */
  stock: (ctx: CanvasRenderingContext2D, size: number) => void;
  /** A soft shade just inside each face's edge. */
  rim?: string;
  /** A line inside each face's edge, `inset` in from every edge: solid, or dots set corner to corner; `glow` lights it. */
  line?: { color: string; width: number; inset: number; dots?: boolean; glow?: boolean };
  /** The numbers glow this color (an emissive map). */
  glow?: string;
  /** The numbers are metal (a metalness map): gold leaf, silver. */
  metalNumbers?: boolean;
  /** 6 and 9 are told apart by a row of dots instead of a bar (in this color, else the ink). */
  dottedMark?: string | true;
  /** A dark edge round the numbers, so they read on a busy or shiny stock. */
  outline?: string;
  /** The numbers drawn as a 5×7 grid of dots (the unlit dots faint behind), not set in a font. */
  matrix?: { off: string; dot: number };
  /** For a glow look: no halo painted round the numbers on the die itself (the emissive map still lights them). */
  noHalo?: boolean;
  material: (t: Textures) => Material;
};

const ORANGE = '#ff4a1c';

/** A seeded random, so a look's grain is the same on every face and every time. */
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function radial(ctx: CanvasRenderingContext2D, size: number, stops: [number, string][], cx = 0.42, cy = 0.38) {
  const g = ctx.createRadialGradient(size * cx, size * cy, size * 0.02, size / 2, size / 2, size * 0.75);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

function blobs(ctx: CanvasRenderingContext2D, size: number, colors: string[], count: number, seed: number, reach = 0.45) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = size * (0.12 + r() * reach);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, colors[i % colors.length]!);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
}

function veins(ctx: CanvasRenderingContext2D, size: number, color: string, count: number, seed: number, width = 1.5) {
  const r = rng(seed);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    ctx.lineWidth = width * (0.5 + r());
    ctx.beginPath();
    let x = r() * size;
    let y = r() * size;
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (r() - 0.5) * size * 0.35;
      y += (r() - 0.4) * size * 0.3;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function speckle(ctx: CanvasRenderingContext2D, size: number, count: number, color: (r: number) => string, seed: number, big = 2) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = color(r());
    const s = 0.6 + r() * big;
    ctx.beginPath();
    ctx.arc(r() * size, r() * size, s / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function brushed(ctx: CanvasRenderingContext2D, size: number, light: number, dark: number, seed: number) {
  const r = rng(seed);
  for (let y = 0; y < size; y++) {
    ctx.fillStyle = r() > 0.5 ? `rgba(255,255,255,${r() * light})` : `rgba(0,0,0,${r() * dark})`;
    ctx.fillRect(0, y, size, 1);
  }
}

const gem = (center: string, mid: string, edge: string, glint: number) => (ctx: CanvasRenderingContext2D, size: number) => {
  radial(ctx, size, [
    [0, center],
    [0.5, mid],
    [1, edge],
  ]);
  // Facets catching the light.
  const r = rng(glint);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.07})`;
    ctx.beginPath();
    ctx.moveTo(r() * size, r() * size);
    ctx.lineTo(r() * size, r() * size);
    ctx.lineTo(r() * size, r() * size);
    ctx.fill();
  }
};

/**
 * Ballad's dot matrix, light or dark: the numbers as 5×7 dots (the unlit dots
 * faint behind), a ring of orange dots inside every edge, orange dots under 6
 * and 9, a faint dot grid across the die. Dark, the numbers and the ring are
 * lit, like a display.
 */
function dotMatrix(c: { stock: string; grid: string; ink: string; off: string; dot: number; rim: string; lit?: boolean }): Look {
  return {
    font: "900 {px}px 'Doto', 'Geist Mono', monospace",
    ink: c.ink,
    matrix: { off: c.off, dot: c.dot },
    dottedMark: ORANGE,
    noHalo: true,
    glow: c.lit ? c.ink : undefined,
    stock: (ctx, size) => {
      ctx.fillStyle = c.stock;
      ctx.fillRect(0, 0, size, size);
      const step = size / 34;
      ctx.fillStyle = c.grid;
      for (let x = step / 2; x < size; x += step)
        for (let y = step / 2; y < size; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, step * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
    },
    rim: c.rim,
    line: { color: ORANGE, width: 0.032, inset: 0.04, dots: true, glow: c.lit },
    material: c.lit
      ? ({ map, emissive }) =>
          new MeshPhysicalMaterial({ map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 })
      : ({ map }) => new MeshPhysicalMaterial({ map, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.25 }),
  };
}

export const LOOKS: Record<DiceLook, Look> = {
  display: dotMatrix({ stock: '#f7f6f2', grid: '#e4e1d9', ink: '#050505', off: 'rgba(0,0,0,0.05)', dot: 0.6, rim: 'rgba(0,0,0,0.08)' }),
  'display-dark': dotMatrix({ stock: '#121316', grid: '#23252a', ink: '#f4f2ec', off: 'rgba(255,255,255,0.06)', dot: 0.52, rim: 'rgba(0,0,0,0.4)', lit: true }),
  ivory: {
    font: "800 {px}px 'Inter Tight', 'Geist', sans-serif",
    ink: '#151515',
    stock: (ctx, size) =>
      radial(ctx, size, [
        [0, '#fffbf0'],
        [1, '#e6d9bd'],
      ]),
    rim: 'rgba(120,96,50,0.16)',
    material: ({ map }) => new MeshPhysicalMaterial({ map, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
  },
  obsidian: {
    font: "700 {px}px 'Literata', Georgia, serif",
    ink: '#e9ba4c',
    metalNumbers: true,
    stock: (ctx, size) => {
      ctx.fillStyle = '#0b0b0d';
      ctx.fillRect(0, 0, size, size);
      veins(ctx, size, 'rgba(255,255,255,0.045)', 7, 11, 3);
    },
    material: ({ map, metal }) => new MeshStandardMaterial({ map, metalnessMap: metal, metalness: 1, roughness: 0.2 }),
  },
  ruby: {
    font: "700 {px}px 'Literata', Georgia, serif",
    ink: '#ffd772',
    outline: 'rgba(70,0,14,0.9)',
    stock: gem('#ff5a6e', '#b3122e', '#45040f', 5),
    material: ({ map }) =>
      new MeshPhysicalMaterial({ map, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0x5a0012, emissiveIntensity: 0.6 }),
  },
  sapphire: {
    font: "700 {px}px 'Literata', Georgia, serif",
    ink: '#ffffff',
    outline: 'rgba(4,18,66,0.9)',
    stock: gem('#a6dcff', '#2259cc', '#08194d', 9),
    material: ({ map }) =>
      new MeshPhysicalMaterial({ map, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0x061f5c, emissiveIntensity: 0.6 }),
  },
  jade: {
    font: "700 {px}px 'Literata', Georgia, serif",
    ink: '#f6d880',
    outline: 'rgba(8,38,24,0.9)',
    stock: (ctx, size) => {
      ctx.fillStyle = '#2e7a57';
      ctx.fillRect(0, 0, size, size);
      blobs(ctx, size, ['rgba(20,70,48,0.8)', 'rgba(90,170,125,0.6)'], 9, 21);
      veins(ctx, size, 'rgba(235,255,240,0.28)', 6, 23, 2);
    },
    material: ({ map }) => new MeshPhysicalMaterial({ map, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  },
  nebula: {
    font: "800 {px}px 'Inter Tight', 'Geist', sans-serif",
    ink: '#ffffff',
    glow: '#d9c4ff',
    stock: (ctx, size) => {
      ctx.fillStyle = '#0a0822';
      ctx.fillRect(0, 0, size, size);
      blobs(ctx, size, ['rgba(124,63,228,0.75)', 'rgba(224,74,179,0.5)', 'rgba(38,198,198,0.45)'], 7, 31, 0.5);
      speckle(ctx, size, 70, (r) => `rgba(255,255,255,${0.4 + r * 0.6})`, 33, 2.4);
    },
    material: ({ map, emissive }) =>
      new MeshPhysicalMaterial({ map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
  },
  oak: {
    font: "800 {px}px 'Literata', Georgia, serif",
    ink: '#0c0401',
    glow: '#ff5a14',
    noHalo: true,
    outline: 'rgba(255,190,120,0.25)',
    stock: (ctx, size) => {
      const r = rng(41);
      for (let y = 0; y < size; y++) {
        const t = 0.5 + 0.5 * Math.sin(y * 0.16 + Math.sin(y * 0.05) * 3);
        const c = [Math.round(112 + t * 38), Math.round(66 + t * 28), Math.round(32 + t * 18)];
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillRect(0, y, size, 1);
        if (r() > 0.86) {
          ctx.fillStyle = 'rgba(60,30,10,0.35)';
          ctx.fillRect(0, y, size, 1);
        }
      }
    },
    rim: 'rgba(50,24,8,0.35)',
    material: ({ map, emissive }) => new MeshStandardMaterial({ map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.68 }),
  },
  steel: {
    font: "700 {px}px 'Space Grotesk', 'Geist', sans-serif",
    ink: '#d9a640',
    stock: (ctx, size) => {
      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, '#7a8088');
      g.addColorStop(1, '#4b5058');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      brushed(ctx, size, 0.08, 0.1, 51);
    },
    line: { color: 'rgba(18,20,24,0.55)', width: 0.014, inset: 0.072 },
    material: ({ map }) => new MeshStandardMaterial({ map, metalness: 0.9, roughness: 0.36 }),
  },
  bone: {
    font: "700 {px}px 'Literata', Georgia, serif",
    ink: '#5c1a12',
    stock: (ctx, size) => {
      ctx.fillStyle = '#e3d6b8';
      ctx.fillRect(0, 0, size, size);
      blobs(ctx, size, ['rgba(190,168,118,0.55)', 'rgba(245,238,220,0.6)'], 8, 61, 0.35);
      speckle(ctx, size, 110, () => 'rgba(110,88,50,0.35)', 63, 1.2);
      veins(ctx, size, 'rgba(85,64,36,0.55)', 4, 67, 1);
    },
    rim: 'rgba(110,86,44,0.35)',
    material: ({ map }) => new MeshStandardMaterial({ map, roughness: 0.82 }),
  },
  neon: {
    font: "800 {px}px 'JetBrains Mono', 'Geist Mono', monospace",
    ink: '#33f4ff',
    glow: '#33f4ff',
    stock: (ctx, size) => {
      ctx.fillStyle = '#07070d';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(255,43,214,0.2)';
      ctx.lineWidth = 1;
      const step = size / 12;
      for (let i = step; i < size; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();
      }
    },
    line: { color: '#ff2bd6', width: 0.022, inset: 0.06, glow: true },
    material: ({ map, emissive }) => new MeshStandardMaterial({ map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.22, metalness: 0.3 }),
  },
  phosphor: {
    font: "700 {px}px 'JetBrains Mono', 'Geist Mono', monospace",
    ink: '#3dff6e',
    glow: '#3dff6e',
    stock: (ctx, size) => {
      radial(ctx, size, [
        [0, '#0b2412'],
        [1, '#020904'],
      ]);
      ctx.fillStyle = 'rgba(61,255,110,0.07)';
      for (let y = 0; y < size; y += 3) ctx.fillRect(0, y, size, 1);
    },
    material: ({ map, emissive }) => new MeshStandardMaterial({ map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 1.8, roughness: 0.38 }),
  },
  chrome: {
    font: "700 {px}px 'Space Grotesk', 'Geist', sans-serif",
    ink: '#0f0f12',
    stock: (ctx, size) => {
      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, '#f6f8fb');
      g.addColorStop(0.5, '#c9ced5');
      g.addColorStop(1, '#eef1f4');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    },
    material: ({ map }) => new MeshStandardMaterial({ map, metalness: 1, roughness: 0.07 }),
  },
};

/** The numbers' font at a size, loaded before a face is painted (the canvas falls back silently otherwise). */
export function lookFont(look: DiceLook, px = 64) {
  return LOOKS[look].font.replace('{px}', String(px));
}

const SIZE = 256;
/** The face size (corner to middle, table units) a look's line and dots are drawn for; on bigger or smaller faces they're scaled to stay the same size on the die. */
const FACE_REACH = 0.65;
const cache = new Map<string, Textures>();

/**
 * A face's textures: its polygon (in UV, 0-1, the same for every face of a
 * die) painted in the look, with one number in the middle or (a d4) a number
 * near each corner, pointing at it. 6 and 9 are marked, as on real dice.
 * `reach` is the face's size on the die (corner to middle, table units), so
 * a line or ring of dots comes out the same size on every die. Cached, the
 * oldest dropped past a hundred and sixty.
 */
export function faceTextures(look: DiceLook, polygon: [number, number][], labels: string[], corners: boolean, reach = FACE_REACH): Textures {
  const key = `${look}|${polygon.length}|${corners ? 'c' : 'f'}|${reach.toFixed(3)}|${polygon[0]!.join(',')}|${labels.join(',')}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const style = LOOKS[look];
  const points = polygon.map(([u, v]) => [u * SIZE, (1 - v) * SIZE] as [number, number]);
  const center = points.reduce<[number, number]>((c, p) => [c[0] + p[0] / points.length, c[1] + p[1] / points.length], [0, 0]);
  const inradius = Math.min(...points.map((p, i) => distanceToEdge(center, p, points[(i + 1) % points.length]!)));
  const scale = style.scale ?? 1;
  /** Table units to canvas pixels, against the size the look was drawn for. */
  const k = FACE_REACH / reach;
  const ring = style.line ? offset(points, SIZE * style.line.inset * k) : null;

  /** color: the face as seen; glow: what shines (numbers, a lit line) on black; metal: the numbers in white on black. */
  const paint = (ctx: CanvasRenderingContext2D, mode: 'color' | 'glow' | 'metal') => {
    if (mode === 'color') {
      style.stock(ctx, SIZE);
      if (style.rim) {
        ctx.save();
        path(ctx, points);
        ctx.clip();
        ctx.lineJoin = 'round';
        ctx.strokeStyle = style.rim;
        ctx.lineWidth = SIZE * 0.05;
        path(ctx, points);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, SIZE, SIZE);
    }
    const line = style.line;
    if (line && (mode === 'color' || (mode === 'glow' && line.glow))) {
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle = line.color;
      ctx.lineWidth = SIZE * line.width * k;
      ctx.lineJoin = 'round';
      if (mode === 'color' && line.glow) {
        ctx.shadowColor = line.color;
        ctx.shadowBlur = SIZE * 0.03;
      }
      if (line.dots) {
        dotRing(ctx, ring!, (SIZE * line.width * k) / 2, SIZE * line.width * k * 2.6);
      } else {
        path(ctx, ring!);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.fillStyle = mode === 'metal' ? '#fff' : mode === 'glow' ? (style.glow ?? style.ink) : style.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (mode === 'color' && style.glow && !style.noHalo) {
      ctx.shadowColor = style.glow;
      ctx.shadowBlur = SIZE * 0.035;
    }
    const ink = ctx.fillStyle as string;
    /** One label, centred on (x, y) at a size, in the font with its edge. */
    const write = (label: string, x: number, y: number, px: number) => {
      ctx.font = lookFont(look, px);
      if (style.outline && mode === 'color') {
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.lineJoin = 'round';
        ctx.lineWidth = px * 0.13;
        ctx.strokeStyle = style.outline;
        ctx.strokeText(label, x, y);
        ctx.restore();
      }
      ctx.fillText(label, x, y);
    };
    if (style.matrix) {
      const off = mode === 'color' ? style.matrix.off : null;
      const mark = mode === 'metal' ? ink : typeof style.dottedMark === 'string' ? style.dottedMark : ink;
      const room = ring ?? offset(points, SIZE * 0.06 * k);
      const gap = SIZE * k * (style.line ? style.line.width / 2 + 0.01 : 0.02);
      const at = corners ? labels.map((_, i) => cornerSpot(room, i, gap)) : [faceSpot(room, labels[0] ?? '', gap, inradius)];
      at.forEach((spot, i) => {
        ctx.save();
        ctx.translate(spot.x, spot.y);
        ctx.rotate(spot.angle);
        matrixLabel(ctx, labels[i] ?? '', spot.cell, ink, off, mark, style.matrix!.dot);
        ctx.restore();
      });
    } else if (corners) {
      // A d4: each corner's number near it, its top toward the corner.
      points.forEach((p, i) => {
        const at: [number, number] = [center[0] + (p[0] - center[0]) * 0.55, center[1] + (p[1] - center[1]) * 0.55];
        ctx.save();
        ctx.translate(at[0], at[1]);
        ctx.rotate(Math.atan2(p[1] - center[1], p[0] - center[0]) + Math.PI / 2);
        write(labels[i] ?? '', 0, 0, Math.round(inradius * 0.86 * scale));
        ctx.restore();
      });
    } else {
      const label = labels[0] ?? '';
      const px = Math.round(inradius * (label.length > 2 ? 0.8 : label.length > 1 ? 1.02 : 1.24) * scale);
      write(label, center[0], center[1] + px * 0.04, px);
      if (label === '6' || label === '9') {
        const y = center[1] + px * 0.54;
        if (style.dottedMark) {
          if (typeof style.dottedMark === 'string' && mode === 'color') ctx.fillStyle = style.dottedMark;
          for (const dx of [-1, 0, 1]) {
            ctx.beginPath();
            ctx.arc(center[0] + dx * px * 0.16, y, px * 0.055, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          ctx.fillRect(center[0] - px * 0.22, y - px * 0.035, px * 0.44, Math.max(2, px * 0.07));
        }
      }
    }
    ctx.shadowBlur = 0;
  };

  const texture = (mode: 'color' | 'glow' | 'metal') => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    paint(canvas.getContext('2d')!, mode);
    const t = new CanvasTexture(canvas);
    if (mode !== 'metal') t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const textures: Textures = {
    map: texture('color'),
    emissive: style.glow || style.line?.glow ? texture('glow') : null,
    metal: style.metalNumbers ? texture('metal') : null,
  };
  cache.set(key, textures);
  if (cache.size > 160) {
    const [oldest, old] = cache.entries().next().value as [string, Textures];
    cache.delete(oldest);
    old.map.dispose();
    old.emissive?.dispose();
    old.metal?.dispose();
  }
  return textures;
}

/** Digits on a 5×7 grid, a row per string (the classic dot-matrix face). */
const GLYPHS: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};

/**
 * Text as dots, centred on (x, y), `height` tall: the lit dots in `on`, `dot`
 * cells across (over half and they touch, which keeps a small number dark
 * when the die is far off), the unlit ones (if `off`) faintly behind.
 */
function matrixText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, height: number, on: string, off: string | null, dot: number) {
  const cell = height / 7;
  const chars = [...text].filter((c) => GLYPHS[c]);
  const width = chars.length * 5 * cell + Math.max(0, chars.length - 1) * TRACKING * cell;
  const left = x - width / 2 + cell / 2;
  const top = y - height / 2 + cell / 2;
  chars.forEach((c, n) => {
    GLYPHS[c]!.forEach((row, r) =>
      [...row].forEach((bit, k) => {
        if (bit === '0' && !off) return;
        ctx.fillStyle = bit === '1' ? on : off!;
        ctx.beginPath();
        ctx.arc(left + (n * (5 + TRACKING) + k) * cell, top + r * cell, cell * (bit === '1' ? dot : 0.3), 0, Math.PI * 2);
        ctx.fill();
      }),
    );
  });
  ctx.fillStyle = on;
}

function path(ctx: CanvasRenderingContext2D, points: [number, number][]) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

type Pt = [number, number];

/** Each edge of a convex polygon as a point on it, its direction and its unit normal pointing in. */
function edges(points: Pt[]) {
  const c = points.reduce<Pt>((m, p) => [m[0] + p[0] / points.length, m[1] + p[1] / points.length], [0, 0]);
  return points.map((a, i) => {
    const b = points[(i + 1) % points.length]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let n: Pt = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
    if (n[0] * (c[0] - a[0]) + n[1] * (c[1] - a[1]) < 0) n = [-n[0], -n[1]];
    return { a, d: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] as Pt, n };
  });
}

/** A convex polygon with every edge moved `by` straight in (so the gap to the edge is the same all round, on a kite too). */
function offset(points: Pt[], by: number): Pt[] {
  const lines = edges(points).map(({ a, d, n }) => ({ p: [a[0] + n[0] * by, a[1] + n[1] * by] as Pt, d }));
  return lines.map((line, i) => {
    const prev = lines[(i + lines.length - 1) % lines.length]!;
    const cross = prev.d[0] * line.d[1] - prev.d[1] * line.d[0] || 1e-9;
    const t = ((line.p[0] - prev.p[0]) * line.d[1] - (line.p[1] - prev.p[1]) * line.d[0]) / cross;
    return [prev.p[0] + prev.d[0] * t, prev.p[1] + prev.d[1] * t] as Pt;
  });
}

/** Whether a point is inside a convex polygon with at least `margin` to spare from every edge. */
function inside(points: Pt[], p: Pt, margin: number) {
  return edges(points).every(({ a, n }) => (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1] >= margin);
}

/** A ring of dots along a polygon: one on every corner, the rest spaced evenly along each edge. */
function dotRing(ctx: CanvasRenderingContext2D, ring: Pt[], radius: number, spacing: number) {
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    const count = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / spacing));
    for (let k = 0; k < count; k++) {
      ctx.beginPath();
      ctx.arc(a[0] + ((b[0] - a[0]) * k) / count, a[1] + ((b[1] - a[1]) * k) / count, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Where a dot-matrix number sits: its middle, its turn, and its dot spacing. */
type Spot = { x: number; y: number; angle: number; cell: number };

/** The space between two digits, in cells (less than a full cell: two-digit numbers have little room on a d20). */
const TRACKING = 0.7;

/** A number's size in cells (5×7 a digit, the tracking between digits, a row of dots under 6 and 9). */
function matrixBox(label: string): [number, number] {
  return [Math.max(1, 5 * label.length + TRACKING * (label.length - 1)), label === '6' || label === '9' ? 8.7 : 7];
}

/** The biggest cell at which a box (in cells, turned by `angle`, centred on x, y) stays inside the room. */
function fitCell(room: Pt[], gap: number, x: number, y: number, angle: number, box: [number, number]) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const fits = (cell: number) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].every(([sx, sy]) => {
      const lx = (sx! * box[0] * cell) / 2;
      const ly = (sy! * box[1] * cell) / 2;
      return inside(room, [x + lx * cos - ly * sin, y + lx * sin + ly * cos], gap);
    });
  let lo = 0;
  let hi = SIZE * 0.06;
  for (let k = 0; k < 18; k++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * A face's one number: as big as fits inside the ring (no bigger than a
 * comfortable size for the face), centred, or nudged up or down when that
 * gives it clearly more room (the wide end of a d10's kite).
 */
function faceSpot(room: Pt[], label: string, gap: number, inradius: number): Spot {
  const box = matrixBox(label);
  const c = room.reduce<Pt>((m, p) => [m[0] + p[0] / room.length, m[1] + p[1] / room.length], [0, 0]);
  let best: Spot = { x: c[0], y: c[1], angle: 0, cell: fitCell(room, gap, c[0], c[1], 0, box) };
  for (const k of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8, 9, -9, 10, -10]) {
    const y = c[1] + k * inradius * 0.035;
    const cell = fitCell(room, gap, c[0], y, 0, box);
    if (cell > best.cell * 1.04) best = { x: c[0], y, angle: 0, cell };
  }
  best.cell = Math.min(best.cell, (inradius * 0.92) / 7);
  return best;
}

/** A d4's number by one corner, its top toward it, kept to that corner's share of the face. */
function cornerSpot(room: Pt[], i: number, gap: number): Spot {
  const n = room.length;
  const c = room.reduce<Pt>((m, p) => [m[0] + p[0] / n, m[1] + p[1] / n], [0, 0]);
  const corner = room[i]!;
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const share = [c, mid(room[(i + n - 1) % n]!, corner), corner, mid(corner, room[(i + 1) % n]!)];
  const angle = Math.atan2(corner[1] - c[1], corner[0] - c[0]) + Math.PI / 2;
  const box = matrixBox('8');
  let best: Spot = { x: c[0], y: c[1], angle, cell: 0 };
  for (let t = 0.3; t <= 0.8; t += 0.025) {
    const x = c[0] + (corner[0] - c[0]) * t;
    const y = c[1] + (corner[1] - c[1]) * t;
    const cell = fitCell(share, gap * 0.6, x, y, angle, box);
    if (cell > best.cell) best = { x, y, angle, cell };
  }
  return best;
}

/** A number in dots at the origin, at a cell size, with its row of dots under it if it's a 6 or a 9. */
function matrixLabel(ctx: CanvasRenderingContext2D, label: string, cell: number, on: string, off: string | null, mark: string, dot: number) {
  const [, rows] = matrixBox(label);
  const lift = ((rows - 7) / 2) * cell;
  matrixText(ctx, label, 0, -lift, cell * 7, on, off, dot);
  if (rows > 7) {
    ctx.fillStyle = mark;
    for (const dx of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.arc(dx * cell * 1.6, -lift + cell * 4.75, cell * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = on;
  }
}

function distanceToEdge(p: [number, number], a: [number, number], b: [number, number]) {
  const [ax, ay] = a;
  const [bx, by] = b;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  return Math.abs((bx - ax) * (ay - p[1]) - (ax - p[0]) * (by - ay)) / len;
}

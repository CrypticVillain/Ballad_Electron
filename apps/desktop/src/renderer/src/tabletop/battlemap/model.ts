import type { BaseRecord } from '@/lib/model';

/**
 * Tabletop → Battle maps: the map board both Tabletop and Play use (Play draws
 * its data from Tabletop). A battle map is a picture (or a blank color) with
 * a grid over it, fog of war, and tokens on it. An encounter's prepared map
 * (Tabletop) and a Play scene are both battle maps; tokens sit on one by its
 * id (`sceneId`: the scene's, or the encounter's).
 */

/** Squares, hexes in rows (pointy tops), hexes in columns (flat tops). */
export const GRID_KINDS = ['square', 'hexRows', 'hexColumns'] as const;
export type GridKind = (typeof GRID_KINDS)[number];

/**
 * How a diagonal step counts on squares: every one a square (5e's rule),
 * alternating one and two (the optional 5 / 10 / 5 rule), or the true
 * distance.
 */
export const DIAGONAL_RULES = ['fives', 'alternating', 'euclidean'] as const;
export type DiagonalRule = (typeof DIAGONAL_RULES)[number];

export type GridSettings = {
  kind: GridKind;
  /** Whether its lines show (it's still there to measure and snap to). */
  show: boolean;
  /** A square's side, or a hex's width across its flat sides, in the picture's pixels. */
  size: number;
  /** Where the grid starts on the picture: a square's corner, or the center of hex 0,0. */
  offsetX: number;
  offsetY: number;
  /** Its lines: a CSS color and how opaque, 0–1. */
  color: string;
  opacity: number;
  /** How far one square or hex is, in `unit` (5 ft). */
  distance: number;
  unit: string;
  diagonals: DiagonalRule;
  /** Measuring (and, later, moving tokens) snaps to the middle of a square. */
  snap: boolean;
};

export const defaultGrid = (): GridSettings => ({
  kind: 'square',
  show: true,
  size: 70,
  offsetX: 0,
  offsetY: 0,
  color: '#000000',
  opacity: 0.35,
  distance: 5,
  unit: 'ft',
  diagonals: 'fives',
  snap: true,
});

// ── Fog of war ──────────────────────────────────────────────────────────

/**
 * One stroke of fog, in order: reveal or hide a box, a shape drawn point by
 * point, a brush stroke (its path, `radius` either side), or the whole map.
 * What's left covered is fog: the GM sees through it (dimmed), the players
 * don't.
 */
export type FogOp = { mode: 'reveal' | 'hide'; shape: 'rect' | 'poly' | 'brush' | 'all'; points: { x: number; y: number }[]; radius?: number };

export type Fog = {
  /** Fog is on: everything starts covered, and the strokes reveal and hide. */
  enabled: boolean;
  ops: FogOp[];
};

export const defaultFog = (): Fog => ({ enabled: false, ops: [] });

/** What a battle map is: its picture, size, background, grid and fog. */
export type BattleMap = {
  /** Its picture: a file beside the vault (ballad-media://maps/…), or '' for a blank one. */
  image: string;
  /** The picture's size in pixels: the map's own coordinates. */
  width: number;
  height: number;
  /** Shown under (or instead of) the picture. */
  background: string;
  grid: GridSettings;
  fog?: Fog;
  /** Who made the picture, as its license asks ("Cartography by Dyson Logos"). */
  credit?: string;
};

export const blankMap = (): BattleMap => ({ image: '', width: 2100, height: 1400, background: '#e9dfc7', grid: defaultGrid(), fog: defaultFog() });

/** Colors for a blank scene. */
export const BACKGROUNDS = [
  { value: '#e9dfc7', label: 'Parchment' },
  { value: '#8a8a84', label: 'Stone' },
  { value: '#6f8a4e', label: 'Grass' },
  { value: '#3b2f25', label: 'Earth' },
  { value: '#1d2533', label: 'Night' },
  { value: '#ffffff', label: 'White' },
] as const;

// ── Tokens ──────────────────────────────────────────────────────────────

/** A creature's size, and how many squares across its token is. */
export const TOKEN_SIZES = [
  { value: 'tiny', label: 'Tiny', cells: 0.5 },
  { value: 'small', label: 'Small', cells: 1 },
  { value: 'medium', label: 'Medium', cells: 1 },
  { value: 'large', label: 'Large', cells: 2 },
  { value: 'huge', label: 'Huge', cells: 3 },
  { value: 'gargantuan', label: 'Gargantuan', cells: 4 },
] as const;
export type TokenSize = (typeof TOKEN_SIZES)[number]['value'];

/** What a token stands for: one of the party (its sheet), a Bestiary creature, an NPC, or nothing in particular. */
export type TokenKind = 'pc' | 'monster' | 'npc' | 'other';

/**
 * Someone (or something) on a scene. A party member's hit points and
 * conditions are their sheet's, so the board and the sheet always agree; a
 * creature's or an NPC's are the token's own, so three ghouls are three
 * counts.
 */
export type Token = BaseRecord & {
  worldId: string;
  /** The battle map it's on: a Play scene's id, or an encounter's (its prepared map). */
  sceneId: string;
  kind: TokenKind;
  /** The PlayerCharacter, Monster or Entry it stands for (null: none). */
  refId: string | null;
  /** Its own name ("Brine Ghoul 2"); a party member's shows their sheet's. */
  name: string;
  /** Its middle, in the scene's pixels. */
  x: number;
  y: number;
  size: TokenSize;
  /** A picture (beside the vault) of its own; else what it stands for's, else initials. */
  image?: string;
  /** Hit points of its own (not a party member's), or null for none to track. */
  hp: { current: number; max: number; temp: number } | null;
  ac: number | null;
  conditions: string[];
  /** Only the GM sees it (the players' screen, later, leaves it out). */
  hidden: boolean;
  /** A ring around it, so far out from its edge, in the grid's unit (0: none). */
  aura: { radius: number; color: string };
  /** Drawn above the ones before it. */
  order: number;
  /**
   * The accounts that can move it besides the GM (online: the players). Unset:
   * a party member's goes to whoever owns their sheet. Set (even empty): only
   * these.
   */
  assignees?: string[];
  /** The encounter combatant it stands for, on an encounter's map. */
  combatantId?: string;
};

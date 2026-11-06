import type { BaseRecord } from '@/lib/model';

/**
 * Tabletop → Play: where the table plays. A campaign's scenes (the tavern,
 * the crypt, the ship battle), each a picture with a grid over it. Later
 * phases add tokens, turn order, fog of war and a players' screen.
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

export type PlayScene = BaseRecord & {
  worldId: string;
  name: string;
  /** Its picture: a file beside the vault (ballad-media://maps/…), or '' for a blank one. */
  image: string;
  /** The picture's size in pixels: the scene's own coordinates. */
  width: number;
  height: number;
  /** Shown under (or instead of) the picture. */
  background: string;
  grid: GridSettings;
  order: number;
  /** Who made the picture, as its license asks ("Cartography by Dyson Logos"). */
  credit?: string;
};

/** Colors for a blank scene. */
export const BACKGROUNDS = [
  { value: '#e9dfc7', label: 'Parchment' },
  { value: '#8a8a84', label: 'Stone' },
  { value: '#6f8a4e', label: 'Grass' },
  { value: '#3b2f25', label: 'Earth' },
  { value: '#1d2533', label: 'Night' },
  { value: '#ffffff', label: 'White' },
] as const;

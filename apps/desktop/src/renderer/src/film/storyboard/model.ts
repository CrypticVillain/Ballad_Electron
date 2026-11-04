/**
 * Filmmaking → Storyboard: a shot's frame is a picture (uploaded) or a
 * sketch. A sketch keeps its strokes, so it can be drawn on again; its
 * picture is saved beside the vault like any other.
 */

/** One stroke of the pen: its color, width and points (x, y in a 1280 × 720 frame, flattened). */
export type Stroke = { color: string; width: number; points: number[]; erase?: boolean };

export const FRAME_W = 1280;
export const FRAME_H = 720;

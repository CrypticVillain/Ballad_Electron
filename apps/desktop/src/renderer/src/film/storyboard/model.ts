/**
 * Filmmaking → Storyboard: a shot's frame is a picture (uploaded), a
 * drawing (handwriting: FramePad), or a drawing over the picture. The
 * drawing is kept, to draw on again; the frame is saved beside the vault
 * like any other picture.
 */

/** Before handwriting, one stroke of the sketch pad: its color, width and points (x, y in a 1280 × 720 frame, flattened). Read once, into handwriting. */
export type Stroke = { color: string; width: number; points: number[]; erase?: boolean };

export const FRAME_W = 1280;
export const FRAME_H = 720;

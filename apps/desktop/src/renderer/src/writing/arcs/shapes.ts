/**
 * Writing → Arcs: shapes a new arc can start from, their beats spread across
 * a book's scenes (each at its share of the way through). Plain, generic
 * story beats: rename, move or clear any of them.
 */
export type ArcShape = { id: string; label: string; note: string; beats: { at: number; text: string }[] };

export const ARC_SHAPES: ArcShape[] = [
  { id: 'blank', label: 'Blank', note: 'An empty row to fill in', beats: [] },
  {
    id: 'three-acts',
    label: 'Three Acts',
    note: 'Setup, confrontation, resolution',
    beats: [
      { at: 0, text: 'Setup: the world as it is' },
      { at: 0.12, text: 'The inciting moment' },
      { at: 0.25, text: 'No going back' },
      { at: 0.5, text: 'Midpoint: the stakes change' },
      { at: 0.75, text: 'All seems lost' },
      { at: 0.9, text: 'Climax' },
      { at: 1, text: 'Resolution: the new normal' },
    ],
  },
  {
    id: 'change',
    label: 'A Change Of Heart',
    note: 'A character who ends up someone else',
    beats: [
      { at: 0, text: 'Wants something; believes something false' },
      { at: 0.2, text: 'The belief is tested' },
      { at: 0.45, text: 'Glimpses the truth, refuses it' },
      { at: 0.7, text: 'Loses what the belief protected' },
      { at: 0.88, text: 'Chooses differently' },
      { at: 1, text: 'Changed' },
    ],
  },
];

/**
 * A shape's beats placed on the scenes: each at the scene its share of the
 * way through lands on. Two landing on one scene share it.
 */
export function placeBeats(sceneIds: string[], shape: ArcShape): Record<string, string> {
  const out: Record<string, string> = {};
  if (!sceneIds.length) return out;
  for (const beat of shape.beats) {
    const id = sceneIds[Math.round(beat.at * (sceneIds.length - 1))]!;
    out[id] = out[id] ? `${out[id]} / ${beat.text}` : beat.text;
  }
  return out;
}

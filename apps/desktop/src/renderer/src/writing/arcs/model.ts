import type { BaseRecord } from '@/lib/model';

/**
 * Writing → Arcs: how a story, a character or a theme changes across a book.
 * An arc is a row of beats, one per scene where it moves (the scene's id to
 * what happens to it there); the board lays the rows out against the book's
 * scenes in manuscript order.
 */

export const ARC_KINDS = ['plot', 'character', 'relationship', 'theme'] as const;
export type ArcKind = (typeof ARC_KINDS)[number];

export type Arc = BaseRecord & {
  worldId: string;
  bookId: string;
  name: string;
  kind: ArcKind;
  /** The character (or other entry) it follows, if any. */
  entryId: string | null;
  /** An index into the story colors (--story-N). */
  color: number;
  /** Scene id → what happens to the arc there. */
  beats: Record<string, string>;
  note: string;
  order: number;
};

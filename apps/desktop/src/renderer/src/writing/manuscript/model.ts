import type { BaseRecord } from '@/lib/model';

/**
 * Writing → Manuscript tools: a scene's saved revisions (its text as it was,
 * to look back at or restore) and comments (notes in the margin, on a quoted
 * passage, resolved when dealt with).
 */

export type Revision = BaseRecord & {
  worldId: string;
  sceneId: string;
  /** "Before the rewrite"; empty for the automatic ones. */
  label: string;
  automatic: boolean;
  title: string;
  /** The editor's blocks, as saved. */
  content: unknown[];
  text: string;
  words: number;
};

export type SceneComment = BaseRecord & {
  worldId: string;
  sceneId: string;
  text: string;
  /** The passage it's about, as it read when the comment was made. */
  quote: string;
  resolved: boolean;
};

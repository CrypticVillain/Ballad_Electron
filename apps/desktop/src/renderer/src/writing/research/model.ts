import type { BaseRecord } from '@/lib/model';

/**
 * Writing → Research: what you gather for a world (notes, sources, quotes,
 * links), tagged to find again and tied to the entries it's about.
 */
export type ResearchNote = BaseRecord & {
  worldId: string;
  title: string;
  body: string;
  /** Where it came from (a web page, a book), if anywhere. */
  source: string;
  tags: string[];
  /** World bible entries it's about. */
  links: string[];
  pinned: boolean;
};

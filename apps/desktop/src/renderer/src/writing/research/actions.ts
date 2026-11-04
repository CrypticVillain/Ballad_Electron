import { useVault } from '@/stores/vault';
import { stamp } from '@/writing/common';
import type { ResearchNote } from './model';

/** Writing → Research: making, changing and deleting research notes. */

const store = () => useVault.getState();

export function createResearchNote(worldId: string, input: Partial<ResearchNote> = {}): ResearchNote {
  const note: ResearchNote = { ...stamp(), worldId, title: '', body: '', source: '', tags: [], links: [], pinned: false, ...input };
  store().put('research', note);
  return note;
}

export const updateResearchNote = (id: string, changes: Partial<ResearchNote>) => store().patch('research', id, changes);

export function deleteResearchNote(id: string): () => void {
  store().remove('research', id);
  return () => store().restore('research', id);
}

/** A tag as it's kept: trimmed, one space between words, no leading #. */
export const cleanTag = (tag: string) => tag.replace(/^#+/, '').trim().replace(/\s+/g, ' ');

import { live } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { stamp } from '@/writing/common';
import type { Arc } from './model';

/** Writing → Arcs: making, changing and deleting a book's arcs and their beats. */

const store = () => useVault.getState();

export function createArc(input: Pick<Arc, 'worldId' | 'bookId'> & Partial<Arc>): Arc {
  const siblings = live(store().vault.arcs).filter((a) => a.bookId === input.bookId);
  const arc: Arc = {
    ...stamp(),
    name: 'New Arc',
    kind: 'plot',
    entryId: null,
    color: (siblings.length % 6) + 1,
    beats: {},
    note: '',
    order: siblings.length ? Math.max(...siblings.map((a) => a.order)) + 1 : 0,
    ...input,
  };
  store().put('arcs', arc);
  return arc;
}

export const updateArc = (id: string, changes: Partial<Arc>) => store().patch('arcs', id, changes);

/** What happens to an arc in a scene (empty: nothing there). */
export function setBeat(arc: Arc, sceneId: string, text: string) {
  const beats = { ...arc.beats };
  if (text.trim()) beats[sceneId] = text;
  else delete beats[sceneId];
  updateArc(arc.id, { beats });
}

export function deleteArc(id: string): () => void {
  store().remove('arcs', id);
  return () => store().restore('arcs', id);
}

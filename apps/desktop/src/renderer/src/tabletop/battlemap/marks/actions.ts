import { live, newId, now, type InkStroke } from '@/lib/model';
import { useVault } from '@/stores/vault';
import type { BoardMark } from '../model';

/**
 * Marks (Play): saving a person's marks on a scene or handout, hiding and
 * showing them, clearing them. One record per person per thing: their
 * strokes there, together.
 */

const store = () => useVault.getState();

/** Marks on a thing (a scene's id, a handout's), the not-deleted ones. */
export const marksOn = (onId: string) => live(store().vault.marks).filter((m) => m.onId === onId);

/** Someone's marks on a thing, if they've drawn there. */
export const markOf = (onId: string, accountId: string) => marksOn(onId).find((m) => m.accountId === accountId);

/** Saves someone's strokes on a thing (made on their first stroke; none left: the record goes). */
export function saveMarks(target: { worldId: string; sceneId: string; onId: string }, accountId: string, strokes: InkStroke[]) {
  const mine = markOf(target.onId, accountId);
  if (!strokes.length) {
    if (mine) store().remove('marks', mine.id);
    return;
  }
  if (mine) return store().patch('marks', mine.id, { strokes });
  const t = now();
  store().put('marks', { id: newId(), createdAt: t, updatedAt: t, deletedAt: null, worldId: target.worldId, sceneId: target.sceneId, onId: target.onId, accountId, strokes, hidden: false } satisfies BoardMark);
}

export const setMarkHidden = (id: string, hidden: boolean) => store().patch('marks', id, { hidden });

/** Clears one person's marks (the GM: anyone's; a player: their own). Returns the undo. */
export function clearMark(id: string): () => void {
  store().remove('marks', id);
  return () => store().restore('marks', id);
}

/** Clears everyone's marks on a thing (the GM's). Returns the undo. */
export function clearMarksOn(onId: string): () => void {
  const ids = marksOn(onId).map((m) => m.id);
  for (const id of ids) store().remove('marks', id);
  return () => ids.forEach((id) => store().restore('marks', id));
}

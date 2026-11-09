import { toast } from 'sonner';
import { NOTE_SIZE } from '@/lib/ink';
import { mediaSrc } from '@/components/shared/Portrait';
import { live, type Entry } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { updateToken } from '@/tabletop/battlemap/tokens/actions';
import { setMarkHidden } from '@/tabletop/battlemap/marks/actions';
import { stamp } from '../common';
import type { Handout, PlayScene } from './model';

/**
 * Play → a scene's objects: its handouts (pictures and notes the GM adds,
 * or documents from the campaign's lore, hidden until shown), and hiding or showing any of the scene's objects
 * (a token, a handout, someone's marks) from the players.
 */

const store = () => useVault.getState();

export { NOTE_SIZE };

const nextOrder = (sceneId: string) => {
  const orders = live(store().vault.handouts)
    .filter((h) => h.sceneId === sceneId)
    .map((h) => h.order);
  return orders.length ? Math.max(...orders) + 1 : 0;
};

export function addHandout(scene: PlayScene, input: Partial<Handout>): Handout {
  const handout: Handout = { ...stamp(), worldId: scene.worldId, sceneId: scene.id, name: 'Handout', ...NOTE_SIZE, text: '', hidden: true, order: nextOrder(scene.id), ...input };
  store().put('handouts', handout);
  return handout;
}

/** A picture handout: asks for the picture (copied beside the vault), hidden until shown. null if none was picked. */
export async function addPictureHandout(scene: PlayScene): Promise<Handout | null> {
  const picked = await window.api.files.importMap();
  if (!picked) return null;
  const size = await new Promise<{ width: number; height: number }>((ok) => {
    const img = new Image();
    img.onload = () => ok({ width: img.naturalWidth || 1000, height: img.naturalHeight || 750 });
    img.onerror = () => ok({ width: 1000, height: 750 });
    img.src = mediaSrc(picked.file);
  });
  return addHandout(scene, { name: picked.name.replace(/\.[^.]+$/, '') || 'Picture', image: picked.file, ...size });
}

/** A note handout (a letter, a riddle), hidden until shown. */
export const addNoteHandout = (scene: PlayScene) => addHandout(scene, { name: 'Note' });

/** A document from the campaign's lore, as a note handout (a copy: its words and handwriting), hidden until shown. */
export const addLoreDocumentHandout = (scene: PlayScene, doc: Entry) => addHandout(scene, { name: doc.name || 'Document', text: doc.about, ink: doc.ink ?? [] });

export const updateHandout = (id: string, changes: Partial<Handout>) => store().patch('handouts', id, changes);

/** Deletes a handout and the marks on it (with Undo). */
export function deleteHandout(handout: Handout) {
  const marks = live(store().vault.marks).filter((m) => m.onId === handout.id);
  store().remove('handouts', handout.id);
  for (const m of marks) store().remove('marks', m.id);
  toast('Handout Deleted', {
    description: handout.name || 'Handout',
    action: {
      label: 'Undo',
      onClick: () => {
        store().restore('handouts', handout.id);
        for (const m of marks) store().restore('marks', m.id);
      },
    },
  });
}

/** One of a scene's objects, to hide or show. */
export type SceneObject = { kind: 'token' | 'handout' | 'mark'; id: string; hidden: boolean };

/** Hides an object from the players, or shows it. */
export function setObjectHidden(object: Pick<SceneObject, 'kind' | 'id'>, hidden: boolean) {
  if (object.kind === 'token') updateToken(object.id, { hidden });
  else if (object.kind === 'handout') updateHandout(object.id, { hidden });
  else setMarkHidden(object.id, hidden);
}

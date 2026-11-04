import { create } from 'zustand';
import { updateScene } from '@/lib/actions';
import { live, type Scene } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { stamp } from '@/writing/common';
import type { Revision, SceneComment } from './model';

/** Writing → Manuscript tools: a scene's revisions (saved, restored) and comments. */

const store = () => useVault.getState();
const DAY = 24 * 60 * 60 * 1000;

/** A scene's revisions, newest first. */
export const revisionsOf = (sceneId: string) =>
  live(store().vault.revisions)
    .filter((r) => r.sceneId === sceneId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** Saves the scene as it is now. */
export function saveRevision(scene: Scene, label = '', automatic = false): Revision {
  const book = store().vault.books[scene.bookId];
  const revision: Revision = { ...stamp(), worldId: book?.worldId ?? '', sceneId: scene.id, label, automatic, title: scene.title, content: scene.content, text: scene.text, words: scene.words };
  store().put('revisions', revision);
  return revision;
}

/**
 * The automatic one: when a scene is opened, if it has words, it changed
 * since its last revision, and that was a day or more ago (or there's none).
 */
export function autoRevision(scene: Scene) {
  if (!scene.words) return;
  const last = revisionsOf(scene.id)[0];
  if (last && (last.text === scene.text || Date.now() - new Date(last.createdAt).getTime() < DAY)) return;
  saveRevision(scene, '', true);
}

/** Bumped when a revision is restored: the editor reloads the scene's text (its key changes). */
export const useEditorReload = create<{ keys: Record<string, number> }>(() => ({ keys: {} }));
const reload = (sceneId: string) => useEditorReload.setState((s) => ({ keys: { ...s.keys, [sceneId]: (s.keys[sceneId] ?? 0) + 1 } }));

/** Puts an old revision back (saving the scene as it is first, so nothing is lost). Gives back how to undo it. */
export function restoreRevision(scene: Scene, revision: Revision): () => void {
  const before = saveRevision(scene, 'Before restoring', true);
  // Not as typing: restoring words isn't writing them today.
  updateScene(scene.id, { content: revision.content, text: revision.text, words: revision.words });
  reload(scene.id);
  return () => {
    updateScene(scene.id, { content: before.content, text: before.text, words: before.words });
    reload(scene.id);
  };
}

export function deleteRevision(id: string): () => void {
  store().remove('revisions', id);
  return () => store().restore('revisions', id);
}

// ── Comments ──

export function addComment(scene: Scene, text: string, quote: string): SceneComment {
  const book = store().vault.books[scene.bookId];
  const comment: SceneComment = { ...stamp(), worldId: book?.worldId ?? '', sceneId: scene.id, text, quote, resolved: false };
  store().put('comments', comment);
  return comment;
}

export const updateComment = (id: string, changes: Partial<SceneComment>) => store().patch('comments', id, changes);

export function deleteComment(id: string): () => void {
  store().remove('comments', id);
  return () => store().restore('comments', id);
}

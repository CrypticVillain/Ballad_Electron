import { live } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { stamp } from '../common';
import { defaultGrid, type GridSettings, type PlayScene } from './model';

/** Tabletop → Play: making, changing and deleting scenes. */

const store = () => useVault.getState();

export function createPlayScene(worldId: string, input: Partial<PlayScene> = {}): PlayScene {
  const orders = live(store().vault.playScenes)
    .filter((s) => s.worldId === worldId)
    .map((s) => s.order);
  const scene: PlayScene = {
    ...stamp(),
    worldId,
    name: 'New Scene',
    image: '',
    width: 2100,
    height: 1400,
    background: '#e9dfc7',
    grid: defaultGrid(),
    order: orders.length ? Math.max(...orders) + 1 : 0,
    ...input,
  };
  store().put('playScenes', scene);
  return scene;
}

export const updatePlayScene = (id: string, changes: Partial<PlayScene>) => store().patch('playScenes', id, changes);

/** Changes some of a scene's grid settings. */
export function updateGrid(id: string, changes: Partial<GridSettings>) {
  const scene = store().vault.playScenes[id];
  if (scene) updatePlayScene(id, { grid: { ...defaultGrid(), ...scene.grid, ...changes } });
}

/** Deletes a scene (soft); returns its undo. Its picture stays beside the vault. */
export function deletePlayScene(id: string): () => void {
  store().remove('playScenes', id);
  return () => store().restore('playScenes', id);
}

/** A picture's size in pixels, read by loading it. */
export function pictureSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error(`Couldn't load ${src}`));
    img.src = src;
  });
}

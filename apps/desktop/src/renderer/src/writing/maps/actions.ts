import { live, newId } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { stamp } from '@/writing/common';
import type { WritingMap, WritingMapPin } from './model';

/** Writing → Maps: making, changing and deleting a world's maps and their pins. */

const store = () => useVault.getState();
const maps = () => live(store().vault.writingMaps);

export function createWritingMap(input: Pick<WritingMap, 'worldId' | 'name' | 'image' | 'width' | 'height'> & Partial<WritingMap>): WritingMap {
  const siblings = maps().filter((m) => m.worldId === input.worldId && m.parentId === (input.parentId ?? null));
  const map: WritingMap = { ...stamp(), parentId: null, note: '', pins: [], order: siblings.length ? Math.max(...siblings.map((m) => m.order)) + 1 : 0, ...input };
  store().put('writingMaps', map);
  return map;
}

export const updateWritingMap = (id: string, changes: Partial<WritingMap>) => store().patch('writingMaps', id, changes);

export function addPin(map: WritingMap, at: { x: number; y: number }): WritingMapPin {
  const pin: WritingMapPin = { id: newId(), x: at.x, y: at.y, label: 'New Pin', note: '', color: 'accent', entryId: null, mapId: null };
  updateWritingMap(map.id, { pins: [...map.pins, pin] });
  return pin;
}

export function updatePin(map: WritingMap, pinId: string, changes: Partial<WritingMapPin>) {
  updateWritingMap(map.id, { pins: map.pins.map((p) => (p.id === pinId ? { ...p, ...changes } : p)) });
}

/** Takes a pin off its map; gives back how to put it back. */
export function removePin(map: WritingMap, pinId: string): () => void {
  const before = map.pins;
  updateWritingMap(map.id, { pins: before.filter((p) => p.id !== pinId) });
  return () => updateWritingMap(map.id, { pins: before });
}

/**
 * Deletes a map. Its closer maps move up to its own parent (they aren't
 * deleted), and pins that opened it stop opening anything. Gives back how to
 * undo all of it.
 */
export function deleteWritingMap(id: string): () => void {
  const map = store().vault.writingMaps[id];
  if (!map) return () => undefined;
  const children = maps().filter((m) => m.parentId === id);
  const pointing = maps().filter((m) => m.pins.some((p) => p.mapId === id));
  for (const child of children) updateWritingMap(child.id, { parentId: map.parentId });
  for (const other of pointing) updateWritingMap(other.id, { pins: other.pins.map((p) => (p.mapId === id ? { ...p, mapId: null } : p)) });
  store().remove('writingMaps', id);
  return () => {
    store().restore('writingMaps', id);
    for (const child of children) updateWritingMap(child.id, { parentId: id });
    for (const other of pointing) updateWritingMap(other.id, { pins: other.pins });
  };
}

/** The maps above this one, top first (for its breadcrumbs). */
export function ancestors(map: WritingMap, all: WritingMap[]): WritingMap[] {
  const out: WritingMap[] = [];
  const seen = new Set<string>([map.id]);
  let at = map.parentId ? all.find((m) => m.id === map.parentId) : undefined;
  while (at && !seen.has(at.id)) {
    out.unshift(at);
    seen.add(at.id);
    at = at.parentId ? all.find((m) => m.id === at!.parentId) : undefined;
  }
  return out;
}

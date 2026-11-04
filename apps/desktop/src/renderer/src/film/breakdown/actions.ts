import { live } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { stamp } from '@/film/common';
import type { BreakdownCategory, BreakdownItem } from './model';

/** Filmmaking → Breakdown: elements, and the scenes that need them. */

const store = () => useVault.getState();

/** Tags a scene with an element: the production's one of that name and category if there is one, else a new one. */
export function tagScene(worldId: string, sceneId: string, category: BreakdownCategory, name: string): BreakdownItem | null {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const same = live(store().vault.breakdown).find((i) => i.worldId === worldId && i.category === category && i.name.toLowerCase() === clean.toLowerCase());
  if (same) {
    if (!same.sceneIds.includes(sceneId)) store().patch('breakdown', same.id, { sceneIds: [...same.sceneIds, sceneId] });
    return same;
  }
  const item: BreakdownItem = { ...stamp(), worldId, category, name: clean, sceneIds: [sceneId], qty: 1, notes: '' };
  store().put('breakdown', item);
  return item;
}

/** Takes an element off a scene (the element stays, for its other scenes). */
export function untagScene(item: BreakdownItem, sceneId: string) {
  store().patch('breakdown', item.id, { sceneIds: item.sceneIds.filter((id) => id !== sceneId) });
}

export const updateItem = (id: string, changes: Partial<BreakdownItem>) => store().patch('breakdown', id, changes);

export function deleteItem(id: string): () => void {
  store().remove('breakdown', id);
  return () => store().restore('breakdown', id);
}

/** Where an element's name turns up in a scene's text (case aside): for highlighting it. */
export function findMentions(text: string, names: { name: string; hex: string }[]): { start: number; end: number; hex: string }[] {
  const lower = text.toLowerCase();
  const out: { start: number; end: number; hex: string }[] = [];
  for (const { name, hex } of [...names].sort((a, b) => b.name.length - a.name.length)) {
    const n = name.toLowerCase();
    if (n.length < 2) continue;
    for (let at = lower.indexOf(n); at >= 0; at = lower.indexOf(n, at + n.length)) {
      const before = lower[at - 1];
      const after = lower[at + n.length];
      const word = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);
      if (word(before) || word(after) || out.some((o) => at < o.end && at + n.length > o.start)) continue;
      out.push({ start: at, end: at + n.length, hex });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

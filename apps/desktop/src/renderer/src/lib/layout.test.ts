import './test-env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addFolder, addSpace, arrange, deleteFolder, deleteSpace, moveFolder, moveItem, moveSpace, rename, whereIs } from './layout';

const items = [
  { id: 'a', name: 'Aria', space: 'Allies' },
  { id: 'b', name: 'Brask', space: 'Villains' },
  { id: 'c', name: 'Corvin', space: 'Allies' },
  { id: 'd', name: 'Dell', folder: 'Smugglers' },
];
const names = (layout: ReturnType<typeof arrange>) => layout.spaces.map((s) => `${s.name}[${s.folders.map((f) => `${f.name}(${f.items})`).join(' ')}|${s.items}]`).join(' ');

test('without a saved layout, the old groups become spaces and old folders sit in the first', () => {
  const layout = arrange(undefined, items, ['Allies', 'Villains', 'Townsfolk'], ['Smugglers']);
  assert.equal(names(layout), 'Allies[Smugglers(d)|a,c] Villains[|b] Townsfolk[|]');
});

test('a saved layout keeps its order, drops deleted items and places new ones', () => {
  const first = arrange(undefined, items, ['Allies', 'Villains']);
  const allies = first.spaces[0]!;
  const reordered = moveItem(first, 'c', { space: allies.id, before: 'a' });
  const later = arrange(reordered, [...items.filter((i) => i.id !== 'b'), { id: 'e', name: 'Eel', space: 'Villains' }], ['Allies', 'Villains']);
  assert.equal(names(later), 'Allies[|c,a,d] Villains[|e]');
});

test('items move between spaces and folders, before others or at the end', () => {
  let layout = arrange(undefined, items, ['Allies', 'Villains']);
  const [allies, villains] = layout.spaces;
  const made = addFolder(layout, villains!.id, 'Cult');
  layout = moveItem(made.layout, 'a', { space: villains!.id, folder: made.folder.id });
  layout = moveItem(layout, 'c', { space: villains!.id, folder: made.folder.id, before: 'a' });
  assert.equal(whereIs(layout, 'a')?.folder?.name, 'Cult');
  assert.deepEqual(layout.spaces[1]!.folders[0]!.items, ['c', 'a']);
  layout = moveItem(layout, 'a', { space: allies!.id });
  assert.equal(whereIs(layout, 'a')?.space.name, 'Allies');
  assert.equal(whereIs(layout, 'a')?.folder, undefined);
});

test('folders move between spaces with what is in them; spaces reorder', () => {
  let layout = arrange(undefined, items, ['Allies', 'Villains'], ['Smugglers']);
  const [allies, villains] = layout.spaces;
  const smugglers = allies!.folders[0]!;
  layout = moveFolder(layout, smugglers.id, { space: villains!.id });
  assert.equal(names(layout), 'Allies[|a,c] Villains[Smugglers(d)|b]');
  layout = moveSpace(layout, villains!.id, allies!.id);
  assert.deepEqual(layout.spaces.map((s) => s.name), ['Villains', 'Allies']);
  layout = moveSpace(layout, villains!.id);
  assert.deepEqual(layout.spaces.map((s) => s.name), ['Allies', 'Villains']);
});

test('renaming, deleting a folder (its items stay) and a space (moved to another; never the last)', () => {
  let layout = arrange(undefined, items, ['Allies', 'Villains'], ['Smugglers']);
  const smugglers = layout.spaces[0]!.folders[0]!;
  layout = rename(layout, smugglers.id, 'Runners');
  assert.equal(layout.spaces[0]!.folders[0]!.name, 'Runners');
  layout = deleteFolder(layout, smugglers.id);
  assert.equal(names(layout), 'Allies[|d,a,c] Villains[|b]');
  const added = addSpace(layout, 'Townsfolk');
  layout = deleteSpace(added.layout, layout.spaces[0]!.id, added.space.id);
  assert.equal(names(layout), 'Villains[|b] Townsfolk[|d,a,c]');
  layout = deleteSpace(deleteSpace(layout, layout.spaces[0]!.id), layout.spaces[1]!.id);
  assert.equal(layout.spaces.length, 1);
});

test('a shared structure makes its space and folder where they are missing, in a saved layout too', () => {
  const mine = arrange(undefined, [{ id: 'x', name: 'Xan' }], ['NPCs']);
  const later = arrange(mine, [{ id: 'x', name: 'Xan' }, { id: 'y', name: 'Yorrick', space: 'Villains', folder: 'Cult', create: true }, { id: 'z', name: 'Zed', space: 'Villains', create: true }], ['NPCs']);
  assert.equal(names(later), 'NPCs[|x] Villains[Cult(y)|z]');
  const unasked = arrange(mine, [{ id: 'x', name: 'Xan' }, { id: 'y', name: 'Yorrick', space: 'Villains', folder: 'Cult' }], ['NPCs']);
  assert.equal(names(unasked), 'NPCs[|x,y]');
});

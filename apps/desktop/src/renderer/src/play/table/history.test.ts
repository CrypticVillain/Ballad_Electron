import '@/lib/test-env';
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { createMonster, createWorld } from '@/lib/actions';
import { emptyVault } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { defaultGrid } from '@/tabletop/battlemap/model';
import { addToken, changeHp } from '@/tabletop/battlemap/tokens/actions';
import { ping } from './actions';
import { eventsOf, redo, saveRewind, startHistory, undo } from './history';

const vault = () => useVault.getState().vault;
let stop: (() => void) | null = null;

// The history groups a burst of changes (150 ms) and folds repeat edits (2.5 s): the clock is the tests'.
// (Once for the file: re-enabling it after a reset leaves setTimeout's timers never firing.)
before(() => mock.timers.enable({ apis: ['setTimeout', 'Date'] }));
after(() => mock.timers.reset());
beforeEach(() => useVault.setState({ vault: emptyVault() }));
afterEach(() => {
  stop?.();
  stop = null;
  // Past anything left waiting, and past the repeat-edit window, so no test carries into the next.
  mock.timers.tick(10_000);
});

/** A campaign with a scene's two goblins on it, and the GM's window recording. */
function table() {
  const { world } = createWorld({ name: 'Lantern', section: 'tabletop' });
  const scene = { id: 'scene-1', worldId: world.id, grid: { ...defaultGrid(), size: 50 } };
  const goblin = createMonster(world.id, { name: 'Goblin', hp: 7, ac: 15 });
  const a = addToken(scene, { kind: 'monster', monster: goblin }, { x: 0, y: 0 }).token;
  const b = addToken(scene, { kind: 'monster', monster: goblin }, { x: 100, y: 0 }).token;
  const speaker = { worldId: world.id, accountId: 'gm', who: 'GM' };
  stop = startHistory(speaker);
  return { world, scene, a, b, speaker, hp: (id: string) => vault().tokens[id]!.hp!.current, frozen: () => Boolean(vault().worlds[world.id]!.tabletop?.frozen) };
}

/** Lets a burst of changes become an event (the history's grouping window). */
const settle = () => mock.timers.tick(200);

test('what’s done at the table is recorded; Undo puts it back and freezes the board; Redo brings it back, unfrozen', () => {
  const { world, a, hp, frozen } = table();
  changeHp(a, 3, 'damage');
  settle();
  assert.equal(hp(a.id), 4);
  assert.equal(eventsOf(world.id).length, 1);

  const undone = undo(world.id);
  assert.ok(undone);
  assert.equal(hp(a.id), 7, 'the damage undone');
  assert.equal(vault().gameLog[undone.id]!.undone, true);
  assert.ok(frozen(), 'nothing moves till Save or Redo');

  const redone = redo(world.id);
  assert.equal(redone?.id, undone.id);
  assert.equal(hp(a.id), 4);
  assert.equal(vault().gameLog[undone.id]!.undone, false);
  assert.equal(frozen(), false, 'back at now');
  assert.equal(redo(world.id), undefined, 'nothing left to redo');
});

test('changes made together are one event, undone together; Undo works before the burst has settled', () => {
  const { world, a, b, hp } = table();
  changeHp(a, 2, 'damage');
  changeHp(b, 5, 'damage');
  // No settle(): Undo takes what's still waiting to be recorded.
  undo(world.id);
  assert.deepEqual([hp(a.id), hp(b.id)], [7, 7]);
  assert.equal(eventsOf(world.id).length, 1);
});

test('the same record edited again soon after is the same event; later, a new one', () => {
  const { world, a, hp } = table();
  changeHp(a, 1, 'damage');
  settle();
  changeHp({ ...a, hp: vault().tokens[a.id]!.hp }, 1, 'damage');
  settle();
  assert.equal(eventsOf(world.id).length, 1, 'folded into the edit before');
  mock.timers.tick(3000);
  changeHp({ ...a, hp: vault().tokens[a.id]!.hp }, 1, 'damage');
  settle();
  assert.equal(eventsOf(world.id).length, 2);
  undo(world.id);
  assert.equal(hp(a.id), 5, 'the later one undone alone');
  undo(world.id);
  assert.equal(hp(a.id), 7, 'the folded pair undone as one');
});

test('something new after an Undo: what was undone can’t come back', () => {
  const { world, a, b, hp } = table();
  changeHp(a, 3, 'damage');
  settle();
  undo(world.id);
  changeHp(b, 1, 'damage');
  settle();
  assert.equal(redo(world.id), undefined);
  assert.equal(hp(a.id), 7);
});

test('Save keeps the board as it was rewound to and unfreezes it; Redo still works till something new happens', () => {
  const { world, a, hp, frozen } = table();
  changeHp(a, 3, 'damage');
  settle();
  undo(world.id);
  saveRewind(world.id);
  assert.equal(frozen(), false);
  assert.equal(hp(a.id), 7);
  assert.ok(redo(world.id));
  assert.equal(hp(a.id), 4);
});

test('not the game’s: pings, and another campaign’s things, aren’t recorded', () => {
  const { world, scene, speaker } = table();
  ping(speaker, scene.id, 10, 10);
  const { world: other } = createWorld({ name: 'Elsewhere', section: 'tabletop' });
  const orc = createMonster(other.id, { name: 'Orc', hp: 15, ac: 13 });
  addToken({ id: 'scene-2', worldId: other.id, grid: defaultGrid() }, { kind: 'monster', monster: orc }, { x: 0, y: 0 });
  settle();
  assert.equal(eventsOf(world.id).length, 0);
  assert.equal(undo(world.id), undefined, 'nothing to undo');
});

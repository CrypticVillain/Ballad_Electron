import '@/lib/test-env';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createEntry, createMonster, createPc, createWorld, updateRecord } from '@/lib/actions';
import { emptyVault } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { defaultGrid } from '../model';
import { addToken, bringToFront, changeHp, removeTokens, setHp, sourceOf, toggleCondition } from './actions';
import { resolveToken } from './resolve';

const vault = () => useVault.getState().vault;
beforeEach(() => useVault.setState({ vault: emptyVault() }));

function setup() {
  const { world } = createWorld({ name: 'Lantern', section: 'tabletop' });
  // Any map: a scene's or an encounter's; here just its id, campaign and grid.
  const scene = { id: 'map-1', worldId: world.id, grid: { ...defaultGrid(), size: 50 } };
  const pc = createPc(world.id, { name: 'Ines', conditions: [] });
  updateRecord('pcs', pc.id, { hp: { max: 20, current: 20, temp: 3 } });
  const ghoul = createMonster(world.id, { name: 'Brine Ghoul', hp: 22, ac: 12, kind: 'Large undead, chaotic evil' });
  const npc = createEntry(world.id, 'character', { name: 'Harbormaster Quill' });
  return { world, scene, pc: vault().pcs[pc.id]!, ghoul, npc };
}

test('tokens land snapped; creatures are numbered with their own hit points and size; a party member is there once', () => {
  const { scene, pc, ghoul } = setup();
  const a = addToken(scene, { kind: 'monster', monster: ghoul }, { x: 70, y: 40 }).token;
  const b = addToken(scene, { kind: 'monster', monster: ghoul }, { x: 170, y: 40 }).token;
  assert.deepEqual([a.name, b.name], ['Brine Ghoul', 'Brine Ghoul 2']);
  assert.equal(a.size, 'large');
  assert.deepEqual({ x: a.x, y: a.y }, { x: 50, y: 50 }, 'a 2×2 token snaps to a corner');
  assert.deepEqual(a.hp, { current: 22, max: 22, temp: 0 });
  const first = addToken(scene, { kind: 'pc', pc }, { x: 10, y: 10 });
  const again = addToken(scene, { kind: 'pc', pc }, { x: 300, y: 300 });
  assert.equal(first.existing, false);
  assert.equal(again.existing, true);
  assert.equal(again.token.id, first.token.id);
  assert.deepEqual({ x: first.token.x, y: first.token.y }, { x: 25, y: 25 });
  assert.ok(b.order > a.order);
});

test('a party member’s hit points and conditions are their sheet’s; a creature’s are the token’s', () => {
  const { scene, pc, ghoul } = setup();
  const hero = addToken(scene, { kind: 'pc', pc }, { x: 25, y: 25 }).token;
  const one = addToken(scene, { kind: 'monster', monster: ghoul }, { x: 100, y: 100 }).token;
  const two = addToken(scene, { kind: 'monster', monster: ghoul }, { x: 200, y: 100 }).token;
  changeHp(hero, 5, 'damage');
  assert.deepEqual(vault().pcs[pc.id]!.hp, { max: 20, current: 18, temp: 0 }, 'temporary hit points go first');
  assert.equal(vault().tokens[hero.id]!.hp, null);
  changeHp(vault().tokens[one.id]!, 10, 'damage');
  assert.equal(vault().tokens[one.id]!.hp!.current, 12);
  assert.equal(vault().tokens[two.id]!.hp!.current, 22, 'each creature is its own count');
  changeHp(vault().tokens[one.id]!, 50, 'heal');
  assert.equal(vault().tokens[one.id]!.hp!.current, 22);
  toggleCondition(hero, 'Prone');
  assert.deepEqual(vault().pcs[pc.id]!.conditions, ['Prone']);
  toggleCondition(vault().tokens[two.id]!, 'Frightened');
  assert.deepEqual(vault().tokens[two.id]!.conditions, ['Frightened']);
  toggleCondition(vault().tokens[two.id]!, 'Frightened');
  assert.deepEqual(vault().tokens[two.id]!.conditions, []);
  setHp(vault().tokens[two.id]!, null);
  assert.equal(vault().tokens[two.id]!.hp, null);
});

test('what the board shows: names, pictures and AC from what a token stands for, and when that’s gone', () => {
  const { scene, pc, ghoul, npc } = setup();
  updateRecord('pcs', pc.id, { image: 'ines.png', ac: 16 });
  const sources = () => ({ pcs: new Map(Object.entries(vault().pcs)), monsters: new Map(Object.entries(vault().monsters)), entries: new Map(Object.entries(vault().entries)) });
  const hero = addToken(scene, { kind: 'pc', pc: vault().pcs[pc.id]! }, { x: 25, y: 25 }).token;
  const view = resolveToken(hero, sources());
  assert.deepEqual([view.name, view.image, view.ac, view.link], ['Ines', 'ines.png', 16, `/party/${pc.id}`]);
  const ghoulToken = addToken(scene, { kind: 'monster', monster: ghoul }, { x: 100, y: 100 }).token;
  assert.equal(resolveToken(ghoulToken, sources()).ac, 12);
  const quill = addToken(scene, { kind: 'npc', entry: npc }, { x: 200, y: 100 }).token;
  assert.equal(resolveToken(quill, sources()).link, `/bible/character/${npc.id}`);
  const gone = { ...sources(), monsters: new Map() };
  assert.equal(resolveToken(ghoulToken, gone).missing, true);
  assert.equal(resolveToken(ghoulToken, gone).name, 'Brine Ghoul');
  // A dragged { kind, id } finds what it stands for again.
  assert.equal(sourceOf({ kind: 'monster', id: ghoul.id })?.kind, 'monster');
  assert.equal(sourceOf({ kind: 'pc', id: 'nobody' }), null);
});

test('removing comes back with Undo; Bring To Front puts tokens on top', () => {
  const { scene, ghoul } = setup();
  const a = addToken(scene, { kind: 'monster', monster: ghoul }, { x: 100, y: 100 }).token;
  const b = addToken(scene, { kind: 'other' }, { x: 200, y: 100 }).token;
  bringToFront([a.id]);
  assert.ok(vault().tokens[a.id]!.order > vault().tokens[b.id]!.order);
  const undo = removeTokens([a.id, b.id]);
  assert.ok(vault().tokens[a.id]!.deletedAt);
  undo();
  assert.equal(vault().tokens[b.id]!.deletedAt, null);
});

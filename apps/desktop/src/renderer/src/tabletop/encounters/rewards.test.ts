import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Combatant, Monster, PlayerCharacter } from '@/lib/model';
import { applyAward, awards, encounterXp, levelForXp, splitCoins, xpForNext } from './rewards';

const fighter = (refId: string, hp: number) => ({ id: refId + hp, kind: 'monster', refId, name: refId, initiative: null, ac: 12, hp, maxHp: 10, conditions: [] }) as Combatant;

test('a fight’s XP: its creatures by challenge rating, or only those defeated', () => {
  const monsters = [{ id: 'ghoul', cr: '1' }, { id: 'rat', cr: '1/8' }] as Monster[];
  const fight = [fighter('ghoul', 0), fighter('rat', 3), fighter('rat', 0), { ...fighter('pc', 0), kind: 'pc' } as Combatant];
  assert.equal(encounterXp(fight, monsters), 250);
  assert.equal(encounterXp(fight, monsters, true), 225);
});

test('coins split evenly, the first getting what doesn’t divide; XP shared, rounded down', () => {
  assert.deepEqual(splitCoins({ gp: 10, sp: 3 }, 3), [{ sp: 1, gp: 4 }, { sp: 1, gp: 3 }, { sp: 1, gp: 3 }]);
  const given = awards(250, { items: [{ id: 'i', name: 'Silver Key', qty: 1, to: 'b' }, { id: 'j', name: 'Rope', qty: 2, to: null }], coins: { gp: 5 } }, ['a', 'b']);
  assert.deepEqual(given.get('a'), { xp: 125, items: [], coins: { gp: 3 } });
  assert.deepEqual(given.get('b'), { xp: 125, items: [{ name: 'Silver Key', qty: 1 }], coins: { gp: 2 } });
});

test('an award lands on the sheet: XP, things (more of one already carried), coins', () => {
  const pc = { xp: 200, inventory: [{ name: 'Rope', qty: 1 }], currency: { cp: 0, sp: 0, ep: 0, gp: 1, pp: 0 } } as unknown as PlayerCharacter;
  const after = applyAward(pc, { xp: 125, items: [{ name: 'rope', qty: 2 }, { name: 'Silver Key', qty: 1 }], coins: { gp: 3 } });
  assert.equal(after.xp, 325);
  assert.deepEqual(after.inventory, [{ name: 'Rope', qty: 3 }, { name: 'Silver Key', qty: 1 }]);
  assert.equal(after.currency!.gp, 4);
  assert.equal(levelForXp(325), 2);
  assert.equal(xpForNext(2), 900);
  assert.equal(xpForNext(20), null);
});

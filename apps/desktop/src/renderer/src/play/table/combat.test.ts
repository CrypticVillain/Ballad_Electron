import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CardRoll, RollCard } from '../sheet/rolls';
import { aims, amountFor, appliable, attackRollOf, concentrationDc, hitOrMiss } from './combat';
import { facesOf, faceTone } from './faces';

const roll = (label: string, total: number, extra: Partial<CardRoll> = {}): CardRoll => ({ label, expression: '', total, detail: '', ...extra });

test('an attack against an AC: hits at or over it; a natural 20 always crits, a natural 1 always misses', () => {
  assert.equal(hitOrMiss(roll('To Hit', 15), 15), 'hit');
  assert.equal(hitOrMiss(roll('To Hit', 14), 15), 'miss');
  assert.equal(hitOrMiss(roll('To Hit', 9, { natural: 20 }), 25), 'crit');
  assert.equal(hitOrMiss(roll('To Hit', 30, { natural: 1 }), 10), 'miss');
  assert.equal(hitOrMiss(roll('To Hit', 12), null), null, 'no AC: no answer');
  const card: RollCard = { kind: 'spell', title: 'Fire Bolt', rolls: [roll('Ranged Spell Attack', 17), roll('Damage', 6, { type: 'fire' })] };
  assert.equal(attackRollOf(card)?.total, 17);
});

test('Apply: full, half (rounded down), double, half to those that saved', () => {
  assert.equal(amountFor(13, 'full'), 13);
  assert.equal(amountFor(13, 'half'), 6);
  assert.equal(amountFor(13, 'double'), 26);
  assert.equal(amountFor(13, 'saves', { save: { total: 16, detail: '', natural: null, success: true } }), 6);
  assert.equal(amountFor(13, 'saves', { save: { total: 4, detail: '', natural: null, success: false } }), 13);
  assert.equal(amountFor(-2, 'full'), 0);
});

test('what Apply is on, what carries targets, and concentration’s DC', () => {
  const attack: RollCard = { kind: 'attack', title: 'Longsword', rolls: [roll('To Hit', 15), roll('Damage', 7, { type: 'slashing' })] };
  assert.deepEqual(attack.rolls.map((r) => appliable(attack, r)), [false, true]);
  const potion: RollCard = { kind: 'item', title: 'Potion of Healing', rolls: [roll('Healing', 7, { heal: true })] };
  assert.equal(appliable(potion, potion.rolls[0]!), false, 'the drinker healed already');
  assert.equal(aims(attack), true);
  assert.equal(aims({ kind: 'skill', title: 'Perception', rolls: [roll('Check', 12)] }), false);
  assert.equal(concentrationDc(7), 10);
  assert.equal(concentrationDc(31), 15);
});

test('a roll’s dice for the chat: advantage’s lower d20 set aside; 1s and highest faces marked', () => {
  const faces = facesOf([
    { notation: '2d20kh1', rolls: [4, 17], kept: [17], sign: 1 },
    { notation: '2d6', rolls: [6, 1], kept: [6, 1], sign: 1 },
  ]);
  assert.deepEqual(
    faces.map((f) => [f.sides, f.value, f.dropped]),
    [
      [20, 4, true],
      [20, 17, false],
      [6, 6, false],
      [6, 1, false],
    ],
  );
  assert.deepEqual(faces.map(faceTone), [null, null, 'high', 'low']);
});

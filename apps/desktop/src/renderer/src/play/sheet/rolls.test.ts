import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDice, castDice, critDice, d20Expression, damageRolls, itemHealing, parseAction, parseSpell, splitDamage } from './rolls';

const fireball = {
  level: 3,
  text: 'Each creature in a 20-foot-radius sphere centered on that point must make a dexterity saving throw. A target takes 8d6 fire damage on a failed save, or half as much damage on a successful one.',
  higher: 'When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.',
};

test('a spell read from its text: its save, damage and how it grows; a cantrip by level', () => {
  const fx = parseSpell(fireball);
  assert.deepEqual(fx, { save: 'dex', damage: [{ dice: '8d6', type: 'fire' }], perSlot: { dice: '1d6', from: 3 } });
  assert.equal(castDice('8d6', fireball, fx, 5, 9), '10d6');
  const bolt = { level: 0, text: 'Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage.', higher: '' };
  const boltFx = parseSpell(bolt);
  assert.equal(boltFx.attack, 'ranged');
  assert.equal(castDice('1d10', bolt, boltFx, 0, 11), '3d10');
  const cure = parseSpell({ level: 1, text: 'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier.', higher: 'the healing increases by 1d8 for each slot level above 1st.' });
  assert.deepEqual(cure.healing, { dice: '1d8', addModifier: true });
  assert.deepEqual(cure.perSlot, { dice: '1d8', from: 1 });
});

test('dice: crits double them, more of a kind add up, a sheet’s damage line splits', () => {
  assert.equal(critDice('2d6+3'), '4d6+3');
  assert.equal(critDice('d8 + 1d4'), '2d8+2d4');
  assert.equal(addDice('8d6', '1d6', 2), '10d6');
  assert.equal(addDice('2d6+3', '1d8'), '2d6+3+1d8');
  assert.deepEqual(splitDamage('1d8+3 slashing'), { dice: '1d8+3', type: 'slashing' });
  assert.deepEqual(splitDamage('2d6'), { dice: '2d6', type: '' });
  assert.equal(d20Expression(5, 'advantage', '1d4'), '2d20kh1+5+1d4');
  assert.equal(d20Expression(-1, 'normal'), '1d20-1');
});

test('a creature’s action, and a potion’s healing, from their text', () => {
  assert.deepEqual(parseAction('Melee attack: +4 to hit, reach 5 ft. Hit: 2d4 + 2 slashing. A creature hit must succeed on a DC 10 Constitution save or be poisoned.'), {
    toHit: 4,
    damage: [{ dice: '2d4+2', type: 'slashing' }],
    save: { dc: 10, ability: 'Constitution' },
  });
  assert.equal(itemHealing('You regain 2d4 + 2 hit points when you drink this potion.'), '2d4+2');
  const sixes = () => 5 / 6;
  const [crit] = damageRolls([{ dice: '1d8+3', type: 'slashing' }], true, '1d6', sixes);
  assert.equal(crit!.expression, '2d8+3+2d6');
  assert.equal(crit!.total, 7 + 7 + 3 + 6 + 6);
});

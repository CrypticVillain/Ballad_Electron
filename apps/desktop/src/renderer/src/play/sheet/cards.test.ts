import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PlayerCharacter, SpellInfo } from '@/lib/model';
import { attackCard, bonusCard, damageCard, deathSaveCard, featureCard, hitCard, itemCard, librarySpellCard, spellCard, spellInfoCard, weaponCard } from './cards';

const plain = { mode: 'normal' as const, d20Extra: '', damageExtra: '' };
/** Rolls that come up with these numbers, one die at a time (as fractions of each die's sides it picks the top). */
const top = () => 0.999;
const bottom = () => 0;

const pc = {
  name: 'Ines',
  level: 5,
  abilities: { str: 10, dex: 14, con: 12, int: 16, wis: 10, cha: 8 },
  saves: [],
  skills: [],
  expertise: [],
  spellcasting: 'int',
  slots: [
    [4, 0],
    [3, 1],
    [2, 0],
  ],
  traits: [{ id: 't', name: 'Arcane Recovery', source: 'Class', text: 'Recover slots.', uses: { max: 1, used: 0, reset: 'long' } }],
  inventory: [{ name: 'Potion of Healing', qty: 2 }],
  hp: { max: 30, current: 0, temp: 0 },
  deathSaves: { successes: 0, failures: 1 },
} as unknown as PlayerCharacter;

const fireball: SpellInfo = { name: 'Fireball', level: 3, school: 'Evocation', castingTime: '1 action', range: '150 feet', components: 'V, S, M', duration: 'Instantaneous', concentration: false, ritual: false, classes: ['Wizard'], text: 'Each creature must make a dexterity saving throw. A target takes 8d6 fire damage on a failed save.', higher: 'the damage increases by 1d6 for each slot level above 3rd.' };

test('a spell cast at a higher slot: its save DC, its damage grown, the slot spent', () => {
  const { card, changes } = spellCard(pc, 'Fireball', fireball, 3, plain, top);
  assert.deepEqual(card.facts?.[0], { label: 'Save', value: 'DC 14 Dexterity' });
  assert.equal(card.rolls[0]!.expression, '8d6');
  assert.equal(card.rolls[0]!.type, 'fire');
  assert.deepEqual(changes?.slots?.[2], [2, 1]);
  const up = spellCard({ ...pc, slots: [...pc.slots, [1, 0]] }, 'Fireball', fireball, 4, plain, top);
  assert.equal(up.card.rolls[0]!.expression, '9d6');
  assert.match(up.card.subtitle!, /cast at 4th level/);
});

test('an attack: a natural 20 doubles its damage dice; no bonus, damage only', () => {
  const { card } = attackCard('Brin', { name: 'Longsword', bonus: 5, damage: '1d8+3 slashing' }, plain, top);
  assert.equal(card.rolls[0]!.natural, 20);
  assert.equal(card.rolls[1]!.expression, '2d8+3');
  assert.equal(card.rolls[1]!.crit, true);
  const sneak = attackCard('Brin', { name: 'Sneak Attack', bonus: 0, damage: '2d6' }, plain, bottom);
  assert.equal(sneak.card.rolls.length, 1);
  assert.equal(sneak.card.rolls[0]!.label, 'Damage');
});

test('a feature used ticks a use; a potion drunk rolls its healing, one fewer carried; death saves', () => {
  const f = featureCard(pc, pc.traits![0]!, true, plain);
  assert.equal(f.changes?.traits?.[0]?.uses?.used, 1);
  assert.deepEqual(f.card.facts?.find((x) => x.label === 'Uses Left'), { label: 'Uses Left', value: '0 of 1' });
  const potion = itemCard(pc, pc.inventory[0]!, { name: 'Potion of Healing', category: 'Magic Item', type: 'Potion, common', rarity: 'Common', attunement: false, cost: '', weight: 0, stats: '', text: 'You regain 2d4 + 2 hit points when you drink this potion.' }, true, top);
  assert.equal(potion.card.rolls[0]!.total, 10);
  assert.equal(potion.changes?.inventory?.[0]?.qty, 1);
  assert.equal(potion.changes?.hp?.current, 10, 'drunk: up from 0');
  assert.deepEqual(potion.changes?.deathSaves, { successes: 0, failures: 0 });
  assert.deepEqual(deathSaveCard(pc, top).changes, { hp: { max: 30, current: 1, temp: 0 }, deathSaves: { successes: 0, failures: 0 } });
  assert.deepEqual(deathSaveCard(pc, bottom).changes, { deathSaves: { successes: 0, failures: 3 } });
});

test('Play Mode: a bonus rolled with advantage; damage alone, with an extra', () => {
  const b = bonusCard('Spell Attack', 'Ines', 6, { ...plain, mode: 'advantage' }, top);
  assert.equal(b.card.rolls[0]!.expression, '2d20kh1+6');
  assert.match(b.card.rolls[0]!.label, /Advantage/);
  const sword = { name: 'Longsword', bonus: 5, damage: '1d8+3 slashing' };
  const d = damageCard('Brin', sword, { ...plain, damageExtra: '1d6' }, top);
  assert.equal(d.card.rolls[0]!.type, 'slashing');
  assert.ok(d.card.rolls.every((r) => !r.crit));
  assert.ok(d.card.rolls.some((r) => /1d6/.test(r.expression)), 'the extra is rolled');
  const h = hitCard('Brin', sword, plain, top);
  assert.deepEqual([h.card.rolls.length, h.card.rolls[0]!.natural], [1, 20]);
  assert.equal(damageCard('Brin', sword, plain, top, true).card.rolls[0]!.expression, '2d8+3', 'a crit doubles the dice');
});

test('linking a weapon or a spell: its words and numbers, nothing rolled or spent', () => {
  const w = weaponCard('Brin', { name: 'Longsword', bonus: 5, damage: '1d8+3 slashing' }, { type: 'Martial Melee Weapon', stats: '1d8 slashing · Versatile (1d10)', text: 'A blade.' });
  assert.deepEqual(w.card.rolls, []);
  assert.deepEqual(w.card.facts?.[0], { label: 'To Hit', value: '+5' });
  const s = spellInfoCard(pc, 'Fireball', fireball);
  assert.deepEqual([s.card.rolls.length, s.changes], [0, undefined]);
  assert.match(s.card.text!, /8d6 fire/);
});

test('a Library spell linked: its level and school, its facts and words', () => {
  const { card } = librarySpellCard(fireball);
  assert.equal(card.subtitle, '3rd-level Evocation');
  assert.deepEqual(card.facts?.[1], { label: 'Range', value: '150 feet' });
  assert.match(card.text!, /At Higher Levels/);
});

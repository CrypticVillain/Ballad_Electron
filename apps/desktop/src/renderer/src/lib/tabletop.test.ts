import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actionKind, armorClass, averageLevelHp, carriedWeight, carryingCapacity, checkExpression, coinsInGold, damage, firstLevelHp, heal, improve, initiative, keptFlags, longRest, modifier, natural, passivePerception, passive, pointBuyCost, proficiencyBonus, roll, saveBonus, seesBook, shortRest, spellAttack, spellSaveDc, sidesOf, signed, skillBonus, usesFromText } from './tabletop';
import type { Feature } from './model';
import { budgetTotals, duration, money, scriptLength, shotTotals } from './film';
import type { BudgetLine, Shot } from './model';

/** A fixed sequence of "random" numbers, so rolls are known: each value v rolls 1 + floor(v * sides). */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

test('modifiers and proficiency', () => {
  assert.deepEqual([1, 8, 9, 10, 11, 15, 20, 30].map(modifier), [-5, -1, -1, 0, 0, 2, 5, 10]);
  assert.deepEqual([1, 4, 5, 8, 9, 13, 17, 20].map(proficiencyBonus), [2, 2, 3, 3, 4, 5, 6, 6]);
  assert.equal(signed(3), '+3');
  assert.equal(signed(0), '+0');
  assert.equal(signed(-1), '-1');
});

test('saves, skills, expertise, initiative and passive perception', () => {
  const pc = {
    abilities: { str: 8, dex: 16, con: 14, int: 12, wis: 13, cha: 10 },
    saves: ['dex', 'int'] as ('dex' | 'int')[],
    skills: ['Stealth', 'Perception'],
    expertise: ['Stealth'],
    level: 5,
    initiativeBonus: 0,
  };
  assert.equal(saveBonus(pc, 'dex'), 3 + 3);
  assert.equal(saveBonus(pc, 'str'), -1);
  assert.equal(skillBonus(pc, 'Stealth'), 3 + 6);
  assert.equal(skillBonus(pc, 'Perception'), 1 + 3);
  assert.equal(skillBonus(pc, 'Athletics'), -1);
  assert.equal(initiative(pc), 3);
  assert.equal(passivePerception(pc), 14);
});

test('damage takes temporary hit points first; healing stops at the max', () => {
  const hp = { max: 30, current: 20, temp: 5 };
  assert.deepEqual(damage(hp, 3), { max: 30, current: 20, temp: 2 });
  assert.deepEqual(damage(hp, 12), { max: 30, current: 13, temp: 0 });
  assert.deepEqual(damage(hp, 99), { max: 30, current: 0, temp: 0 });
  assert.deepEqual(heal({ max: 30, current: 0, temp: 0 }, 50), { max: 30, current: 30, temp: 0 });
  assert.deepEqual(heal(hp, -4), hp);
});

test('roll parses dice, keeps highest or lowest, and adds constants', () => {
  // d20 rolls 15 (0.7 → 1 + 14); 2d6 rolls 2 and 6.
  const r = roll('d20 + 2d6 - 1', sequence(0.7, 0.2, 0.9))!;
  assert.equal(r.total, 15 + 2 + 6 - 1);
  assert.deepEqual(r.groups.map((g) => g.notation), ['1d20', '2d6']);

  const advantage = roll(checkExpression(4, 'advantage'), sequence(0.1, 0.95))!;
  assert.deepEqual(advantage.groups[0]!.kept, [20]);
  assert.equal(advantage.total, 24);
  assert.equal(natural(advantage), 20);

  const disadvantage = roll(checkExpression(-1, 'disadvantage'), sequence(0.1, 0.95))!;
  assert.equal(disadvantage.total, 3 - 1);

  const kept = roll('4d6kh3', sequence(0, 0.5, 0.99, 0.2))!;
  assert.equal(kept.total, 6 + 4 + 2);
  assert.deepEqual(keptFlags(kept.groups[0]!.rolls, kept.groups[0]!.kept), [false, true, true, true]);
  assert.deepEqual(keptFlags([5, 5], [5]), [true, false]);
  assert.equal(sidesOf('2d20kh1'), 20);
  assert.equal(roll('7')!.total, 7);
  for (const bad of ['', 'abc', 'd', '2d', '1d0', 'd20+', '3x6']) assert.equal(roll(bad), null, bad);
});

test('script length, shot and budget totals', () => {
  assert.deepEqual(scriptLength(900), { pages: 5, spokenMinutes: 6, screenMinutes: 5 });
  assert.equal(duration(272), '4:32');
  assert.equal(duration(3725), '1:02:05');

  const shot = (status: Shot['status'], seconds: number) => ({ status, seconds }) as Shot;
  assert.deepEqual(shotTotals([shot('planned', 5), shot('shot', 8), shot('cut', 30)]), { count: 2, done: 1, seconds: 13 });

  const line = (kind: BudgetLine['kind'], estimate: number, actual: number) => ({ kind, estimate, actual }) as BudgetLine;
  const totals = budgetTotals([line('cost', 500, 620), line('cost', 300, 0), line('income', 1500, 1200)]);
  assert.deepEqual(totals, { cost: { estimate: 800, actual: 620 }, income: { estimate: 1500, actual: 1200 }, net: { estimate: 700, actual: 580 } });
  assert.equal(money(1250), '$1,250');
  assert.equal(money(-300.4), '-$300');
});

test('a long rest restores hit points and slots and clears death saves', () => {
  const rested = longRest({ hp: { max: 30, current: 4, temp: 5 }, slots: [[4, 3], [2, 2], [0, 0]] });
  assert.deepEqual(rested.hp, { max: 30, current: 30, temp: 0 });
  assert.deepEqual(rested.slots, [[4, 0], [2, 0], [0, 0]]);
  assert.deepEqual(rested.deathSaves, { successes: 0, failures: 0 });
});

test('the GM sees the session log and a player only their journal', () => {
  assert.equal(seesBook({}, 'gm'), true);
  assert.equal(seesBook({}, 'player'), false);
  assert.equal(seesBook({ audience: 'player' }, 'player'), true);
  assert.equal(seesBook({ audience: 'player' }, 'gm'), false);
});

test('spellcasting numbers come from the casting ability and proficiency', () => {
  const caster = { abilities: { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 16 }, level: 5, spellcasting: 'cha' as const };
  assert.equal(spellSaveDc(caster), 14); // 8 + 3 + 3
  assert.equal(spellAttack(caster), 6);
  assert.equal(spellSaveDc({ ...caster, spellcasting: null }), null);
  assert.equal(passive({ abilities: caster.abilities, skills: ['Insight'], expertise: [], level: 5 }, 'Insight'), 13);
});

test('inventory weight, carrying capacity and coins', () => {
  assert.equal(carriedWeight([{ name: 'Chain mail', qty: 1, weight: 55 }, { name: 'Arrows', qty: 20, weight: 0.05 }, { name: 'Letter', qty: 1 }]), 56);
  assert.equal(carryingCapacity(16), 240);
  assert.equal(coinsInGold({ cp: 14, sp: 30, gp: 12, pp: 1 }), 25.14);
  assert.equal(coinsInGold(), 0);
});

test('rests bring back the uses of features: short ones on a short rest, all on a long one', () => {
  const traits: Feature[] = [
    { id: 'a', name: 'Second Wind', source: 'Fighter', text: '', uses: { max: 1, used: 1, reset: 'short' } },
    { id: 'b', name: 'Rage', source: 'Barbarian', text: '', uses: { max: 3, used: 2, reset: 'long' } },
    { id: 'c', name: 'Darkvision', source: 'Elf', text: '' },
  ];
  const short = shortRest({ traits }).traits!;
  assert.equal(short[0]!.uses!.used, 0);
  assert.equal(short[1]!.uses!.used, 2);
  const long = longRest({ hp: { max: 10, current: 1, temp: 0 }, slots: [], traits }).traits!;
  assert.deepEqual(long.map((f) => f.uses?.used), [0, 0, undefined]);
});

test('a feature reads how it is used from its text', () => {
  assert.equal(actionKind('On your turn, you can use a bonus action to regain hit points'), 'bonus');
  assert.equal(actionKind('you can use your reaction to halve the damage'), 'reaction');
  assert.equal(actionKind('As an action, you can exhale destructive energy'), 'action');
  assert.equal(actionKind('You can see in dim light within 60 feet'), 'passive');
  assert.deepEqual(usesFromText('Once you use this feature, you must finish a short or long rest before you can use it again.'), { max: 1, used: 0, reset: 'short' });
  assert.deepEqual(usesFromText('you can\'t use it again until you finish a long rest.'), { max: 1, used: 0, reset: 'long' });
  assert.equal(usesFromText('You have advantage on saving throws.'), null);
});

test('building a character: point buy, hit points, improvements and armor class', () => {
  assert.equal(pointBuyCost({ str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 8 }), 9 + 7 + 5 + 0 + 2 + 0);
  assert.equal(firstLevelHp(10, 14), 12);
  assert.equal(averageLevelHp(10, 14), 8);
  assert.equal(averageLevelHp(6, 3), 1);
  assert.deepEqual(improve({ str: 19, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, ['str', 'str']), { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  assert.equal(armorClass(14, []), 12);
  assert.equal(armorClass(14, ['AC 16 · Str 13 · Stealth disadvantage', 'AC +2']), 18);
  assert.equal(armorClass(18, ['AC 14 + Dex (max 2)']), 16);
  assert.equal(armorClass(16, ['AC 11 + Dex']), 14);
});

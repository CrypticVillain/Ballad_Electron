import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEncounter, crValue, crXp, DIFFICULTIES, partyBudget, rate, xpOf, type Candidate } from './encounterMath';
import { BALLAD_ENCOUNTERS } from './library/ballad-encounters';
import monsters from './library/open5e-monsters.json';

/** A seeded generator, so builds are repeatable. */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const library = monsters as { id: string; cr: string; environments: string[] }[];
const crOf = (id: string) => library.find((m) => m.id === id)?.cr;

test('XP by challenge rating', () => {
  assert.deepEqual(['0', '1/8', '1/4', '1/2', '1', '5', '10', '20', '30'].map(crXp), [10, 25, 50, 100, 200, 1800, 5900, 25000, 155000]);
  assert.equal(crXp('nonsense'), 0);
});

test('party budgets add up each character’s, and rate a fight against them', () => {
  assert.deepEqual(partyBudget([1, 1, 1, 1]), { low: 200, moderate: 300, high: 400 });
  assert.deepEqual(partyBudget([5, 5, 4]), { low: 1250, moderate: 1875, high: 2700 });
  // Out-of-range levels clamp to 1–20.
  assert.deepEqual(partyBudget([0, 25]), { low: 50 + 6400, moderate: 75 + 13200, high: 100 + 22000 });
  const budget = partyBudget([3, 3, 3, 3]);
  assert.equal(rate(200, budget), 'trivial');
  assert.equal(rate(600, budget), 'low');
  assert.equal(rate(601, budget), 'moderate');
  assert.equal(rate(1600, budget), 'high');
  assert.equal(rate(1601, budget), 'beyond');
});

test('built encounters land on the difficulty asked for, without troublesome creatures', () => {
  const pool: Candidate[] = library.filter((m) => m.environments.includes('Forest')).map((m) => ({ id: m.id, cr: m.cr }));
  for (const levels of [[1, 1, 1, 1], [3, 3, 3], [7, 7, 7, 7, 7], [12, 12, 12, 12], [20, 20, 20, 20]]) {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 1; seed <= 15; seed++) {
        const built = buildEncounter(pool, levels, difficulty, seeded(seed * 97 + levels[0]!));
        assert.ok(built, `nothing built for ${difficulty} at level ${levels[0]}`);
        assert.equal(built.xp, xpOf(built.picks, crOf));
        assert.equal(rate(built.xp, partyBudget(levels)), difficulty, `seed ${seed}, ${difficulty}, level ${levels[0]}: ${built.xp} XP`);
        for (const pick of built.picks) assert.ok(crValue(crOf(pick.id)!) <= Math.max(...levels), `${pick.id} is above the party’s level`);
      }
    }
  }
  assert.equal(buildEncounter([], [5], 'moderate'), null);
  assert.equal(buildEncounter(pool, [], 'moderate'), null);
});

test('Ballad’s encounters use real creatures and fit four characters of their level', () => {
  const habitats = new Set(library.flatMap((m) => m.environments));
  assert.equal(new Set(BALLAD_ENCOUNTERS.map((e) => e.id)).size, BALLAD_ENCOUNTERS.length);
  for (const e of BALLAD_ENCOUNTERS) {
    for (const c of e.creatures) assert.ok(crOf(c.id), `${e.name}: no creature ${c.id}`);
    for (const h of e.environments) assert.ok(habitats.has(h), `${e.name}: no habitat ${h}`);
    const rating = rate(xpOf(e.creatures, crOf), partyBudget([e.level, e.level, e.level, e.level]));
    assert.ok(rating !== 'trivial' && rating !== 'beyond', `${e.name} is ${rating} for level ${e.level}`);
  }
});

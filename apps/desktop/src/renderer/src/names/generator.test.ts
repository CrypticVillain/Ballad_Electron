import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FAMILIES, GENRES, KINDS, generateNames, genreById, genreForWorld, seeded } from './generator';

test('every genre makes names of every kind, all different, all tidy', () => {
  for (const genre of GENRES) {
    for (const kind of KINDS) {
      const names = generateNames(genre, kind.id, 12, seeded(7), 'any');
      assert.ok(names.length >= 8, `${genre.id} ${kind.id}: only ${names.length}`);
      assert.equal(new Set(names).size, names.length);
      for (const name of names) {
        assert.ok(name.length >= 2 && name.length <= 60, `${genre.id} ${kind.id}: "${name}"`);
        assert.ok(!/([a-z])\1\1/i.test(name), `${genre.id}: tripled letter in "${name}"`);
        assert.ok(!/undefined|NaN|\s{2}/.test(name), `${genre.id}: "${name}"`);
        assert.match(name, /^[A-Z“’']/, `${genre.id}: "${name}" should start with a capital`);
      }
    }
  }
});

test('the same seed gives the same names; genders steer people', () => {
  const elvish = genreById('elvish');
  assert.deepEqual(generateNames(elvish, 'person', 6, seeded(42)), generateNames(elvish, 'person', 6, seeded(42)));
  const norse = genreById('norse');
  const women = generateNames(norse, 'person', 20, seeded(3), 'feminine');
  assert.ok(women.every((n) => !n.endsWith('sson')));
  const men = generateNames(norse, 'person', 20, seeded(3), 'masculine');
  assert.ok(men.every((n) => !n.endsWith('sdottir')));
});

test('every genre belongs to a family, and a world’s genre picks one', () => {
  for (const genre of GENRES) assert.ok(FAMILIES.some((f) => f.id === genre.family));
  assert.equal(genreForWorld('Low Fantasy'), 'low-fantasy');
  assert.equal(genreForWorld('Epic fantasy'), 'high-fantasy');
  assert.equal(genreForWorld('Space Opera'), 'space-opera');
  assert.equal(genreForWorld('Literary thriller'), 'noir');
  assert.equal(genreForWorld('Contemporary romance'), 'contemporary');
  assert.equal(genreForWorld(''), null);
  assert.equal(genreForWorld('Untagged'), null);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { familyOf, kinship } from './family';

test('labels read as the first entry’s relation to the second', () => {
  assert.deepEqual(kinship('Mother of'), { kind: 'parent' });
  assert.deepEqual(kinship('Father'), { kind: 'parent' });
  assert.deepEqual(kinship('Eldest daughter'), { kind: 'child' });
  assert.deepEqual(kinship('Older sister · he’s missing since 401'), { kind: 'sibling' });
  assert.deepEqual(kinship('Married to'), { kind: 'spouse' });
  assert.deepEqual(kinship('Grandmother'), { kind: 'generation', above: 2 });
  assert.deepEqual(kinship('Great-grandson'), { kind: 'generation', above: -3 });
  assert.deepEqual(kinship('Uncle'), { kind: 'generation', above: 1 });
  assert.deepEqual(kinship('Mother-in-law'), { kind: 'generation', above: 1 });
  assert.deepEqual(kinship('Cousin'), { kind: 'generation', above: 0 });
  assert.equal(kinship('Rival'), null);
  assert.equal(kinship('Brotherhood of the Lamp'), null);
});

test('a family in generations: parents above children, spouses side by side, outsiders left out', () => {
  const ids = ['gran', 'mum', 'dad', 'ines', 'tomas', 'rival', 'aunt'];
  const family = familyOf(
    [
      { from: 'gran', to: 'mum', label: 'Mother of' },
      { from: 'mum', to: 'dad', label: 'Married to' },
      { from: 'ines', to: 'mum', label: 'Daughter of' },
      { from: 'dad', to: 'tomas', label: 'Father' },
      { from: 'ines', to: 'tomas', label: 'Older sister' },
      { from: 'aunt', to: 'ines', label: 'Aunt' },
      { from: 'ines', to: 'rival', label: 'Rival' },
    ],
    ids,
  );
  assert.ok(!family.people.includes('rival'));
  assert.deepEqual(family.generation, { gran: 0, mum: 1, dad: 1, ines: 2, tomas: 2, aunt: 1 });
  assert.equal(family.rows.length, 3);
  const middle = family.rows[1]!;
  assert.equal(Math.abs(middle.indexOf('mum') - middle.indexOf('dad')), 1);
  assert.deepEqual(new Set(family.rows[2]), new Set(['ines', 'tomas']));
  assert.deepEqual(family.parents, [['gran', 'mum'], ['mum', 'ines'], ['dad', 'tomas']]);
});

test('separate families each start at the top; nobody, nothing', () => {
  const family = familyOf(
    [
      { from: 'a', to: 'b', label: 'Mother of' },
      { from: 'c', to: 'd', label: 'Brother' },
    ],
    ['a', 'b', 'c', 'd'],
  );
  assert.equal(family.generation.c, 0);
  assert.equal(family.generation.d, 0);
  assert.equal(family.generation.b, 1);
  assert.deepEqual(familyOf([], ['a']).rows, []);
});

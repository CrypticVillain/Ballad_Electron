import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Part, Scene } from '@/lib/model';
import { dayRange, eraEnd, eraYears, numbered, povLanes } from './days';

const scene = (id: string, partId: string, order: number, extra: Partial<Scene> = {}) => ({ id, partId, order, povId: null, storyDay: null, ...extra }) as Scene;
const part = (id: string, order: number) => ({ id, order }) as Part;

test('scenes are numbered as the binder numbers them, act by act; notes left out', () => {
  const parts = [part('b', 1), part('a', 0)];
  const scenes = [scene('s3', 'b', 0), scene('s2', 'a', 1), scene('s1', 'a', 0), scene('n', 'a', 2, { kind: 'note' })];
  assert.deepEqual(
    numbered(parts, scenes).map((n) => `${n.scene.id} ${n.label}`),
    ['s1 I · 1', 's2 I · 2', 's3 II · 1'],
  );
});

test('the days run from Day 1 to one past the latest; the lanes are the points of view, "No POV" last', () => {
  assert.deepEqual(dayRange([]), [1, 2]);
  assert.deepEqual(dayRange([scene('a', 'p', 0, { storyDay: 3 }), scene('b', 'p', 1)]), [1, 2, 3, 4]);
  assert.deepEqual(dayRange([scene('a', 'p', 0, { storyDay: -1 })]), [-1, 0, 1, 2]);
  assert.deepEqual(povLanes([scene('a', 'p', 0), scene('b', 'p', 1, { povId: 'mara' }), scene('c', 'p', 2, { povId: 'ines' }), scene('d', 'p', 3, { povId: 'mara' })]), ['mara', 'ines', null]);
});

test('an era runs to its last year, or on to the end of what’s shown', () => {
  const era = { id: 'e', name: 'The Long Dark', from: 300, to: null, color: 2 as const };
  assert.equal(eraEnd(era, 420), 420);
  assert.equal(eraYears(era), '300 on');
  assert.equal(eraEnd({ ...era, to: 350 }, 420), 350);
  assert.equal(eraYears({ ...era, to: 350 }), '300–350');
});

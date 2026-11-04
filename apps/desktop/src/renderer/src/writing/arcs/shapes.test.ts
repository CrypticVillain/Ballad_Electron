import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARC_SHAPES, placeBeats } from './shapes';

const shape = (id: string) => ARC_SHAPES.find((s) => s.id === id)!;

test('a shape’s beats spread across the scenes, first to last', () => {
  const scenes = Array.from({ length: 21 }, (_, i) => `s${i}`);
  const beats = placeBeats(scenes, shape('three-acts'));
  assert.equal(Object.keys(beats).length, 7);
  assert.match(beats.s0!, /^Setup/);
  assert.match(beats.s10!, /^Midpoint/);
  assert.match(beats.s20!, /^Resolution/);
});

test('with few scenes, beats share them; with none, nothing; blank is empty', () => {
  const beats = placeBeats(['a', 'b'], shape('three-acts'));
  assert.deepEqual(Object.keys(beats), ['a', 'b']);
  assert.ok(beats.a!.includes(' / '));
  assert.deepEqual(placeBeats([], shape('change')), {});
  assert.deepEqual(placeBeats(['a', 'b', 'c'], shape('blank')), {});
});

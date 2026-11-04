import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isFamily, layoutWeb } from './layout';

const nodes = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));
const edges = [
  { from: 'a', to: 'b' },
  { from: 'b', to: 'c' },
  { from: 'd', to: 'e' },
];
const distance = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);

test('the web is the same every time, inside the frame, nothing on top of anything', () => {
  const one = layoutWeb(nodes, edges);
  const two = layoutWeb(nodes, edges);
  assert.deepEqual(one, two);
  for (const p of Object.values(one)) assert.ok(p.x >= 0.1 && p.x <= 0.9 && p.y >= 0.1 && p.y <= 0.9);
  const ids = Object.keys(one);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) assert.ok(distance(one[ids[i]!]!, one[ids[j]!]!) > 0.03, `${ids[i]} and ${ids[j]} overlap`);
});

test('linked entries end up closer than unlinked ones; dragged ones stay put', () => {
  const p = layoutWeb(nodes, edges);
  assert.ok(distance(p.a!, p.b!) < distance(p.a!, p.f!));
  const pinned = layoutWeb(nodes, edges, { f: { x: 0.1, y: 0.9 } });
  assert.deepEqual(pinned.f, { x: 0.1, y: 0.9 });
  assert.deepEqual(layoutWeb([{ id: 'solo' }], []), { solo: { x: 0.5, y: 0.5 } });
  assert.deepEqual(layoutWeb([], []), {});
});

test('family labels', () => {
  for (const label of ['Mother', 'older brother', 'Grandfather', 'Wife', 'step-sister', 'Twin']) assert.ok(isFamily(label), label);
  for (const label of ['Rival', 'Owes a debt', 'Mentor', 'Brotherhood of the Lamp']) assert.ok(!isFamily(label), label);
});

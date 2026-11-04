import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dot, faceCenter, faceNormal, numbering, percentile, rotate, solidFor, upward, type Quat, type Vec } from './dice3d';

const SHAPES: [number, number, number][] = [
  // sides, corners, faces
  [4, 4, 4],
  [6, 8, 6],
  [8, 6, 8],
  [10, 12, 10],
  [12, 20, 12],
  [20, 12, 20],
];

test('every die is a closed convex solid with flat faces turned outward', () => {
  for (const [sides, corners, faces] of SHAPES) {
    const solid = solidFor(sides);
    assert.equal(solid.vertices.length, corners, `d${sides} corners`);
    assert.equal(solid.faces.length, faces, `d${sides} faces`);
    const edges = new Set<string>();
    for (const face of solid.faces) {
      const n = faceNormal(solid, face);
      const c = faceCenter(solid, face);
      assert.ok(dot(n, c) > 0, `d${sides} face turned outward`);
      for (const i of face) assert.ok(Math.abs(dot(n, solid.vertices[i]!) - dot(n, c)) < 1e-6, `d${sides} face flat`);
      face.forEach((a, k) => {
        const b = face[(k + 1) % face.length]!;
        edges.add([a, b].sort().join('-'));
      });
    }
    assert.equal(corners - edges.size + faces, 2, `d${sides} Euler`);
  }
});

test('the face on top is the one pointing up, however the die lies', () => {
  const d6 = solidFor(6);
  const top = upward(d6, [0, 0, 0, 1]);
  assert.deepEqual(faceNormal(d6, d6.faces[top]!).map(Math.round), [0, 1, 0]);
  // A quarter turn about x brings the face that pointed toward -z up... and so on: whichever lands up is read.
  const quarter: Quat = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
  const turned = upward(d6, quarter);
  assert.ok(rotate(faceNormal(d6, d6.faces[turned]!), quarter)[1] > 0.99);
  const d4 = solidFor(4);
  const corner = upward(d4, [0, 0, 0, 1]);
  assert.equal(Math.max(...d4.vertices.map((v: Vec) => v[1])), d4.vertices[corner]![1]);
});

test('the numbering puts the rolled number on top and keeps each number once', () => {
  const d20 = solidFor(20);
  const labels = numbering(d20, 20, 7, '13');
  assert.equal(labels[7], '13');
  assert.equal(new Set(labels).size, 20);
  const odd = numbering(solidFor(3), 3, 2, '3');
  assert.equal(odd[2], '3');
  assert.ok(odd.every((l) => ['1', '2', '3'].includes(l)));
});

test('a d100 is read off a tens die and a units die', () => {
  assert.deepEqual(percentile(47), { tens: '40', units: '7' });
  assert.deepEqual(percentile(5), { tens: '00', units: '5' });
  assert.deepEqual(percentile(100), { tens: '00', units: '0' });
});

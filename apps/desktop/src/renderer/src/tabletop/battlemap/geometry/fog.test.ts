import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultFog, type Fog } from '../model';
import { addFogOp, distanceToPath, fogged, inPolygon, rectPoints } from './fog';

const box = (x0: number, y0: number, x1: number, y1: number) => rectPoints({ x: x0, y: y0 }, { x: x1, y: y1 });

test('points in a polygon, and a box from any two corners', () => {
  const triangle = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }];
  assert.equal(inPolygon({ x: 10, y: 10 }, triangle), true);
  assert.equal(inPolygon({ x: 80, y: 80 }, triangle), false);
  assert.deepEqual(rectPoints({ x: 50, y: 60 }, { x: 10, y: 20 }), [{ x: 10, y: 20 }, { x: 50, y: 20 }, { x: 50, y: 60 }, { x: 10, y: 60 }]);
});

test('fog: off shows everything; on covers everything until revealed; strokes apply in order', () => {
  const off = defaultFog();
  assert.equal(fogged(off, { x: 5, y: 5 }), false);
  let fog: Fog = { ...off, enabled: true };
  assert.equal(fogged(fog, { x: 5, y: 5 }), true);
  fog = addFogOp(fog, { mode: 'reveal', shape: 'rect', points: box(0, 0, 100, 100) });
  assert.equal(fogged(fog, { x: 50, y: 50 }), false);
  assert.equal(fogged(fog, { x: 150, y: 50 }), true);
  // Hide part of what was revealed again.
  fog = addFogOp(fog, { mode: 'hide', shape: 'rect', points: box(40, 40, 60, 60) });
  assert.equal(fogged(fog, { x: 50, y: 50 }), true);
  assert.equal(fogged(fog, { x: 20, y: 20 }), false);
  // Reveal everything: the strokes before it are gone.
  fog = addFogOp(fog, { mode: 'reveal', shape: 'all', points: [] });
  assert.equal(fog.ops.length, 1);
  assert.equal(fogged(fog, { x: 50, y: 50 }), false);
  fog = addFogOp(fog, { mode: 'hide', shape: 'all', points: [] });
  assert.equal(fogged(fog, { x: 5, y: 5 }), true);
});

test('a brush stroke reveals (or covers) its path, so far either side', () => {
  assert.equal(distanceToPath({ x: 5, y: 3 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }]), 3);
  assert.equal(distanceToPath({ x: 13, y: 4 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }]), 5);
  assert.equal(distanceToPath({ x: 3, y: 4 }, [{ x: 0, y: 0 }]), 5);
  let fog: Fog = { enabled: true, ops: [] };
  fog = addFogOp(fog, { mode: 'reveal', shape: 'brush', points: [{ x: 0, y: 50 }, { x: 200, y: 50 }], radius: 20 });
  assert.equal(fogged(fog, { x: 100, y: 60 }), false);
  assert.equal(fogged(fog, { x: 100, y: 80 }), true);
  fog = addFogOp(fog, { mode: 'hide', shape: 'brush', points: [{ x: 100, y: 50 }], radius: 10 });
  assert.equal(fogged(fog, { x: 100, y: 55 }), true, 'a dab of the brush covers again');
  assert.equal(fogged(fog, { x: 150, y: 55 }), false);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blocked, inside, sees, segments, visibility, type Wall } from './vision';

// A 1000 × 1000 map with a wall down the middle, from the top to y 800 (a gap below it).
const wall: Wall = { id: 'w', points: [{ x: 500, y: 0 }, { x: 500, y: 800 }] };
const segs = segments([wall], 1000, 1000);

test('sight: the visibility polygon stops at walls and the map’s edge', () => {
  const poly = visibility({ x: 200, y: 200 }, segs);
  assert.ok(inside({ x: 400, y: 600 }, poly), 'this side of the wall');
  assert.ok(!inside({ x: 800, y: 200 }, poly), 'behind the wall');
  assert.ok(inside({ x: 520, y: 990 }, poly), 'round the end, through the gap');
  assert.ok(!inside({ x: 800, y: 980 }, poly), 'the wall still hides the far corner');
  assert.ok(blocked({ x: 200, y: 200 }, { x: 800, y: 200 }, [wall]));
  assert.ok(!blocked({ x: 200, y: 200 }, { x: 400, y: 900 }, [wall]));
});

test('light: in the dark, only what’s lit or within darkvision; in bright light, all in sight', () => {
  const viewer = { x: 200, y: 200, darkvision: 0 };
  const torch = { x: 300, y: 300, reach: 280 };
  assert.ok(sees({ x: 400, y: 400 }, [viewer], [torch], [wall], 'dark'), 'lit by the torch');
  assert.ok(!sees({ x: 100, y: 900 }, [viewer], [torch], [wall], 'dark'), 'in sight but dark');
  assert.ok(sees({ x: 100, y: 900 }, [viewer], [torch], [wall], 'bright'), 'in sight, bright');
  assert.ok(sees({ x: 100, y: 500 }, [{ ...viewer, darkvision: 420 }], [], [wall], 'dark'), 'darkvision');
  assert.ok(!sees({ x: 700, y: 200 }, [viewer], [{ x: 700, y: 300, reach: 300 }], [wall], 'dark'), 'lit, but behind the wall');
});

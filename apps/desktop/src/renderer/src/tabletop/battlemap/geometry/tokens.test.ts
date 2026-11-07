import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultGrid, type GridSettings } from '../model';
import { cellCenter } from './grid';
import { freeSpot, inBox, nextName, nudge, sizeFromKind, snapToken, tokenWidth } from './tokens';

const grid = (changes: Partial<GridSettings> = {}): GridSettings => ({ ...defaultGrid(), size: 50, ...changes });

test('snapping: a square’s middle, or a corner for 2×2 and 4×4; hexes’ middles', () => {
  const g = grid({ offsetX: 10 });
  assert.deepEqual(snapToken(g, { x: 70, y: 40 }, 'medium'), { x: 85, y: 25 });
  assert.deepEqual(snapToken(g, { x: 70, y: 40 }, 'tiny'), { x: 85, y: 25 });
  assert.deepEqual(snapToken(g, { x: 70, y: 40 }, 'huge'), { x: 85, y: 25 });
  assert.deepEqual(snapToken(g, { x: 70, y: 40 }, 'large'), { x: 60, y: 50 });
  assert.deepEqual(snapToken(g, { x: 88, y: 74 }, 'gargantuan'), { x: 110, y: 50 });
  const hex = grid({ kind: 'hexRows' });
  const middle = cellCenter(hex, { col: 2, row: 1 });
  assert.deepEqual(snapToken(hex, { x: middle.x + 5, y: middle.y - 5 }, 'large'), middle);
  assert.equal(tokenWidth(g, 'large'), 100);
});

test('nudging: a square over, or the neighboring hex that way', () => {
  assert.deepEqual(nudge(grid(), { x: 75, y: 75 }, 1, 0), { x: 125, y: 75 });
  assert.deepEqual(nudge(grid(), { x: 75, y: 75 }, 0, -1), { x: 75, y: 25 });
  for (const kind of ['hexRows', 'hexColumns'] as const) {
    const g = grid({ kind });
    const from = cellCenter(g, { col: 0, row: 0 });
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const to = nudge(g, from, dx, dy);
      assert.equal(Math.round(Math.hypot(to.x - from.x, to.y - from.y)), 50, `${kind} ${dx},${dy}: one hex over`);
      assert.ok((to.x - from.x) * dx + (to.y - from.y) * dy > 0, `${kind} ${dx},${dy}: that way`);
    }
  }
});

test('a creature’s size from its type, and numbering more of the same', () => {
  assert.equal(sizeFromKind('Huge aberration, chaotic evil'), 'huge');
  assert.equal(sizeFromKind('Tiny undead, neutral evil'), 'tiny');
  assert.equal(sizeFromKind('Medium dragon (dragons, chromatic), chaotic evil'), 'medium');
  assert.equal(sizeFromKind(''), 'medium');
  assert.equal(nextName('Brine Ghoul', []), 'Brine Ghoul');
  assert.equal(nextName('Brine Ghoul', ['Brine Ghoul']), 'Brine Ghoul 2');
  assert.equal(nextName('Brine Ghoul', ['brine ghoul', 'Brine Ghoul 2']), 'Brine Ghoul 3');
});

test('box selection takes the tokens whose middles are inside', () => {
  const tokens = [
    { id: 'a', x: 10, y: 10 },
    { id: 'b', x: 50, y: 60 },
    { id: 'c', x: 200, y: 10 },
  ];
  assert.deepEqual(inBox(tokens, { x: 100, y: 100 }, { x: 0, y: 0 }), ['a', 'b']);
});

test('a free spot: the square asked for, else the nearest one around it that nothing covers', () => {
  const g = grid();
  assert.deepEqual(freeSpot(g, { x: 130, y: 130 }, 'medium', []), { x: 125, y: 125 });
  const taken = [{ x: 125, y: 125, size: 'medium' as const }];
  const next = freeSpot(g, { x: 130, y: 130 }, 'medium', taken);
  assert.equal(Math.max(Math.abs(next.x - 125), Math.abs(next.y - 125)), 50, 'one square over');
  // A 2×2 creature in the way: a medium token goes clear of all four of its squares.
  const big = [{ x: 100, y: 100, size: 'large' as const }];
  const clear = freeSpot(g, { x: 100, y: 100 }, 'medium', big);
  assert.ok(Math.abs(clear.x - 100) >= 75 || Math.abs(clear.y - 100) >= 75, `${clear.x}, ${clear.y}`);
});

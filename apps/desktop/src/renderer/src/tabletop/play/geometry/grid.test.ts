import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultGrid, type GridSettings } from '../model';
import { cellAt, cellCenter, gridPath, hexCorners, lineUp, measure, snap } from './grid';

const grid = (changes: Partial<GridSettings> = {}): GridSettings => ({ ...defaultGrid(), size: 50, ...changes });

test('squares: which one a point is in, its middle, and snapping to it', () => {
  const g = grid({ offsetX: 10, offsetY: 20 });
  assert.deepEqual(cellAt(g, { x: 10, y: 20 }), { col: 0, row: 0 });
  assert.deepEqual(cellAt(g, { x: 59.9, y: 69.9 }), { col: 0, row: 0 });
  assert.deepEqual(cellAt(g, { x: 60, y: 70 }), { col: 1, row: 1 });
  assert.deepEqual(cellAt(g, { x: 0, y: 0 }), { col: -1, row: -1 });
  assert.deepEqual(cellCenter(g, { col: 2, row: 1 }), { x: 135, y: 95 });
  assert.deepEqual(snap(g, { x: 140, y: 80 }), { x: 135, y: 95 });
});

test('hexes: a hex’s middle is in that hex, and its six neighbors are one away', () => {
  for (const kind of ['hexRows', 'hexColumns'] as const) {
    const g = grid({ kind, offsetX: 33, offsetY: 41 });
    for (const c of [{ col: 0, row: 0 }, { col: 3, row: -2 }, { col: -4, row: 5 }]) {
      assert.deepEqual(cellAt(g, cellCenter(g, c)), c, `${kind} ${c.col},${c.row}`);
    }
    const middle = cellCenter(g, { col: 0, row: 0 });
    const around = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]].map(([col, row]) => cellCenter(g, { col: col!, row: row! }));
    for (const p of around) {
      assert.equal(Math.round(Math.hypot(p.x - middle.x, p.y - middle.y)), 50, `${kind}: neighbors are a hex's width apart`);
      assert.equal(measure(g, [middle, p]).cells, 1);
    }
    // A corner of the middle hex is just inside it.
    const corner = hexCorners(kind, 50, middle)[0]!;
    assert.deepEqual(cellAt(g, { x: middle.x + (corner.x - middle.x) * 0.95, y: middle.y + (corner.y - middle.y) * 0.95 }), { col: 0, row: 0 });
    assert.equal(measure(g, [middle, cellCenter(g, { col: 3, row: -1 })]).cells, 3);
  }
});

test('measuring on squares: every diagonal 5 ft, alternating 5 / 10, or the true distance', () => {
  const start = { x: 25, y: 25 };
  const diag3 = { x: 175, y: 175 }; // three squares down and across
  assert.deepEqual(measure(grid(), [start, diag3]), { cells: 3, distance: 15 });
  assert.deepEqual(measure(grid({ diagonals: 'alternating' }), [start, diag3]), { cells: 4, distance: 20 });
  assert.deepEqual(measure(grid({ diagonals: 'euclidean' }), [start, diag3]), { cells: 4.2, distance: 21.2 });
  // A straight line counts the same either way.
  assert.deepEqual(measure(grid({ diagonals: 'alternating' }), [start, { x: 325, y: 25 }]), { cells: 6, distance: 30 });
  // Alternating counts over the whole path: one diagonal, then another, is 5 then 10.
  const g = grid({ diagonals: 'alternating' });
  assert.deepEqual(measure(g, [start, { x: 75, y: 75 }]), { cells: 1, distance: 5 });
  assert.deepEqual(measure(g, [start, { x: 75, y: 75 }, { x: 125, y: 125 }]), { cells: 3, distance: 15 });
  // Another unit and distance per square.
  assert.deepEqual(measure(grid({ distance: 10, unit: 'm' }), [start, diag3]), { cells: 3, distance: 30 });
  assert.deepEqual(measure(grid(), [start]), { cells: 0, distance: 0 });
});

test('lining up: a box over one square sets the size and where squares start', () => {
  assert.deepEqual(lineUp('square', { x: 105, y: 35, w: 70, h: 70 }), { size: 70, offsetX: 35, offsetY: 35 });
  // Dragged up and left, and a little uneven.
  assert.deepEqual(lineUp('square', { x: 175, y: 105, w: -70, h: -72 }), { size: 71, offsetX: 34, offsetY: 33 });
  // Hexes: the box's width (rows) or height (columns), centered on the hex.
  assert.deepEqual(lineUp('hexRows', { x: 100, y: 100, w: 60, h: 70 }), { size: 60, offsetX: 130, offsetY: 135 });
  assert.deepEqual(lineUp('hexColumns', { x: 100, y: 100, w: 70, h: 60 }), { size: 60, offsetX: 135, offsetY: 130 });
  assert.equal(lineUp('square', { x: 0, y: 0, w: 2, h: 2 }), null);
});

test('the grid’s lines: squares as lines across, hexes as outlines', () => {
  const squares = gridPath(grid({ offsetX: 10 }), 100, 100)!;
  assert.equal(squares, 'M10 0V100M60 0V100M0 0H100M0 50H100M0 100H100');
  const hexes = gridPath(grid({ kind: 'hexRows' }), 200, 200)!;
  assert.ok(hexes.split('Z').length > 10);
  assert.equal(gridPath(grid({ size: 2 }), 100, 100), null);
});

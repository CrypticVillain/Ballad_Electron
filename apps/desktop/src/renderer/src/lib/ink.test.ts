import './test-env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodePoints, encodePoints, erasePoints, eraseStrokes, inkSvg, insidePolygon, lassoed, pointsOf, strokeBox, strokeHit, strokePath, transformStrokes, type InkPoint } from './ink';
import type { InkStroke } from './model';

let n = 0;
const id = () => `s${++n}`;
const line = (x0: number, y0: number, x1: number, y1: number, steps = 20): InkPoint[] =>
  Array.from({ length: steps + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, 0.5] as InkPoint);
const stroke = (points: InkPoint[], extra: Partial<InkStroke> = {}): InkStroke => ({ id: id(), tool: 'pen', color: 'ink', size: 6, points: encodePoints(points), ...extra });

test('points pack small and come back the same (to a tenth of a unit)', () => {
  const pts: InkPoint[] = [
    [10.04, 20.06, 0.5],
    [11.5, 22.25, 0.73],
    [400.12, 7.9, 1],
  ];
  const packed = encodePoints(pts);
  assert.ok(packed.every(Number.isInteger));
  assert.deepEqual(decodePoints(packed), [
    [10, 20.1, 0.5],
    [11.5, 22.3, 0.73],
    [400.1, 7.9, 1],
  ]);
  // Deltas: a long smooth stroke is mostly small numbers.
  const long = encodePoints(line(0, 0, 500, 300, 200));
  assert.ok(long.slice(3).every((v) => Math.abs(v) <= 25));
});

test('a stroke draws as a closed outline, and is found near its line', () => {
  const s = stroke(line(100, 100, 300, 100));
  assert.match(strokePath(pointsOf(s), 'pen', 6), /^M[\d.]+ [\d.]+ Q.* Z$/);
  assert.ok(strokeHit(s, 200, 104, 2));
  assert.ok(!strokeHit(s, 200, 130, 2));
  const box = strokeBox(s);
  assert.deepEqual([box.x, box.y, box.w, box.h], [97, 97, 206, 6]);
});

test('the eraser: whole strokes, or just the part it touches (a stroke cut in two)', () => {
  const a = stroke(line(0, 50, 400, 50));
  const b = stroke(line(0, 200, 400, 200));
  const path: [number, number][] = [
    [200, 40],
    [200, 60],
  ];
  assert.deepEqual(
    eraseStrokes([a, b], path, 10).map((s) => s.id),
    [b.id],
  );
  const cut = erasePoints([a, b], path, 10, id);
  assert.equal(cut.length, 3);
  assert.equal(cut[2], b); // untouched strokes stay as they were
  const [left, right] = cut.map((s) => pointsOf(s));
  assert.ok(left!.at(-1)![0] < 200 && right![0]![0] > 200);
  assert.ok(cut.slice(0, 2).every((s) => s.color === a.color && s.size === a.size && s.id !== a.id));
});

test('the lasso picks strokes mostly inside it; moving and resizing scale sizes too', () => {
  const inside = stroke(line(110, 110, 190, 190));
  const half = stroke(line(150, 150, 400, 150)); // only a little inside
  const lasso: [number, number][] = [
    [100, 100],
    [200, 100],
    [200, 200],
    [100, 200],
  ];
  assert.ok(insidePolygon(150, 150, lasso) && !insidePolygon(250, 150, lasso));
  assert.deepEqual(lassoed([inside, half], lasso), [inside.id]);
  const box = strokeBox(inside);
  const moved = transformStrokes([inside, half], new Set([inside.id]), box, { ...box, x: box.x + 100, w: box.w * 2, h: box.h * 2 });
  assert.equal(moved[1], half);
  const m = strokeBox(moved[0]!);
  assert.ok(Math.abs(m.x - (box.x + 100)) < 8);
  assert.equal(moved[0]!.size, 12);
});

test('as a picture: cropped to the ink, highlighters underneath, colors as given', () => {
  const pen = stroke(line(100, 100, 300, 100));
  const marker = stroke(line(100, 100, 300, 100), { tool: 'highlighter', color: 'yellow', size: 26 });
  const { svg, width, height } = inkSvg([pen, marker], (c) => (c === 'ink' ? '#111' : '#ee0'), { background: '#fff' });
  assert.ok(width < 300 && height < 100);
  assert.ok(svg.indexOf('#ee0') < svg.indexOf('#111'));
  assert.ok(svg.includes('fill-opacity="0.35"') && svg.includes('fill="#fff"'));
});

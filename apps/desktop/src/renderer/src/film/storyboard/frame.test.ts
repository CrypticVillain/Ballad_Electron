import '@/lib/test-env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodePoints } from '@/lib/ink';
import type { Shot } from '@/lib/model';
import { frameStart } from './FramePad';

const shot = (more: Partial<Shot>): Shot => ({ id: 's', createdAt: '', updatedAt: '', deletedAt: null, worldId: 'w', sceneId: 'c', order: 0, size: 'WS', move: 'Static', lens: '', description: '', seconds: 3, status: 'planned', ...more });

test('a frame drawn with handwriting starts from its drawing and its picture underneath', () => {
  const ink = [{ id: 'a', tool: 'pen' as const, color: 'red' as const, size: 4, points: [1, 2, 5] }];
  assert.deepEqual(frameStart(shot({ ink, base: 'photo.png', frame: 'frame.png' })), { base: 'photo.png', strokes: ink });
  assert.deepEqual(frameStart(shot({})), { base: null, strokes: [] });
});

test('a sketch from before handwriting: its strokes, scaled to the 1000-wide frame, in the nearest colors', () => {
  const start = frameStart(shot({ frame: 'old.png', sketch: [{ color: '#dc2626', width: 7, points: [0, 0, 1280, 720] }] }));
  assert.equal(start.base, null);
  assert.equal(start.strokes.length, 1);
  const s = start.strokes[0]!;
  assert.deepEqual([s.color, s.tool, Math.round(s.size * 100) / 100], ['red', 'pen', 5.47]);
  const pts = decodePoints(s.points);
  assert.deepEqual([Math.round(pts[1]![0]), Math.round(pts[1]![1])], [1000, 563]);
});

test('a sketch with the eraser in it stays as the picture underneath (it can’t be undone stroke by stroke)', () => {
  const start = frameStart(shot({ frame: 'old.png', sketch: [{ color: '#111111', width: 3, points: [0, 0, 10, 10] }, { color: '#111111', width: 7, points: [5, 5], erase: true }] }));
  assert.deepEqual(start, { base: 'old.png', strokes: [] });
});

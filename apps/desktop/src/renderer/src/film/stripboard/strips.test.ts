import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayOutOfDays, moveStrip, stripTone } from './strips';

test('moving a strip between days, within a day, and off the board', () => {
  const days = [
    { id: 'd1', sceneIds: ['a', 'b', 'c'] },
    { id: 'd2', sceneIds: ['x'] },
  ];
  assert.deepEqual(moveStrip(days, 'b', 'd2', 0), { d1: ['a', 'c'], d2: ['b', 'x'] });
  assert.deepEqual(moveStrip(days, 'a', 'd1', 3), { d1: ['b', 'c', 'a'] });
  assert.deepEqual(moveStrip(days, 'c', 'd1', 0), { d1: ['c', 'a', 'b'] });
  assert.deepEqual(moveStrip(days, 'a', 'd1', 1), {});
  assert.deepEqual(moveStrip(days, 'x', null, 0), { d2: [] });
  assert.deepEqual(moveStrip(days, 'new', 'd2', 5), { d2: ['x', 'new'] });
});

test('strip colors by interior/exterior and day/night', () => {
  assert.equal(stripTone({ ie: 'INT', place: '', time: 'DAY' }), 'intDay');
  assert.equal(stripTone({ ie: 'EXT', place: '', time: 'NIGHT' }), 'extNight');
  assert.equal(stripTone({ ie: 'EXT', place: '', time: 'DUSK' }), 'extNight');
  assert.equal(stripTone({ ie: '', place: '', time: '' }), 'intDay');
});

test('Day Out Of Days: start, work, hold, finish', () => {
  const days = [
    { id: '1', sceneIds: ['s1'] },
    { id: '2', sceneIds: ['s2'] },
    { id: '3', sceneIds: ['s3'] },
    { id: '4', sceneIds: ['s1', 's3'] },
  ];
  const cast: Record<string, string[]> = { s1: ['ines', 'ashe'], s2: ['tomas'], s3: ['ines'] };
  const rows = dayOutOfDays(days, (s) => cast[s] ?? [], ['ines', 'tomas', 'ashe', 'nobody']);
  assert.deepEqual(rows.map((r) => [r.castId, r.cells.join(' '), r.work, r.hold]), [
    ['ines', 'SW H W WF', 3, 1],
    ['tomas', ' SWF  ', 1, 0],
    ['ashe', 'SW H H WF', 2, 2],
  ]);
});

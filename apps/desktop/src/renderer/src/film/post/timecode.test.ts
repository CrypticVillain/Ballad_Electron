import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock, cueLength, toSeconds } from './timecode';

test('timecode to seconds, and back as a clock', () => {
  assert.equal(toSeconds('2:10'), 130);
  assert.equal(toSeconds('1:02:10'), 3730);
  assert.equal(toSeconds('01:00:00:12'), 3600.5);
  assert.equal(toSeconds('soon'), null);
  assert.equal(clock(130), '2:10');
  assert.equal(clock(3725), '1:02:05');
  assert.equal(cueLength('01:02:10:00', '01:03:40:00'), '1:30');
  assert.equal(cueLength('2:00', '1:00'), '');
});

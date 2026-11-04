import './test-env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatTime } from './dates';

test('times show on a 12- or 24-hour clock', () => {
  assert.equal(formatTime('19:00', '12'), '7:00 PM');
  assert.equal(formatTime('00:15', '12'), '12:15 AM');
  assert.equal(formatTime('12:30', '12'), '12:30 PM');
  assert.equal(formatTime('19:00', '24'), '19:00');
  assert.equal(formatTime('7:05', '24'), '07:05');
  assert.equal(formatTime('', '12'), '');
  assert.equal(formatTime('25:00', '24'), '');
});

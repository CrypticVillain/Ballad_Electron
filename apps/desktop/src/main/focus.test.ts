import assert from 'node:assert/strict';
import { test } from 'node:test';
import { noFocus } from './focus';

test('a test’s windows stay out of the focus by default; your own launch takes it', () => {
  // As Playwright starts the app (no flag of ours).
  assert.equal(noFocus(['electron', '--inspect=0', '--remote-debugging-port=0', 'apps/desktop', '--profile=e2e-1']), true);
  assert.equal(noFocus(['electron', '--remote-debugging-port=9222', '.']), true);
  // A launch of your own: the installed app, npm run dev.
  assert.equal(noFocus(['Ballad.exe']), false);
  assert.equal(noFocus(['electron', '.', '--profile=second']), false);
  // Asked for either way.
  assert.equal(noFocus(['electron', '.', '--no-focus']), true);
  assert.equal(noFocus(['electron', '--remote-debugging-port=0', '.', '--focus']), false, 'to watch a test');
  assert.equal(noFocus(['electron', '.', '--no-focus', '--focus']), false);
});

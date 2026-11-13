import '@/lib/test-env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renameTabletop } from './preferences';

test('preferences saved under D&D’s names come back in Tabletop’s', () => {
  const saved: Record<string, unknown> = {
    theme: 'dark',
    sections: { default: 'dnd', other: 'film' },
    worldIds: { default: 'w-writing', 'default/dnd': 'w-campaign', 'default/film': 'w-film' },
    dndRoles: { default: 'dm', other: 'player' },
    confirmDeletes: { 'dnd:maps': false, 'writing:bible': false },
    nameGenres: { dnd: 'elvish', writing: 'norse' },
  };
  assert.equal(renameTabletop(saved), true);
  assert.deepEqual(saved, {
    theme: 'dark',
    sections: { default: 'tabletop', other: 'film' },
    worldIds: { default: 'w-writing', 'default/tabletop': 'w-campaign', 'default/film': 'w-film' },
    tabletopRoles: { default: 'gm', other: 'player' },
    confirmDeletes: { 'tabletop:maps': false, 'writing:bible': false },
    nameGenres: { tabletop: 'elvish', writing: 'norse' },
  });
  // Already in the new names: nothing to do.
  assert.equal(renameTabletop(saved), false);
});

test('Play’s scenes’ delete setting moved with Play to its own section', () => {
  const saved: Record<string, unknown> = { confirmDeletes: { 'tabletop:play': false, 'tabletop:maps': true } };
  assert.equal(renameTabletop(saved), true);
  assert.deepEqual(saved.confirmDeletes, { 'play:scenes': false, 'tabletop:maps': true });
});

test('the suite’s look replaces yours only when it’s newer than your last change', async () => {
  const { lookOf, usePreferences } = await import('./preferences');
  const prefs = () => usePreferences.getState();
  prefs().setLook({ style: 'codex', theme: 'light', text: 'body' });
  const mine = prefs().lookAt;
  assert.deepEqual(lookOf(prefs()), { style: 'codex', theme: 'light', text: 'body', effects: 'full' });
  // Saved by the setup before your change: kept as you set it.
  prefs().takeSuiteLook({ style: 'voltage', theme: 'dark', text: 'themed', effects: 'reduced', at: mine - 1, by: 'setup' });
  assert.equal(prefs().style, 'codex');
  // Applied to all by another app afterwards: taken, with its time.
  prefs().takeSuiteLook({ style: 'voltage', theme: 'dark', text: 'themed', effects: 'reduced', at: mine + 1, by: 'harmony' });
  assert.deepEqual(lookOf(prefs()), { style: 'voltage', theme: 'dark', text: 'themed', effects: 'reduced' });
  assert.equal(prefs().lookAt, mine + 1);
  prefs().takeSuiteLook(null);
  assert.equal(prefs().style, 'voltage');
});

test('changing the theme alone is your own change to the look', async () => {
  const { usePreferences } = await import('./preferences');
  usePreferences.setState({ lookAt: 0 });
  usePreferences.getState().setPreference('theme', 'dark');
  assert.ok(usePreferences.getState().lookAt > 0);
});

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

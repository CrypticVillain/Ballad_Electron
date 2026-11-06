import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate } from './migrate';
import { VAULT_VERSION, type Vault } from './model';

test('version 3: the character a campaign said you play becomes yours, with its journal; the campaign forgets the role', () => {
  const t = '2026-11-01T00:00:00.000Z';
  const base = { createdAt: t, updatedAt: t, deletedAt: null };
  const old = {
    version: 2,
    worlds: { w1: { ...base, id: 'w1', section: 'dnd', name: 'Lantern', genre: '', era: '', summary: '', order: 1, dnd: { role: 'player', myCharacterId: 'pc1', nextSession: '', ruleset: '5e' } } },
    pcs: { pc1: { ...base, id: 'pc1', worldId: 'w1', name: 'Kael' }, pc2: { ...base, id: 'pc2', worldId: 'w1', name: 'Brin' } },
    books: { b1: { ...base, id: 'b1', worldId: 'w1', title: 'Journal', partNoun: 'Arc', targetWords: 0, order: 1, audience: 'player' } },
  } as unknown as Partial<Vault>;
  const vault = migrate(old);
  assert.equal(vault.version, VAULT_VERSION);
  assert.equal(vault.pcs.pc1!.mine, true);
  assert.equal(vault.pcs.pc2!.mine, undefined);
  assert.equal(vault.books.b1!.characterId, 'pc1');
  assert.deepEqual(vault.worlds.w1!.tabletop, { nextSession: '', ruleset: '5e' });
  assert.deepEqual(vault.maps, {});
});

test('version 5: D&D is Tabletop and the DM the GM, in worlds, books, map pins and what was shared of them', () => {
  const t = '2026-11-01T00:00:00.000Z';
  const base = { createdAt: t, updatedAt: t, deletedAt: null };
  const pins = [
    { id: 'p1', x: 0, y: 0, label: 'Gate', note: '', tone: 'place' },
    { id: 'p2', x: 1, y: 1, label: 'Trap', note: '', tone: 'danger', dmOnly: true },
  ];
  const old = {
    version: 4,
    worlds: {
      w1: { ...base, id: 'w1', section: 'dnd', name: 'Lantern', genre: '', era: '', summary: '', order: 1, dnd: { nextSession: '2026-11-12', ruleset: '5e' } },
      w2: { ...base, id: 'w2', section: 'writing', name: 'Glass', genre: '', era: '', summary: '', order: 2 },
    },
    books: { b1: { ...base, id: 'b1', worldId: 'w1', title: 'Log', partNoun: 'Arc', targetWords: 0, order: 1, audience: 'dm' } },
    maps: { m1: { ...base, id: 'm1', worldId: 'w1', characterId: null, name: 'Causeway', image: 'a.png', width: 1, height: 1, order: 0, pins } },
    shares: { s1: { ...base, id: 's1', worldId: 'w1', collection: 'maps', sourceId: 'm1', snapshot: { name: 'Causeway', pins }, version: 1, recipients: ['pc1'] } },
    copies: { 's1:pc1': { ...base, id: 's1:pc1', shareId: 's1', pcId: 'pc1', showing: 'edited', edited: { pins } } },
  } as unknown as Partial<Vault>;
  const vault = migrate(old);
  const w1 = vault.worlds.w1! as typeof vault.worlds.w1 & { dnd?: unknown };
  assert.equal(w1.section, 'tabletop');
  assert.deepEqual(w1.tabletop, { nextSession: '2026-11-12', ruleset: '5e' });
  assert.equal(w1.dnd, undefined);
  assert.equal(vault.worlds.w2!.section, 'writing');
  assert.equal(vault.worlds.w2!.tabletop, undefined);
  assert.equal(vault.books.b1!.audience, 'gm');
  const renamed = (list: unknown) => (list as { gmOnly?: boolean; dmOnly?: boolean }[]).map((p) => [p.gmOnly, p.dmOnly]);
  assert.deepEqual(renamed(vault.maps.m1!.pins), [[undefined, undefined], [true, undefined]]);
  assert.deepEqual(renamed(vault.shares.s1!.snapshot.pins), [[undefined, undefined], [true, undefined]]);
  assert.deepEqual(renamed(vault.copies['s1:pc1']!.edited!.pins), [[undefined, undefined], [true, undefined]]);
  // Running it again changes nothing.
  assert.deepEqual(migrate(structuredClone(vault)), vault);
});

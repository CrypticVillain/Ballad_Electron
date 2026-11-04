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
  assert.deepEqual(vault.worlds.w1!.dnd, { nextSession: '', ruleset: '5e' });
  assert.deepEqual(vault.maps, {});
});

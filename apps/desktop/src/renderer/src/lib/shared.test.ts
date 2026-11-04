import './test-env';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createEntry, createPc, createWorld, updateEntry } from './actions';
import { migrate } from './migrate';
import { emptyVault, live } from './model';
import { editShared, setRecipients, shareItems, shareOf, shareStatus, showShared, unlockShared, updateShares } from './shared';
import { useVault } from '@/stores/vault';

const vault = () => useVault.getState().vault;

beforeEach(() => useVault.setState({ vault: emptyVault() }));

function campaign() {
  const { world } = createWorld({ name: 'Lantern', section: 'dnd' });
  const a = createPc(world.id, { name: 'Kael' });
  const b = createPc(world.id, { name: 'Brin' });
  const npc = createEntry(world.id, 'character', { name: 'Nessa', about: 'Rows out at low tide.' });
  return { world, a, b, npc };
}

test('players get a copy: the DM’s edits reach them only on Update Shared', () => {
  const { world, a, npc } = campaign();
  shareItems({ worldId: world.id, collection: 'entries', ids: [npc.id], recipients: [a.id], mode: 'add' });
  const share = shareOf(npc.id)!;
  assert.deepEqual(share.recipients, [a.id]);
  updateEntry(npc.id, { about: 'Owes the Abbot.' });
  assert.equal(shareStatus(shareOf(npc.id)!), 'changed');
  assert.equal((shareOf(npc.id)!.snapshot as { about: string }).about, 'Rows out at low tide.');
  assert.equal(updateShares([share.id]), 1);
  assert.equal((shareOf(npc.id)!.snapshot as { about: string }).about, 'Owes the Abbot.');
  assert.equal(shareOf(npc.id)!.version, 2);
  assert.equal(shareStatus(shareOf(npc.id)!), 'current');
});

test('sharing several adds people; one at a time sets exactly who; nobody stops it', () => {
  const { world, a, b, npc } = campaign();
  shareItems({ worldId: world.id, collection: 'entries', ids: [npc.id], recipients: [a.id], mode: 'add' });
  shareItems({ worldId: world.id, collection: 'entries', ids: [npc.id], recipients: [b.id], mode: 'add' });
  assert.deepEqual(shareOf(npc.id)!.recipients, [a.id, b.id]);
  shareItems({ worldId: world.id, collection: 'entries', ids: [npc.id], recipients: [b.id], mode: 'exact' });
  assert.deepEqual(shareOf(npc.id)!.recipients, [b.id]);
  setRecipients(shareOf(npc.id)!.id, []);
  assert.equal(shareOf(npc.id), undefined);
});

test('the structure goes along only when asked', () => {
  const { world, a, npc } = campaign();
  shareItems({ worldId: world.id, collection: 'entries', ids: [npc.id], recipients: [a.id], mode: 'add' });
  assert.equal(shareOf(npc.id)!.place, undefined);
  shareItems({ worldId: world.id, collection: 'entries', ids: [npc.id], recipients: [a.id], mode: 'add', places: { [npc.id]: { space: 'Allies', folder: 'Smugglers' } } });
  assert.deepEqual(shareOf(npc.id)!.place, { space: 'Allies', folder: 'Smugglers' });
});

test('a player unlocks to keep their own version, and switches back and forth', () => {
  const { world, a, npc } = campaign();
  shareItems({ worldId: world.id, collection: 'entries', ids: [npc.id], recipients: [a.id], mode: 'add' });
  const id = shareOf(npc.id)!.id;
  editShared(id, a.id, { about: 'Not yet unlocked' });
  assert.equal(live(vault().copies).length, 0);
  unlockShared(id, a.id);
  editShared(id, a.id, { about: 'Owes us a favor.' });
  const copy = () => vault().copies[`${id}:${a.id}`]!;
  assert.equal(copy().showing, 'edited');
  assert.equal((copy().edited as { about: string }).about, 'Owes us a favor.');
  showShared(id, a.id, 'original');
  editShared(id, a.id, { about: 'Ignored while showing the DM’s' });
  assert.equal((copy().edited as { about: string }).about, 'Owes us a favor.');
  showShared(id, a.id, 'edited');
  assert.equal(copy().showing, 'edited');
  assert.equal(vault().entries[npc.id]!.about, 'Rows out at low tide.');
});

test('migrating: what players could see before is shared with the whole party', () => {
  const { world, a, b, npc } = campaign();
  const hidden = createEntry(world.id, 'lore', { name: 'The Oath', secret: true });
  const old = { ...vault(), version: 3, shares: {}, copies: {} };
  const next = migrate(old);
  const shares = live(next.shares);
  assert.equal(shares.length, 1);
  assert.equal(shares[0]!.sourceId, npc.id);
  assert.deepEqual([...shares[0]!.recipients].sort(), [a.id, b.id].sort());
  assert.ok(!shares.some((s) => s.sourceId === hidden.id));
});

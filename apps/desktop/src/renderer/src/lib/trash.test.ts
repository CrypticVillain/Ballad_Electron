import './test-env';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createEntry, createPart, createScene, createWorld, trash, trashPart, trashWorld } from './actions';
import { emptyVault } from './model';
import { deletions, purgePlan, restorePlan } from './trash';
import { useVault } from '@/stores/vault';

const vault = () => useVault.getState().vault;
beforeEach(() => useVault.setState({ vault: emptyVault() }));

/** Moves every deletedAt back by `ms`, as if those deletes happened earlier. */
const age = (ms: number) => {
  const v = structuredClone(vault());
  for (const c of Object.values(v)) if (c && typeof c === 'object') for (const r of Object.values(c as Record<string, { deletedAt?: string | null }>)) if (r?.deletedAt) r.deletedAt = new Date(Date.parse(r.deletedAt) - ms).toISOString();
  useVault.setState({ vault: v });
};

test('a delete is one deletion, named for what matters most; restoring brings back what it sits in', () => {
  const { world, scene } = createWorld({ name: 'Kiln' });
  const act2 = createPart(scene.bookId, { title: 'The Tide' });
  const s2 = createScene(scene.bookId, act2.id, { title: 'Low Water' });
  createScene(scene.bookId, act2.id, { title: 'High Water' });
  trashPart(act2.id);
  age(10_000);
  const edda = createEntry(world.id, 'character', { name: 'Edda' });
  trash('entries', edda.id);

  const list = deletions(vault());
  assert.deepEqual(
    list.map((d) => `${d.lead.noun} ${d.lead.name} +${d.more}`),
    ['Character Edda +0', 'Act The Tide +2'],
  );
  assert.equal(list[1]!.worldId, world.id);

  // A scene restored on its own brings its act back too.
  const sceneOnly = { ...list[1]!, refs: [{ collection: 'scenes' as const, id: s2.id }] };
  assert.deepEqual(
    restorePlan(vault(), sceneOnly).map((r) => r.collection).sort(),
    ['parts', 'scenes'],
  );
});

test('a world deleted forever takes everything in it', () => {
  const { world, scene } = createWorld({ name: 'Gone' });
  const keep = createWorld({ name: 'Kept' });
  createEntry(world.id, 'place', { name: 'Harbor' });
  trashWorld(world.id);
  const d = deletions(vault())[0]!;
  assert.equal(d.lead.noun, 'World');
  const purged = new Set(purgePlan(vault(), d).map((r) => r.id));
  assert.ok(purged.has(world.id) && purged.has(scene.id) && purged.has(scene.bookId) && purged.has(scene.partId));
  assert.ok(!purged.has(keep.world.id) && !purged.has(keep.scene.id));
});

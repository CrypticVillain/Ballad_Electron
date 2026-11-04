import './test-env';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { activeWorld, createEntry, createPart, createScene, createWorld, openWorld, removeSampleContent, scenesInOrder, shift, trashPart, trashWorld, updateSceneContent } from './actions';
import { today } from './dates';
import { migrate } from './migrate';
import { emptyVault, live } from './model';
import { seedStarterContent } from './seed';
import { currentSection, usePreferences } from '@/stores/preferences';
import { useVault } from '@/stores/vault';

const vault = () => useVault.getState().vault;
const para = (...content: unknown[]) => ({ type: 'paragraph', content, children: [] });

beforeEach(() => {
  useVault.setState({ vault: emptyVault() });
  usePreferences.setState({ sections: {}, worldIds: {} });
});

test('a new world comes with a book, an act and a scene', () => {
  const { world, scene } = createWorld({ name: 'Hollow Crown' });
  const book = vault().books[scene.bookId]!;
  assert.equal(book.worldId, world.id);
  assert.equal(vault().parts[scene.partId]!.bookId, book.id);
  assert.deepEqual(scenesInOrder(book.id).map((s) => s.id), [scene.id]);
});

test('sections: each has its own worlds, open world and defaults; older vaults become Writing', () => {
  seedStarterContent();
  const worlds = live(vault().worlds);
  assert.deepEqual(worlds.map((w) => w.section).sort(), ['dnd', 'film', 'writing']);
  assert.equal(activeWorld()?.section, 'writing');
  assert.equal(activeWorld('film')?.name, 'How Glass Is Made');

  // A new production gets a script (sequences, no word goal) and production details; it opens Filmmaking.
  const { world: film, scene } = createWorld({ section: 'film', name: 'Ad Spot' });
  assert.equal(currentSection(), 'film');
  assert.equal(activeWorld()?.id, film.id);
  assert.equal(film.film?.stage, 'idea');
  assert.equal(vault().books[scene.bookId]!.partNoun, 'Sequence');
  // Writing still opens the world it had.
  assert.equal(activeWorld('writing')?.name, 'The Glass Archipelago');

  // A campaign's sessions are numbered; its NPCs get D&D's spec rows.
  const { world: campaign, scene: first } = createWorld({ section: 'dnd', name: 'Ice Road' });
  assert.equal(first.title, 'Session 1');
  assert.equal(createScene(first.bookId, first.partId).title, 'Session 2');
  assert.deepEqual(createEntry(campaign.id, 'character').specs.map((s) => s.label), ['Species', 'Role', 'Found At', 'Voice', 'Wants']);

  // A vault from before sections.
  const old = migrate({ version: 1, worlds: { a: { ...film, section: undefined as never, film: undefined } } });
  assert.equal(old.worlds.a!.section, 'writing');
  assert.deepEqual(old.encounters, {});
});

test('each account remembers its own open world', () => {
  const { world: first } = createWorld({ name: 'First' });
  const { world: second } = createWorld({ name: 'Second' });
  // Making a world opens it (in the open account, "default" under test).
  assert.equal(activeWorld()?.id, second.id);
  openWorld(first.id);
  assert.equal(activeWorld()?.id, first.id);
  // Picking a world of another account (before the reload into it) leaves this account's alone.
  openWorld('elsewhere', 'other-account');
  assert.equal(activeWorld()?.id, first.id);
  assert.equal(usePreferences.getState().worldIds['other-account'], 'elsewhere');
  // A deleted open world falls back to the first one left.
  trashWorld(first.id);
  assert.equal(activeWorld()?.id, second.id);
});

test('saving a scene counts its words and mentions, and logs only the words gained today', () => {
  const { world, scene } = createWorld();
  const ines = createEntry(world.id, 'character', { name: 'Ines Varga' });
  updateSceneContent(scene.id, [para({ type: 'text', text: 'The tide went out. ' }, { type: 'mention', props: { entryId: ines.id, name: ines.name } })]);
  let saved = vault().scenes[scene.id]!;
  assert.equal(saved.words, 6);
  assert.deepEqual(saved.links, [ines.id]);
  assert.equal(vault().days[today()]!.words, 6);

  // Cutting words doesn't take them off today's count.
  updateSceneContent(scene.id, [para({ type: 'text', text: 'The tide.' })]);
  saved = vault().scenes[scene.id]!;
  assert.equal(saved.words, 2);
  assert.deepEqual(saved.links, []);
  assert.equal(vault().days[today()]!.words, 6);

  updateSceneContent(scene.id, [para({ type: 'text', text: 'The tide went out at last.' })]);
  assert.equal(vault().days[today()]!.words, 10);
});

test('shift swaps a scene with its neighbor; scenesInOrder reads part by part', () => {
  const { scene: first } = createWorld();
  const second = createScene(first.bookId, first.partId, { title: 'Second' });
  const act2 = createPart(first.bookId);
  const third = createScene(first.bookId, act2.id, { title: 'Third' });
  shift('scenes', second.id, -1);
  assert.deepEqual(scenesInOrder(first.bookId).map((s) => s.id), [second.id, first.id, third.id]);
  // Already first: nothing to swap with.
  shift('scenes', second.id, -1);
  assert.deepEqual(scenesInOrder(first.bookId).map((s) => s.id), [second.id, first.id, third.id]);
});

test('deleting a part deletes its scenes and says which, for Undo', () => {
  const { scene } = createWorld();
  const other = createScene(scene.bookId, scene.partId);
  const gone = trashPart(scene.partId);
  assert.deepEqual(new Set(gone), new Set([scene.id, other.id]));
  assert.equal(live(vault().scenes).length, 0);
});

test('the starter world seeds every collection, and Remove Starter Content takes all of it', () => {
  seedStarterContent();
  for (const collection of ['worlds', 'books', 'parts', 'scenes', 'entries', 'relationships', 'storylines', 'events', 'days'] as const) {
    assert.ok(live(vault()[collection]).length > 0, `seeded ${collection}`);
  }
  const draft = live(vault().scenes).find((s) => s.title === 'The Lamplighter’s Debt')!;
  assert.ok(draft.words > 80);
  assert.equal(draft.links.length, 4);

  const { world } = createWorld({ name: 'Mine' });
  removeSampleContent();
  assert.deepEqual(live(vault().worlds).map((w) => w.id), [world.id]);
  assert.equal(live(vault().entries).length, 0);
  assert.equal(live(vault().days).length, 0);
});

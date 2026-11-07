import '@/lib/test-env';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { addRelationship, createEntry, createEvent, createScene, createShootDay, createShot, createBudgetLine, createStoryline, createWorld, updateRecord, updateScene, updateWorld } from '@/lib/actions';
import { emptyVault, live, type Vault } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { createArc } from '@/writing/arcs/actions';
import { stamp } from '@/writing/common';
import { createWritingMap } from '@/writing/maps/actions';
import { createResearchNote } from '@/writing/research/actions';
import type { GearItem } from '@/film/gear/model';
import type { ReleaseForm } from '@/film/releases/model';
import { createSequelNow } from './actions';
import { createSequel, everything, nothing, sequel, sequelContents, sequelName } from './sequel';

const vault = () => useVault.getState().vault;
const inWorld = <C extends keyof Vault>(collection: C, worldId: string) => live(vault()[collection] as Record<string, { worldId?: string; deletedAt?: string | null; id: string; createdAt: string; updatedAt: string }>).filter((r) => r.worldId === worldId) as never[];

beforeEach(() => useVault.setState({ vault: emptyVault() }));

/** A small world: two related characters, a place, a storyline, an arc, a research note, a map with a pin on the place, and a scene that mentions Mara. */
function world() {
  const { world, scene } = createWorld({ name: 'The Glass Archipelago', section: 'writing', genre: 'Fantasy' });
  updateWorld(world.id, { calendar: { months: [{ name: 'Tide', days: 30 }] } as never });
  const mara = createEntry(world.id, 'character', { name: 'Mara' });
  const tomas = createEntry(world.id, 'character', { name: 'Tomas' });
  const harbor = createEntry(world.id, 'place', { name: 'The Harbor' });
  addRelationship(world.id, mara.id, tomas.id, 'Sister');
  const line = createStoryline(world.id, { name: 'Mara’s Journey' });
  createEvent(world.id, line.id, { title: 'She leaves', links: [mara.id] });
  const book = vault().books[scene.bookId]!;
  const arc = createArc({ worldId: world.id, bookId: book.id, name: 'The Lantern', entryId: mara.id, beats: { [scene.id]: 'It goes out' } });
  createResearchNote(world.id, { title: 'Glassblowing', links: [harbor.id] });
  const map = createWritingMap({ worldId: world.id, name: 'The Islands', image: 'islands.png', width: 100, height: 100 });
  updateRecord('writingMaps', map.id, { pins: [{ id: 'p1', x: 0.5, y: 0.5, label: 'Harbor', note: '', color: 'accent', entryId: harbor.id, mapId: null }] });
  updateScene(scene.id, {
    title: 'The Lighthouse',
    povId: mara.id,
    placeId: harbor.id,
    links: [mara.id],
    content: [{ type: 'paragraph', content: [{ type: 'mention', props: { entryId: mara.id, name: 'Mara' } }, { type: 'text', text: ' climbs.' }] }],
  });
  return { world, scene, book, mara, tomas, harbor, line, arc, map };
}

test('sequelName counts on: II, then III', () => {
  assert.equal(sequelName('The Glass Archipelago', 'Untitled World'), 'The Glass Archipelago II');
  assert.equal(sequelName('The Glass Archipelago II', 'Untitled World'), 'The Glass Archipelago III');
  assert.equal(sequelName('  ', 'Untitled World'), 'Untitled World II');
});

test('writing, the sequel preset: the world without the manuscript or arcs', () => {
  const w = world();
  const contents = sequelContents(vault(), w.world.id);
  assert.equal(contents.kind, 'writing');
  const plan = sequel(contents, 'Book Two World');
  assert.deepEqual(plan.pick.manuscript, []);
  assert.deepEqual(plan.pick.arcs, []);
  assert.equal(plan.pick.characters!.length, 2);
  const { vault: out, world: made, copied } = createSequel(vault(), w.world.id, plan);
  assert.equal(made.name, 'Book Two World');
  assert.equal(made.section, 'writing');
  assert.equal(made.genre, 'Fantasy');
  assert.ok(made.calendar, 'the calendar comes along');
  const mine = <T>(c: keyof Vault) => live(out[c] as Record<string, { worldId?: string; deletedAt?: string | null }>).filter((r) => r.worldId === made.id) as T[];
  assert.equal(mine('books').length, 0, 'no book: the action starts one');
  assert.equal(mine('entries').length, 3);
  assert.equal(mine('relationships').length, 1);
  assert.equal(mine('events').length, 1);
  assert.equal(mine('research').length, 1);
  const [map] = mine<{ pins: { entryId: string | null }[] }>('writingMaps');
  const harbor = mine<{ id: string; name: string }>('entries').find((e) => e.name === 'The Harbor')!;
  assert.equal(map!.pins[0]!.entryId, harbor.id, 'the pin points at the copied place');
  assert.equal(copied, 3 + 1 + 1 + 1);
  // The original is untouched.
  assert.equal(inWorld('entries', w.world.id).length, 3);
});

test('writing, everything: the manuscript with its links and mentions pointed at the copies, the arc with its beat', () => {
  const w = world();
  const contents = sequelContents(vault(), w.world.id);
  const { vault: out, world: made } = createSequel(vault(), w.world.id, everything(contents, 'Again'));
  const scenes = live(out.scenes).filter((s) => live(out.books).some((b) => b.id === s.bookId && b.worldId === made.id));
  assert.equal(scenes.length, 1);
  const mara = live(out.entries).find((e) => e.worldId === made.id && e.name === 'Mara')!;
  assert.equal(scenes[0]!.povId, mara.id);
  assert.deepEqual(scenes[0]!.links, [mara.id]);
  assert.match(JSON.stringify(scenes[0]!.content), new RegExp(mara.id));
  const arc = live(out.arcs).find((a) => a.worldId === made.id)!;
  assert.equal(arc.entryId, mara.id);
  assert.deepEqual(Object.keys(arc.beats), [scenes[0]!.id]);
  assert.equal(arc.bookId, scenes[0]!.bookId);
});

test('writing: a mention of a character left behind becomes plain text', () => {
  const w = world();
  const contents = sequelContents(vault(), w.world.id);
  const plan = everything(contents, 'Without Mara');
  plan.pick.characters = [w.tomas.id];
  const { vault: out, world: made } = createSequel(vault(), w.world.id, plan);
  const scene = live(out.scenes).find((s) => live(out.books).some((b) => b.id === s.bookId && b.worldId === made.id))!;
  assert.equal(scene.povId, null);
  assert.doesNotMatch(JSON.stringify(scene.content), /mention/);
  assert.match(JSON.stringify(scene.content), /"Mara"/);
});

test('the action: a new book (Book Two) when no scene is carried over, and the arc follows it', () => {
  const w = world();
  const contents = sequelContents(vault(), w.world.id);
  const plan = sequel(contents, 'Sequel');
  plan.pick.arcs = [w.arc.id];
  const { world: made } = createSequelNow(w.world.id, plan);
  const books = live(vault().books).filter((b) => b.worldId === made.id);
  assert.deepEqual(
    books.map((b) => b.title),
    ['Book Two'],
  );
  const arc = live(vault().arcs).find((a) => a.worldId === made.id)!;
  assert.equal(arc.bookId, books[0]!.id);
  assert.deepEqual(arc.beats, {}, 'its beat was in a scene left behind');
});

test('nothing: an empty world with the name and genre', () => {
  const w = world();
  const contents = sequelContents(vault(), w.world.id);
  const { vault: out, world: made, copied } = createSequel(vault(), w.world.id, nothing(contents, 'Empty'));
  assert.equal(copied, 0);
  assert.equal(made.genre, 'Fantasy');
  assert.equal(made.calendar, undefined);
  assert.equal(live(out.entries).filter((e) => e.worldId === made.id).length, 0);
});

/** A small production: cast and a location, a script scene with a shot, gear, a budget line, a release, a shoot day. */
function production() {
  const { world, scene } = createWorld({ name: 'How Glass Is Made', section: 'film' });
  updateWorld(world.id, { film: { ...world.film!, stage: 'post', releaseDate: '2026-12-01', checklist: [{ label: 'Captions', done: true }] } });
  const rosa = createEntry(world.id, 'character', { name: 'Rosa' });
  const crew = createEntry(world.id, 'crew', { name: 'Ana' });
  const studio = createEntry(world.id, 'place', { name: 'The Studio' });
  updateScene(scene.id, { title: 'The Furnace', placeId: studio.id });
  const scene2 = createScene(scene.bookId, scene.partId, { title: 'Cooling' });
  createShot(world.id, scene.id, { description: 'The door' });
  useVault.getState().put('gear', { ...stamp(), worldId: world.id, name: 'Camera', category: 'Camera', qty: 1, source: 'owned', from: '', dayRate: 0, days: 0, notes: '', packed: true, order: 0 } satisfies GearItem);
  createBudgetLine(world.id, 'cost', { item: 'Glass', estimate: 100, actual: 80 });
  useVault.getState().put('releases', { ...stamp(), worldId: world.id, entryId: rosa.id, name: 'Rosa', kind: 'talent', status: 'signed', signedOn: '2026-10-01', notes: '' } satisfies ReleaseForm);
  createShootDay(world.id, { date: '2026-11-20', sceneIds: [scene.id, scene2.id], placeId: studio.id, done: true, sheet: { cast: { [rosa.id]: { call: '07:00' } }, crew: { [crew.id]: { call: '06:00' } } } });
  return { world, scene, scene2, rosa, crew, studio };
}

test('filmmaking, the sequel preset: cast, crew, locations, gear unpacked and the budget as estimates; the production starts over', () => {
  const p = production();
  const contents = sequelContents(vault(), p.world.id);
  assert.equal(contents.kind, 'film');
  assert.deepEqual(contents.items.script!.map((s) => s.detail), ['1 shot', undefined]);
  const { vault: out, world: made } = createSequel(vault(), p.world.id, sequel(contents, 'Glass II'));
  const mine = <T>(c: keyof Vault) => live(out[c] as Record<string, { worldId?: string; deletedAt?: string | null }>).filter((r) => r.worldId === made.id) as T[];
  assert.equal(made.film!.stage, 'idea');
  assert.equal(made.film!.releaseDate, '');
  assert.equal(made.film!.checklist[0]!.done, false);
  assert.equal(mine('entries').length, 3);
  assert.equal(mine('books').length, 0);
  assert.equal(mine('shots').length, 0);
  assert.equal(mine<GearItem>('gear')[0]!.packed, false);
  assert.equal(mine<{ actual: number; estimate: number }>('budget')[0]!.actual, 0);
  assert.equal(mine('releases').length, 0);
  assert.equal(mine('shootDays').length, 0);
});

test('filmmaking, everything: the script with its shots, the day with its scenes and call sheet, the release on the copied cast', () => {
  const p = production();
  const contents = sequelContents(vault(), p.world.id);
  const plan = everything(contents, 'Again');
  plan.resetReleases = true;
  plan.pick.crew = [];
  const { vault: out, world: made } = createSequel(vault(), p.world.id, plan);
  const mine = <T>(c: keyof Vault) => live(out[c] as Record<string, { worldId?: string; deletedAt?: string | null }>).filter((r) => r.worldId === made.id) as T[];
  const scenes = live(out.scenes).filter((s) => live(out.books).some((b) => b.id === s.bookId && b.worldId === made.id));
  assert.equal(scenes.length, 2);
  const [shot] = mine<{ sceneId: string }>('shots');
  assert.equal(shot!.sceneId, scenes.find((s) => s.title === 'The Furnace')!.id);
  const rosa = mine<{ id: string; name: string }>('entries').find((e) => e.name === 'Rosa')!;
  const [day] = mine<{ sceneIds: string[]; done: boolean; sheet: { cast: Record<string, unknown>; crew: Record<string, unknown> } }>('shootDays');
  assert.deepEqual([...day!.sceneIds].sort(), scenes.map((s) => s.id).sort());
  assert.deepEqual(Object.keys(day!.sheet.cast), [rosa.id]);
  assert.deepEqual(day!.sheet.crew, {}, 'the crew stayed behind');
  assert.equal(day!.done, true);
  const [release] = mine<ReleaseForm>('releases');
  assert.deepEqual([release!.entryId, release!.status, release!.signedOn], [rosa.id, 'needed', '']);
  assert.equal(made.film!.stage, 'post', 'everything: as it is');
});

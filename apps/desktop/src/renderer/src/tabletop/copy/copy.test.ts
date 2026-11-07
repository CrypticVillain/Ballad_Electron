import '@/lib/test-env';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createEncounter, createEntry, createEvent, createMap, createMonster, createNote, createPc, addRelationship, createStoryline, createWorld, updateRecord, updateWorld } from '@/lib/actions';
import { emptyVault, live, type Vault } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { campaignContents, copyCampaign, everything, newTable, remapContent } from './copy';
import { createPlayScene, updateSceneMap } from '@/play/scenes/actions';
import { addToken, changeHp, toggleCondition } from '@/tabletop/battlemap/tokens/actions';

const vault = () => useVault.getState().vault;

beforeEach(() => useVault.setState({ vault: emptyVault() }));

/** A small campaign: two NPCs (related), a place, a creature, a party member, an encounter, a map, a storyline, a session and a note. */
function campaign() {
  const { world, scene } = createWorld({ name: 'Lantern', section: 'tabletop', genre: 'Low Fantasy' });
  updateWorld(world.id, { tabletop: { ruleset: '5e', nextSession: '2026-11-12', schedule: [{ id: 's1', date: '2026-11-12' }] } });
  const mara = createEntry(world.id, 'character', { name: 'Mara' });
  const tomas = createEntry(world.id, 'character', { name: 'Tomas' });
  const furnace = createEntry(world.id, 'place', { name: 'The Furnace' });
  addRelationship(world.id, mara.id, tomas.id, 'Sister');
  const ghoul = createMonster(world.id, { name: 'Ghoul', cr: '1' });
  const pc = createPc(world.id, { name: 'Ines', mine: true, conditions: ['Poisoned'] });
  updateRecord('pcs', pc.id, { hp: { max: 20, current: 4, temp: 0 } });
  const fight = createEncounter(world.id, {
    name: 'Ambush',
    round: 3,
    turn: 1,
    combatants: [
      { id: 'c1', kind: 'pc', refId: pc.id, name: 'Ines', initiative: 12, ac: 15, hp: 4, maxHp: 20, conditions: [] },
      { id: 'c2', kind: 'monster', refId: ghoul.id, name: 'Ghoul', initiative: 9, ac: 12, hp: 2, maxHp: 22, conditions: ['Prone'] },
    ],
  });
  const map = createMap({ worldId: world.id, characterId: null, name: 'Causeway', image: 'map.png', width: 10, height: 10 });
  updateRecord('maps', map.id, { pins: [{ id: 'p1', x: 0, y: 0, label: 'Gate', note: '', tone: 'place' }, { id: 'p2', x: 1, y: 1, label: 'Trap', note: '', tone: 'danger', gmOnly: true }] });
  const lane = createStoryline(world.id, { name: 'The Fall' });
  createEvent(world.id, lane.id, { title: 'The gate falls', links: [mara.id, furnace.id] });
  updateRecord('scenes', scene.id, {
    title: 'Into the Furnace',
    status: 'done',
    when: '2026-10-26',
    povId: mara.id,
    placeId: furnace.id,
    links: [mara.id, tomas.id, furnace.id],
    encounterIds: [fight.id],
    checklist: [{ id: 'k1', text: 'The key is in the stove', done: true }],
    content: [
      { type: 'paragraph', content: [{ type: 'mention', props: { entryId: mara.id, name: 'Mara', kind: 'character' } }, { type: 'text', text: ' meets ', styles: {} }, { type: 'mention', props: { entryId: tomas.id, name: 'Tomas', kind: 'character' } }], children: [] },
      { type: 'checkListItem', props: { checked: true }, content: [{ type: 'text', text: 'Found the key', styles: {} }], children: [] },
    ],
  });
  const note = createNote(scene.bookId, { title: 'Who has the key', category: 'clue' });
  return { world, scene, mara, tomas, furnace, ghoul, pc, fight, map, lane, note };
}

const ofWorld = <T extends { worldId?: string | null }>(records: Record<string, T & { deletedAt?: string | null }>, worldId: string) => live(records).filter((r) => r.worldId === worldId);

test('lists what a campaign has, section by section', () => {
  const c = campaign();
  const contents = campaignContents(vault(), c.world.id);
  assert.deepEqual(contents.sessions.map((s) => s.name), ['Into the Furnace']);
  assert.deepEqual(contents.notes.map((s) => s.name), ['Who has the key']);
  assert.deepEqual(contents.npcs.map((e) => e.name), ['Mara', 'Tomas']);
  assert.deepEqual(contents.places.map((e) => e.name), ['The Furnace']);
  assert.equal(contents.bestiary.length, 1);
  assert.equal(contents.party.length, 1);
  assert.equal(contents.maps[0]!.detail, '2 pins');
  assert.equal(contents.timeline[0]!.detail, '1 event');
});

test('copying everything makes a whole new campaign, linked to its own copies', () => {
  const c = campaign();
  const before = JSON.stringify(vault());
  const { vault: next, world, copied } = copyCampaign(vault(), c.world.id, everything(campaignContents(vault(), c.world.id), 'Lantern II'));
  assert.equal(JSON.stringify(vault()), before, 'the source vault is left as it was');
  assert.equal(world.name, 'Lantern II');
  assert.equal(world.genre, 'Low Fantasy');
  assert.equal(world.tabletop?.schedule?.length, 1);
  assert.notEqual(world.tabletop?.schedule?.[0]?.id, 's1');
  assert.equal(copied, 10);

  const entries = ofWorld(next.entries, world.id);
  const mara = entries.find((e) => e.name === 'Mara')!;
  const tomas = entries.find((e) => e.name === 'Tomas')!;
  const furnace = entries.find((e) => e.name === 'The Furnace')!;
  assert.notEqual(mara.id, c.mara.id);
  const rel = ofWorld(next.relationships, world.id);
  assert.equal(rel.length, 1);
  assert.deepEqual([rel[0]!.fromId, rel[0]!.toId], [mara.id, tomas.id]);

  const books = ofWorld(next.books, world.id);
  assert.equal(books.length, 1);
  const scenes = live(next.scenes).filter((s) => s.bookId === books[0]!.id);
  const session = scenes.find((s) => s.kind !== 'note')!;
  assert.equal(scenes.length, 2);
  assert.equal(session.povId, mara.id);
  assert.deepEqual([session.status, session.when], ['done', '2026-10-26']);
  assert.equal(session.placeId, furnace.id);
  assert.deepEqual(session.links, [mara.id, tomas.id, furnace.id]);
  const encounter = ofWorld(next.encounters, world.id)[0]!;
  assert.deepEqual(session.encounterIds, [encounter.id]);
  assert.equal(live(next.parts).find((p) => p.id === session.partId)?.bookId, books[0]!.id);
  const mention = (session.content[0] as { content: { props?: { entryId: string } }[] }).content[0]!;
  assert.equal(mention.props?.entryId, mara.id);

  const pc = ofWorld(next.pcs, world.id)[0]!;
  const monster = ofWorld(next.monsters, world.id)[0]!;
  assert.equal(pc.mine, undefined, 'the copy is the GM’s, not your own character');
  assert.deepEqual(encounter.combatants.map((x) => x.refId), [pc.id, monster.id]);
  assert.equal(encounter.round, 3);

  const event = ofWorld(next.events, world.id)[0]!;
  assert.equal(event.storylineId, ofWorld(next.storylines, world.id)[0]!.id);
  assert.deepEqual(event.links, [mara.id, furnace.id]);
  assert.equal(ofWorld(next.maps, world.id)[0]!.pins.length, 2);
});

test('only what is picked comes over; links to what was left out are dropped', () => {
  const c = campaign();
  const plan = everything(campaignContents(vault(), c.world.id), '');
  plan.pick.npcs = [c.mara.id];
  plan.pick.places = [];
  plan.pick.bestiary = [];
  plan.pick.party = [];
  plan.pick.notes = [];
  plan.pick.timeline = [];
  const { vault: next, world } = copyCampaign(vault(), c.world.id, plan);
  assert.equal(world.name, 'Lantern (Copy)');
  assert.deepEqual(ofWorld(next.entries, world.id).map((e) => e.name), ['Mara']);
  assert.equal(ofWorld(next.relationships, world.id).length, 0);
  assert.equal(ofWorld(next.storylines, world.id).length, 0);
  assert.equal(ofWorld(next.events, world.id).length, 0);

  const book = ofWorld(next.books, world.id)[0]!;
  const scenes = live(next.scenes).filter((s) => s.bookId === book.id);
  assert.equal(scenes.length, 1, 'the note was left out');
  const session = scenes[0]!;
  assert.equal(session.placeId, null);
  assert.equal(session.links.length, 1);
  // Tomas wasn't copied: his mention is his name, as text.
  const inline = (session.content[0] as { content: unknown[] }).content;
  assert.deepEqual(inline[2], { type: 'text', text: 'Tomas', styles: {} });

  // The ghoul and the party weren't copied: the ghoul stays in the fight by its stats, the party member leaves it.
  const encounter = ofWorld(next.encounters, world.id)[0]!;
  assert.equal(encounter.combatants.length, 1);
  assert.equal(encounter.combatants[0]!.kind, 'other');
  assert.equal(encounter.combatants[0]!.refId, null);
});

test('nothing picked in the sessions: no session log is copied', () => {
  const c = campaign();
  const plan = everything(campaignContents(vault(), c.world.id), 'Empty');
  plan.pick.sessions = [];
  plan.pick.notes = [];
  const { vault: next, world } = copyCampaign(vault(), c.world.id, plan);
  assert.equal(ofWorld(next.books, world.id).length, 0);
});

test('a new table: no party or calendar, checklists unticked, encounters and pins as asked', () => {
  const c = campaign();
  const plan = { ...newTable(campaignContents(vault(), c.world.id), 'Lantern, Again'), dropGmPins: true };
  const { vault: next, world } = copyCampaign(vault(), c.world.id, plan);
  assert.equal(ofWorld(next.pcs, world.id).length, 0);
  assert.deepEqual(world.tabletop?.schedule, []);
  assert.equal(world.tabletop?.nextSession, '');
  const session = live(next.scenes).find((s) => s.bookId === ofWorld(next.books, world.id)[0]!.id && s.kind !== 'note')!;
  assert.equal(session.checklist?.[0]?.done, false);
  assert.deepEqual([session.status, session.when], ['draft', ''], 'not played yet');
  assert.equal((session.content[1] as { props: { checked: boolean } }).props.checked, false);
  const encounter = ofWorld(next.encounters, world.id)[0]!;
  assert.equal(encounter.round, 0);
  assert.deepEqual(encounter.combatants.map((x) => [x.hp, x.initiative, x.conditions.length]), [[22, null, 0]]);
  assert.deepEqual(ofWorld(next.maps, world.id)[0]!.pins.map((p) => p.label), ['Gate']);
  // The source keeps its ticks.
  assert.equal(vault().scenes[c.scene.id]!.checklist?.[0]?.done, true);
});

test('a rested party: full hit points, no conditions', () => {
  const c = campaign();
  const plan = { ...everything(campaignContents(vault(), c.world.id), 'Rested'), restParty: true };
  const { vault: next, world } = copyCampaign(vault(), c.world.id, plan);
  const pc = ofWorld(next.pcs, world.id)[0]!;
  assert.equal(pc.hp.current, 20);
  assert.deepEqual(pc.conditions, []);
  assert.equal(vault().pcs[c.pc.id]!.hp.current, 4);
});

test('layouts point at the copies, or are left behind if not asked for', () => {
  const c = campaign();
  updateWorld(c.world.id, { layouts: { character: { spaces: [{ id: 'sp', name: 'Allies', folders: [{ id: 'f', name: 'Family', items: [c.mara.id, c.tomas.id] }], items: [] }] } } });
  const contents = campaignContents(vault(), c.world.id);
  const plan = everything(contents, 'A');
  plan.pick.npcs = [c.tomas.id];
  const { vault: next, world } = copyCampaign(vault(), c.world.id, plan);
  const tomas = ofWorld(next.entries, world.id).find((e) => e.name === 'Tomas')!;
  assert.deepEqual(world.layouts?.character?.spaces[0]?.folders[0]?.items, [tomas.id]);
  const without = copyCampaign(vault() as Vault, c.world.id, { ...plan, layouts: false });
  assert.equal(without.world.layouts, undefined);
});

test('remapContent walks nested blocks', () => {
  const ids = new Map([['a', 'b']]);
  const content = [{ type: 'bulletListItem', props: {}, content: [], children: [{ type: 'paragraph', content: [{ type: 'mention', props: { entryId: 'a', name: 'A' } }] }] }];
  const out = remapContent(content, ids, false) as typeof content;
  assert.deepEqual(out[0]!.children[0]!.content[0], { type: 'mention', props: { entryId: 'b', name: 'A' } });
});

test('Play’s scenes come along with their grid, and in their sidebar spaces', () => {
  const c = campaign();
  const crypt = createPlayScene(c.world.id, { name: 'The Crypt', image: 'crypt.png', width: 1400, height: 1000 });
  createPlayScene(c.world.id, { name: 'Blank Field' });
  updateSceneMap(crypt.id, { grid: { ...crypt.grid, size: 64, offsetX: 12, kind: 'hexRows' } });
  updateWorld(c.world.id, { layouts: { play: { spaces: [{ id: 'sp', name: 'Arc I', folders: [], items: [crypt.id] }] } } });
  const contents = campaignContents(vault(), c.world.id);
  assert.deepEqual(contents.play.map((s) => [s.name, s.detail]), [['The Crypt', undefined], ['Blank Field', 'Blank']]);
  const plan = everything(contents, 'Again');
  plan.pick.play = [crypt.id];
  const { vault: next, world } = copyCampaign(vault(), c.world.id, plan);
  const scenes = ofWorld(next.playScenes, world.id);
  assert.equal(scenes.length, 1);
  assert.notEqual(scenes[0]!.id, crypt.id);
  assert.equal(scenes[0]!.image, 'crypt.png');
  assert.deepEqual([scenes[0]!.grid.kind, scenes[0]!.grid.size, scenes[0]!.grid.offsetX], ['hexRows', 64, 12]);
  assert.deepEqual(world.layouts?.play?.spaces[0]?.items, [scenes[0]!.id]);
});

test('a scene’s tokens come with it: linked to the copies, unlinked or left off when theirs weren’t copied', () => {
  const c = campaign();
  const scene = createPlayScene(c.world.id, { name: 'Breakwater' });
  const quill = createEntry(c.world.id, 'character', { name: 'Quill', image: 'quill.png' });
  const hero = addToken(scene, { kind: 'pc', pc: vault().pcs[c.pc.id]! }, { x: 35, y: 35 }).token;
  const ghoul = addToken(scene, { kind: 'monster', monster: vault().monsters[c.ghoul.id]! }, { x: 105, y: 35 }).token;
  addToken(scene, { kind: 'npc', entry: quill }, { x: 175, y: 35 });
  const maxHp = vault().monsters[c.ghoul.id]!.hp;
  const ac = vault().monsters[c.ghoul.id]!.ac;
  changeHp(vault().tokens[ghoul.id]!, 1, 'damage');
  toggleCondition(vault().tokens[ghoul.id]!, 'Prone');
  const contents = campaignContents(vault(), c.world.id);

  // Everything: linked to the copies, as they were.
  const all = copyCampaign(vault(), c.world.id, everything(contents, 'All'));
  const tokens = ofWorld(all.vault.tokens, all.world.id);
  const copiedScene = ofWorld(all.vault.playScenes, all.world.id)[0]!;
  assert.equal(tokens.length, 3);
  assert.ok(tokens.every((t) => t.sceneId === copiedScene.id));
  const copiedGhoul = tokens.find((t) => t.kind === 'monster')!;
  assert.equal(copiedGhoul.refId, ofWorld(all.vault.monsters, all.world.id)[0]!.id);
  assert.deepEqual([copiedGhoul.hp!.current, copiedGhoul.conditions], [maxHp - 1, ['Prone']]);
  assert.equal(tokens.find((t) => t.kind === 'pc')!.refId, ofWorld(all.vault.pcs, all.world.id)[0]!.id);

  // A new table without the bestiary or NPCs: no party token; the ghoul and Quill stay as plain tokens, fresh.
  const plan = newTable(contents, 'Again');
  plan.pick.bestiary = [];
  plan.pick.npcs = plan.pick.npcs.filter((id) => id !== quill.id);
  const fresh = copyCampaign(vault(), c.world.id, plan);
  const left = ofWorld(fresh.vault.tokens, fresh.world.id);
  assert.equal(left.length, 2);
  assert.ok(!left.some((t) => t.name === hero.name));
  const plainGhoul = left.find((t) => t.name === 'Ghoul')!;
  assert.deepEqual([plainGhoul.kind, plainGhoul.refId, plainGhoul.ac, plainGhoul.hp!.current, plainGhoul.conditions], ['other', null, ac, maxHp, []]);
  assert.equal(left.find((t) => t.name === 'Quill')!.image, 'quill.png');
});

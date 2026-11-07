import '@/lib/test-env';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createEncounter, createMonster, createPc, createWorld, updateRecord } from '@/lib/actions';
import { emptyVault, live } from '@/lib/model';
import { setRemote, useVault, type Change } from '@/stores/vault';
import { addFogOp, rectPoints } from '@/tabletop/battlemap/geometry/fog';
import { blankMap } from '@/tabletop/battlemap/model';
import { addToken, placeCombatants } from '@/tabletop/battlemap/tokens/actions';
import { canMove, resolveToken } from '@/tabletop/battlemap/tokens/resolve';
import { attachTrack, autoTrack, createTrack, detachTrack, setTrackStart } from '@/tabletop/music/actions';
import { noMusic } from '@/tabletop/music/model';
import { setMembers, setSheetOwner, testEmail } from '@/tabletop/members/actions';
import { clearMark, clearMarksOn, markOf, saveMarks } from '@/tabletop/battlemap/marks/actions';
import { createPlayScene, createSceneFromEncounter, deletePlayScene, playTrack, showScene, startScene, stopScene } from './actions';
import { addNoteHandout, deleteHandout, setObjectHidden } from './handouts';

const vault = () => useVault.getState().vault;
beforeEach(() => {
  setRemote(null);
  useVault.setState({ vault: emptyVault() });
});

function campaign() {
  const { world } = createWorld({ name: 'Lantern', section: 'tabletop' });
  const ghoul = createMonster(world.id, { name: 'Brine Ghoul', hp: 22, ac: 12, kind: 'Medium undead' });
  const pc = createPc(world.id, { name: 'Ines' });
  const theme = createTrack({ name: 'Battle Theme', file: 'a.mp3', duration: 120 });
  const rain = createTrack({ name: 'Rain', file: 'b.mp3', duration: 90 });
  const fight = createEncounter(world.id, {
    name: 'Ambush',
    combatants: [
      { id: 'c1', kind: 'monster', refId: ghoul.id, name: 'Brine Ghoul', initiative: null, ac: 12, hp: 15, maxHp: 22, conditions: ['Prone'] },
      { id: 'c2', kind: 'pc', refId: pc.id, name: 'Ines', initiative: null, ac: 14, hp: 20, maxHp: 20, conditions: [] },
    ],
  });
  return { world: vault().worlds[world.id]!, ghoul, pc, theme, rain, fight };
}

test('an encounter’s prepared map, placed combatants, fog and music make a scene', () => {
  const { world, fight, theme, rain } = campaign();
  const map = { ...blankMap(), image: 'crypt.png', width: 1400, height: 700 };
  map.fog = addFogOp({ ...map.fog!, enabled: true }, { mode: 'reveal', shape: 'rect', points: rectPoints({ x: 0, y: 0 }, { x: 140, y: 140 }) });
  updateRecord('encounters', fight.id, { map, music: { tracks: [{ trackId: theme.id, start: 'auto' }, { trackId: rain.id, start: 'manual' }], loop: true } });
  const board = { id: fight.id, worldId: world.id, grid: map.grid };
  const placed = placeCombatants(board, vault().encounters[fight.id]!, { x: 300, y: 300 });
  assert.equal(placed.length, 2);
  assert.deepEqual(placed.map((t) => t.combatantId), ['c1', 'c2'], 'tokens on an encounter’s own map know their combatant');
  assert.deepEqual([placed[0]!.hp, placed[0]!.conditions], [{ current: 15, max: 22, temp: 0 }, ['Prone']], 'as hurt as they are in the fight');
  // Only the missing ones: none left.
  assert.equal(placeCombatants(board, vault().encounters[fight.id]!, { x: 300, y: 300 }, (c) => !placed.some((t) => t.combatantId === c.id)).length, 0);

  const scene = createSceneFromEncounter(vault().encounters[fight.id]!);
  assert.deepEqual([scene.name, scene.image, scene.width, scene.encounterId], ['Ambush', 'crypt.png', 1400, fight.id]);
  assert.equal(scene.fog?.enabled, true);
  assert.deepEqual(scene.music?.tracks.map((t) => t.start), ['auto', 'manual']);
  const tokens = live(vault().tokens).filter((t) => t.sceneId === scene.id);
  assert.equal(tokens.length, 2);
  assert.ok(tokens.every((t) => !t.combatantId), 'a scene’s tokens are its own');
  assert.equal(live(vault().tokens).filter((t) => t.sceneId === fight.id).length, 2, 'the encounter keeps its own');
});

test('Start: everyone sees the scene and its music begins; Stop and a hand-played track', () => {
  const { world, theme, rain } = campaign();
  const scene = createPlayScene(world.id, { name: 'Tavern', music: { tracks: [{ trackId: rain.id, start: 'manual' }, { trackId: theme.id, start: 'auto' }], loop: true } });
  const other = createPlayScene(world.id, { name: 'Road' });
  startScene(vault().worlds[world.id]!, vault().playScenes[scene.id]!);
  assert.equal(vault().worlds[world.id]!.tabletop?.live?.sceneId, scene.id);
  assert.equal(vault().playScenes[scene.id]!.nowPlaying?.trackId, theme.id, 'the one set to start with the scene');
  playTrack(scene.id, rain.id);
  assert.equal(vault().playScenes[scene.id]!.nowPlaying?.trackId, rain.id);
  // Starting another stops the first one's music.
  startScene(vault().worlds[world.id]!, vault().playScenes[other.id]!);
  assert.equal(vault().playScenes[scene.id]!.nowPlaying, null);
  assert.equal(vault().worlds[world.id]!.tabletop?.live?.sceneId, other.id);
  stopScene(vault().worlds[world.id]!);
  assert.equal(vault().worlds[world.id]!.tabletop?.live, null);
  // Deleting the started scene stops it.
  startScene(vault().worlds[world.id]!, vault().playScenes[scene.id]!);
  deletePlayScene(scene.id);
  assert.equal(vault().worlds[world.id]!.tabletop?.live, null);
});

test('Show Scene: the table sees it, its music waits; Start starts it; another shown scene stops the first one’s music', () => {
  const { world, theme } = campaign();
  const scene = createPlayScene(world.id, { name: 'Tavern', music: { tracks: [{ trackId: theme.id, start: 'auto' }], loop: true } });
  const other = createPlayScene(world.id, { name: 'Road' });
  showScene(vault().worlds[world.id]!, vault().playScenes[scene.id]!);
  assert.deepEqual([vault().worlds[world.id]!.tabletop?.live?.sceneId, vault().worlds[world.id]!.tabletop?.live?.shownOnly], [scene.id, true]);
  assert.equal(vault().playScenes[scene.id]!.nowPlaying ?? null, null, 'no music yet');
  startScene(vault().worlds[world.id]!, vault().playScenes[scene.id]!);
  assert.equal(vault().worlds[world.id]!.tabletop?.live?.shownOnly, undefined);
  assert.equal(vault().playScenes[scene.id]!.nowPlaying?.trackId, theme.id);
  showScene(vault().worlds[world.id]!, vault().playScenes[other.id]!);
  assert.equal(vault().playScenes[scene.id]!.nowPlaying, null);
  assert.equal(vault().worlds[world.id]!.tabletop?.live?.sceneId, other.id);
});

test('marks: one record per person per thing, saved, hidden, cleared (one person’s, or everyone’s)', () => {
  const { world } = campaign();
  const scene = createPlayScene(world.id, { name: 'Tavern' });
  const target = { worldId: world.id, sceneId: scene.id, onId: scene.id };
  const stroke = (id: string) => ({ id, tool: 'pen' as const, color: 'ink' as const, size: 3, points: [0, 0, 5, 10, 10, 5] });
  saveMarks(target, 'gm', [stroke('a')]);
  saveMarks(target, 'gm', [stroke('a'), stroke('b')]);
  saveMarks(target, 'sam', [stroke('c')]);
  assert.equal(live(vault().marks).length, 2);
  assert.equal(markOf(scene.id, 'gm')!.strokes.length, 2);
  setObjectHidden({ kind: 'mark', id: markOf(scene.id, 'sam')!.id }, true);
  assert.equal(markOf(scene.id, 'sam')!.hidden, true);
  const undo = clearMark(markOf(scene.id, 'sam')!.id);
  assert.equal(markOf(scene.id, 'sam'), undefined);
  assert.ok(markOf(scene.id, 'gm'), 'one person’s cleared, not anyone else’s');
  undo();
  assert.ok(markOf(scene.id, 'sam'));
  // Saving none takes the record away.
  saveMarks(target, 'sam', []);
  assert.equal(markOf(scene.id, 'sam'), undefined);
  clearMarksOn(scene.id);
  assert.equal(live(vault().marks).length, 0);
});

test('handouts: hidden until shown; deleting one takes its marks', () => {
  const { world } = campaign();
  const scene = createPlayScene(world.id, { name: 'Tavern' });
  const note = addNoteHandout(vault().playScenes[scene.id]!);
  assert.equal(note.hidden, true);
  setObjectHidden({ kind: 'handout', id: note.id }, false);
  assert.equal(vault().handouts[note.id]!.hidden, false);
  saveMarks({ worldId: world.id, sceneId: scene.id, onId: note.id }, 'gm', [{ id: 's', tool: 'pen', color: 'red', size: 3, points: [0, 0, 5] }]);
  deleteHandout(vault().handouts[note.id]!);
  assert.equal(live(vault().handouts).length, 0);
  assert.equal(live(vault().marks).length, 0);
});

test('attaching music: once each, how it starts, the one that starts with the scene', () => {
  const { theme, rain } = campaign();
  let music = attachTrack(noMusic(), theme.id);
  music = attachTrack(music, theme.id);
  assert.equal(music.tracks.length, 1);
  assert.equal(autoTrack(music, vault().music), null);
  music = setTrackStart(attachTrack(music, rain.id), rain.id, 'auto');
  assert.equal(autoTrack(music, vault().music), rain.id);
  useVault.getState().remove('music', rain.id);
  assert.equal(autoTrack(music, vault().music), null, 'a deleted track is skipped');
  assert.deepEqual(detachTrack(music, theme.id).tracks.map((t) => t.trackId), [rain.id]);
});

test('who moves a token: the GM any; a player theirs, by their sheet or as the GM set it', () => {
  const { world, pc, ghoul } = campaign();
  setMembers(world, ['sam', 'priya', 'sam']);
  assert.deepEqual(vault().worlds[world.id]!.tabletop?.members, [{ accountId: 'sam' }, { accountId: 'priya' }]);
  setSheetOwner(pc.id, 'sam');
  const board = { id: 'map', worldId: world.id, grid: blankMap().grid };
  const hero = addToken(board, { kind: 'pc', pc: vault().pcs[pc.id]! }, { x: 35, y: 35 }).token;
  const beast = addToken(board, { kind: 'monster', monster: ghoul }, { x: 105, y: 35 }).token;
  const sources = () => ({ pcs: new Map(Object.entries(vault().pcs)), monsters: new Map(Object.entries(vault().monsters)), entries: new Map() });
  const sam = { gm: false, accountId: 'sam' };
  const gm = { gm: true, accountId: 'default' };
  assert.equal(canMove(sam, resolveToken(vault().tokens[hero.id]!, sources())), true, 'their sheet’s');
  assert.equal(canMove(sam, resolveToken(vault().tokens[beast.id]!, sources())), false);
  assert.equal(canMove(gm, resolveToken(vault().tokens[beast.id]!, sources())), true);
  // The GM gives the ghoul to Priya, and takes Ines from Sam.
  useVault.getState().patch('tokens', beast.id, { assignees: ['priya'] });
  useVault.getState().patch('tokens', hero.id, { assignees: [] });
  assert.equal(canMove({ gm: false, accountId: 'priya' }, resolveToken(vault().tokens[beast.id]!, sources())), true);
  assert.equal(canMove(sam, resolveToken(vault().tokens[hero.id]!, sources())), false);
  assert.equal(testEmail('Mary Jo O’Neil'), 'mary.jo.o.neil@players.ballad.test');
});

test('a Play window sends its changes to the owner (it saves nothing), and takes the other window’s in', () => {
  const { world } = campaign();
  const sent: Change[] = [];
  setRemote((changes) => sent.push(...changes));
  const scene = createPlayScene(world.id, { name: 'Sent' });
  assert.equal(sent.at(-1)?.collection, 'playScenes');
  assert.equal((sent.at(-1)?.record as { name: string }).name, 'Sent');
  useVault.getState().remove('playScenes', scene.id);
  assert.ok((sent.at(-1)?.record as { deletedAt: string }).deletedAt);
  // From the other window: taken in, not sent back.
  const before = sent.length;
  useVault.getState().applyRemote([{ collection: 'playScenes', id: 'from-afar', record: { ...vault().playScenes[scene.id]!, id: 'from-afar', name: 'From afar', deletedAt: null } }]);
  assert.equal(vault().playScenes['from-afar']?.name, 'From afar');
  assert.equal(sent.length, before);
  useVault.getState().applyRemote([{ collection: 'playScenes', id: 'from-afar', record: null }]);
  assert.equal(vault().playScenes['from-afar'], undefined);
});

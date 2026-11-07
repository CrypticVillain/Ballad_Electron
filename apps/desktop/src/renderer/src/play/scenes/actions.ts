import { tabletopDefaults } from '@/lib/sections';
import { live, now, type Encounter, type World } from '@/lib/model';
import { useVault } from '@/stores/vault';
import { blankMap, defaultFog, type BattleMap } from '@/tabletop/battlemap/model';
import { copyTokens } from '@/tabletop/battlemap/tokens/actions';
import { autoTrack } from '@/tabletop/music/actions';
import { noMusic } from '@/tabletop/music/model';
import { stamp } from '../common';
import type { PlayScene } from './model';

/**
 * Play → Scenes: making, changing and deleting scenes; making one from an
 * encounter (its map, placed tokens, fog and music come along); showing a
 * scene to the table (Show Scene: seen, not started), starting it (its music
 * that plays with the start begins) and playing a track by hand.
 */

const store = () => useVault.getState();

export function createPlayScene(worldId: string, input: Partial<PlayScene> = {}): PlayScene {
  const orders = live(store().vault.playScenes)
    .filter((s) => s.worldId === worldId)
    .map((s) => s.order);
  const scene: PlayScene = {
    ...stamp(),
    ...blankMap(),
    worldId,
    name: 'New Scene',
    order: orders.length ? Math.max(...orders) + 1 : 0,
    music: noMusic(),
    ...input,
  };
  store().put('playScenes', scene);
  return scene;
}

export const updatePlayScene = (id: string, changes: Partial<PlayScene>) => store().patch('playScenes', id, changes);

/** Changes some of a scene's map (its grid, fog, picture…). */
export function updateSceneMap(id: string, changes: Partial<BattleMap>) {
  updatePlayScene(id, changes);
}

/** Deletes a scene (soft); returns its undo. Its picture stays beside the vault; a started scene stops. */
export function deletePlayScene(id: string): () => void {
  const scene = store().vault.playScenes[id];
  const world = scene ? store().vault.worlds[scene.worldId] : undefined;
  const wasLive = world?.tabletop?.live?.sceneId === id;
  if (world && wasLive) setLive(world, null);
  store().remove('playScenes', id);
  return () => store().restore('playScenes', id);
}

/**
 * A scene from an encounter: its prepared map (or a blank one if it has
 * none), its tokens as placed, its fog and its music.
 */
export function createSceneFromEncounter(encounter: Encounter, input: Partial<PlayScene> = {}): PlayScene {
  const map = encounter.map ?? blankMap();
  const scene = createPlayScene(encounter.worldId, {
    ...map,
    fog: map.fog ?? defaultFog(),
    name: encounter.name || 'Encounter',
    encounterId: encounter.id,
    music: encounter.music ? { ...encounter.music, tracks: [...encounter.music.tracks] } : noMusic(),
    ...input,
  });
  copyTokens(encounter.id, { id: scene.id, worldId: scene.worldId, grid: scene.grid });
  return scene;
}

function setLive(world: World, live: { sceneId: string; startedAt: string; shownOnly?: boolean } | null) {
  store().patch('worlds', world.id, { tabletop: { ...tabletopDefaults(), ...world.tabletop, live } });
}

/** Starts a scene for the table: everyone sees it; its music set to play with the start begins. Another started scene stops. */
export function startScene(world: World, scene: PlayScene) {
  const before = world.tabletop?.live?.sceneId;
  if (before && before !== scene.id && store().vault.playScenes[before]) updatePlayScene(before, { nowPlaying: null });
  const at = now();
  setLive(world, { sceneId: scene.id, startedAt: at });
  const track = autoTrack(scene.music, store().vault.music);
  updatePlayScene(scene.id, { nowPlaying: track ? { trackId: track, startedAt: at } : null });
}

/** Shows a scene to the table without starting it: the players see it, its music waits for Start. Another scene the table saw stops. */
export function showScene(world: World, scene: PlayScene) {
  const before = world.tabletop?.live?.sceneId;
  if (before && store().vault.playScenes[before]) updatePlayScene(before, { nowPlaying: null });
  setLive(world, { sceneId: scene.id, startedAt: now(), shownOnly: true });
}

/** Stops the started scene: the table waits, and its music stops. */
export function stopScene(world: World) {
  const sceneId = world.tabletop?.live?.sceneId;
  if (sceneId && store().vault.playScenes[sceneId]) updatePlayScene(sceneId, { nowPlaying: null });
  setLive(world, null);
}

/** Plays a track for the table now (null: stops the music). */
export function playTrack(sceneId: string, trackId: string | null) {
  updatePlayScene(sceneId, { nowPlaying: trackId ? { trackId, startedAt: now() } : null });
}

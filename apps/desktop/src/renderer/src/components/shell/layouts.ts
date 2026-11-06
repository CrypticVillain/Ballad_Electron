import { useMemo } from 'react';
import { updateRecord, updateWorld } from '@/lib/actions';
import { useCharacter, useRole, useSection, useWorld, useWorldRecords } from '@/lib/hooks';
import { arrange, type Placeable } from '@/lib/layout';
import { byOrder, type Encounter, type Entry, type EntryKind, type GameMap, type Layout, type Monster, type SharedPlace, type Storyline } from '@/lib/model';
import { kindInfo, SECTION_INFO } from '@/lib/sections';
import { useReceived, useVisibleMaps, useVisibleMonsters, useWorldEntries } from '@/lib/shared';

/**
 * Whose arrangement each sidebar shows, and where a change to it is saved
 * (components/shell/Spaces arranges them; the Manage Spaces and Manage
 * Folders dialogs too):
 *
 *   - the GM (and every Writing and Film world): the world's own;
 *   - a player: their character's own, of what's shared with them and their
 *     own maps. It isn't tied to the GM's: things land in one space (NPCs,
 *     Places…) unless the GM shared the structure too, and then they start in
 *     the GM's space and folder, made here if need be. After that it's theirs.
 */
export type Arrangement = { layout: Layout; save: (next: Layout) => void; editable: boolean };

/** The open world's entries of a kind that you see (a player: what's shared with them). */
export function useVisibleEntries(kind: EntryKind): Entry[] {
  const entries = useWorldEntries();
  return useMemo(() => entries.filter((e) => e.kind === kind), [entries, kind]);
}

/** Where each shared thing starts out for a player: in the GM's space and folder, if those were shared. */
function useSharedPlaces(collection: 'entries' | 'maps' | 'monsters'): Map<string, SharedPlace> {
  const { shares } = useReceived(collection);
  return useMemo(() => new Map(shares.filter((s) => s.place).map((s) => [s.sourceId, s.place!])), [shares]);
}

/** How a kind's sidebar is arranged for you (its spaces and folders), with every entry you can see placed. */
export function useEntryLayout(kind: EntryKind): Arrangement & { entries: Entry[] } {
  const world = useWorld();
  const pc = useCharacter();
  const player = useRole() === 'player';
  const info = kindInfo(kind, useSection());
  const entries = useVisibleEntries(kind);
  const places = useSharedPlaces('entries');
  const saved = player ? pc?.layouts?.[kind] : world?.layouts?.[kind];
  const groups = world?.folders?.[kind] ?? info.groups;
  const plural = info.plural;
  const layout = useMemo(() => {
    const defaults = player ? [plural] : groups;
    const items = entries.map((e): Placeable => {
      const place = player ? places.get(e.id) : undefined;
      return place ? { id: e.id, name: e.name || 'Untitled', space: place.space, folder: place.folder, create: true } : { id: e.id, name: e.name || 'Untitled', space: player ? undefined : e.group };
    });
    const arranged = arrange(saved, items, defaults);
    // A player who hasn't arranged anything yet: their starting space is left out if it's empty and the GM's structure gave them others.
    if (player && !saved) {
      const used = arranged.spaces.filter((s) => s.items.length || s.folders.length);
      if (used.length) return { spaces: used };
    }
    return arranged;
  }, [saved, entries, groups, plural, player, places]);
  const save = (next: Layout) => {
    if (player) {
      if (pc) updateRecord('pcs', pc.id, { layouts: { ...pc.layouts, [kind]: next } });
    } else if (world) updateWorld(world.id, { layouts: { ...world.layouts, [kind]: next } });
  };
  return { layout, save, editable: player ? Boolean(pc) : Boolean(world), entries };
}

type MapArrangement = Arrangement & { maps: GameMap[] };

/**
 * The GM's campaign maps as they arrange them; a player's maps (their own,
 * and those shared with them) as the player does.
 */
export function useMapLayouts(): { maps: GameMap[]; campaign: MapArrangement; own?: MapArrangement } {
  const maps = useVisibleMaps();
  const world = useWorld();
  const pc = useCharacter();
  const gm = useRole() !== 'player';
  const places = useSharedPlaces('maps');
  const campaignMaps = useMemo(() => (gm ? maps.filter((m) => !m.characterId) : []), [maps, gm]);
  const campaignLayout = useMemo(() => arrange(world?.layouts?.maps, campaignMaps.map((m) => ({ id: m.id, name: m.name || 'Untitled Map', folder: m.folder })), ['Campaign Maps'], world?.folders?.maps), [world, campaignMaps]);
  const ownLayout = useMemo(() => {
    const items = maps.map((m): Placeable => {
      const place = places.get(m.id);
      if (m.via) return place ? { id: m.id, name: m.name || 'Untitled Map', space: place.space, folder: place.folder, create: true } : { id: m.id, name: m.name || 'Untitled Map', space: 'Shared Maps' };
      return { id: m.id, name: m.name || 'Untitled Map', space: 'Your Maps', folder: m.folder };
    });
    return arrange(pc?.layouts?.maps, items, ['Shared Maps', 'Your Maps'], pc?.mapFolders);
  }, [pc, maps, places]);
  return {
    maps,
    campaign: {
      layout: campaignLayout,
      maps: campaignMaps,
      editable: gm && Boolean(world),
      save: (next) => {
        if (world) updateWorld(world.id, { layouts: { ...world.layouts, maps: next } });
      },
    },
    own: gm || !pc ? undefined : { layout: ownLayout, maps, editable: true, save: (next) => updateRecord('pcs', pc.id, { layouts: { ...pc.layouts, maps: next } }) },
  };
}

type MonsterArrangement = Arrangement & { monsters: Monster[] };

/**
 * The Bestiary arranged like the maps: the GM's campaign creatures as they
 * arrange them; a player's (their own, and those shared with them) as the
 * player does.
 */
export function useMonsterLayouts(): { monsters: Monster[]; campaign: MonsterArrangement; own?: MonsterArrangement } {
  const monsters = useVisibleMonsters();
  const world = useWorld();
  const pc = useCharacter();
  const gm = useRole() !== 'player';
  const places = useSharedPlaces('monsters');
  const name = (m: Monster) => m.name || 'Unnamed Creature';
  const campaignMonsters = useMemo(() => (gm ? monsters : []), [monsters, gm]);
  const campaignLayout = useMemo(() => arrange(world?.layouts?.monsters, campaignMonsters.map((m) => ({ id: m.id, name: name(m) })), ['Creatures']), [world, campaignMonsters]);
  const ownLayout = useMemo(() => {
    const items = monsters.map((m): Placeable => {
      const place = places.get(m.id);
      if (m.via) return place ? { id: m.id, name: name(m), space: place.space, folder: place.folder, create: true } : { id: m.id, name: name(m), space: 'Shared Creatures' };
      return { id: m.id, name: name(m), space: 'Your Creatures' };
    });
    return arrange(pc?.layouts?.monsters, items, ['Shared Creatures', 'Your Creatures']);
  }, [pc, monsters, places]);
  return {
    monsters,
    campaign: {
      layout: campaignLayout,
      monsters: campaignMonsters,
      editable: gm && Boolean(world),
      save: (next) => {
        if (world) updateWorld(world.id, { layouts: { ...world.layouts, monsters: next } });
      },
    },
    own: gm || !pc ? undefined : { layout: ownLayout, monsters, editable: true, save: (next) => updateRecord('pcs', pc.id, { layouts: { ...pc.layouts, monsters: next } }) },
  };
}

/** The campaign's encounters as the GM arranges them (players have none). */
export function useEncounterLayout(): Arrangement & { encounters: Encounter[] } {
  const world = useWorld();
  const gm = useRole() !== 'player';
  const encounters = useWorldRecords('encounters');
  const layout = useMemo(() => arrange(world?.layouts?.encounters, encounters.map((e) => ({ id: e.id, name: e.name || 'Untitled Encounter' })), ['Encounters']), [world, encounters]);
  return {
    layout,
    encounters,
    editable: gm && Boolean(world),
    save: (next) => {
      if (world) updateWorld(world.id, { layouts: { ...world.layouts, encounters: next } });
    },
  };
}

/** The timeline's storylines (its lanes) as the world arranges them: the lanes follow this order. */
export function useStorylineLayout(): Arrangement & { storylines: Storyline[] } {
  const world = useWorld();
  const storylines = useWorldRecords('storylines');
  const sorted = useMemo(() => [...storylines].sort(byOrder), [storylines]);
  const layout = useMemo(() => arrange(world?.layouts?.storylines, sorted.map((s) => ({ id: s.id, name: s.name })), ['Lanes']), [world, sorted]);
  return {
    layout,
    storylines: sorted,
    editable: Boolean(world),
    save: (next) => {
      if (world) updateWorld(world.id, { layouts: { ...world.layouts, storylines: next } });
    },
  };
}

/** A list you can arrange here (a tab of Manage Spaces and Manage Folders): one of the section's bible kinds, maps and the Bestiary (Tabletop), or the timeline's storylines. */
export type Area = { key: string; label: string; noun: string; kind?: EntryKind };

export function useAreas(): Area[] {
  const section = useSection();
  const world = useWorld();
  const player = useRole() === 'player';
  const pc = useCharacter();
  return useMemo(() => {
    const kinds = world ? SECTION_INFO[section].kinds.map((kind): Area => ({ key: kind, kind, label: kindInfo(kind, section).plural, noun: kindInfo(kind, section).singular })) : [];
    const tabletop = section === 'tabletop' && (player ? pc : world);
    const maps: Area[] = tabletop ? [{ key: 'maps', label: 'Maps', noun: 'Map' }] : [];
    const bestiary: Area[] = tabletop ? [{ key: 'monsters', label: 'Bestiary', noun: 'Creature' }] : [];
    // Encounters are the GM's.
    const encounters: Area[] = section === 'tabletop' && world && !player ? [{ key: 'encounters', label: 'Encounters', noun: 'Encounter' }] : [];
    // Play's scenes (tabletop/play) are the GM's too.
    const play: Area[] = section === 'tabletop' && world && !player ? [{ key: 'play', label: 'Play', noun: 'Scene' }] : [];
    // The timeline is the GM's (and every Writing world's); Filmmaking has none.
    const timeline: Area[] = world && !player && section !== 'film' ? [{ key: 'storylines', label: 'Timeline', noun: 'Storyline' }] : [];
    // In the rail's order: Play, Encounters, Bestiary, NPCs, Places, Maps, Lore, Timeline.
    const at = kinds.findIndex((k) => k.kind === 'place');
    const middle = at < 0 ? [...kinds, ...maps] : [...kinds.slice(0, at + 1), ...maps, ...kinds.slice(at + 1)];
    return [...play, ...encounters, ...bestiary, ...middle, ...timeline];
  }, [section, world, player, pc]);
}

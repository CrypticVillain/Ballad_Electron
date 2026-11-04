import { useMemo } from 'react';
import { updateRecord, updateWorld } from '@/lib/actions';
import { useCharacter, useRole, useSection, useWorld } from '@/lib/hooks';
import { arrange, type Placeable } from '@/lib/layout';
import type { Entry, EntryKind, GameMap, Layout, SharedPlace } from '@/lib/model';
import { kindInfo, SECTION_INFO } from '@/lib/sections';
import { useReceived, useVisibleMaps, useWorldEntries } from '@/lib/shared';

/**
 * Whose arrangement each sidebar shows, and where a change to it is saved
 * (components/shell/Spaces arranges them; the Manage Spaces and Manage
 * Folders dialogs too):
 *
 *   - the DM (and every Writing and Film world): the world's own;
 *   - a player: their character's own, of what's shared with them and their
 *     own maps. It isn't tied to the DM's: things land in one space (NPCs,
 *     Places…) unless the DM shared the structure too, and then they start in
 *     the DM's space and folder, made here if need be. After that it's theirs.
 */
export type Arrangement = { layout: Layout; save: (next: Layout) => void; editable: boolean };

/** The open world's entries of a kind that you see (a player: what's shared with them). */
export function useVisibleEntries(kind: EntryKind): Entry[] {
  const entries = useWorldEntries();
  return useMemo(() => entries.filter((e) => e.kind === kind), [entries, kind]);
}

/** Where each shared thing starts out for a player: in the DM's space and folder, if those were shared. */
function useSharedPlaces(collection: 'entries' | 'maps'): Map<string, SharedPlace> {
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
    // A player who hasn't arranged anything yet: their starting space is left out if it's empty and the DM's structure gave them others.
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
 * The DM's campaign maps as they arrange them; a player's maps (their own,
 * and those shared with them) as the player does.
 */
export function useMapLayouts(): { maps: GameMap[]; campaign: MapArrangement; own?: MapArrangement } {
  const maps = useVisibleMaps();
  const world = useWorld();
  const pc = useCharacter();
  const dm = useRole() !== 'player';
  const places = useSharedPlaces('maps');
  const campaignMaps = useMemo(() => (dm ? maps.filter((m) => !m.characterId) : []), [maps, dm]);
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
      editable: dm && Boolean(world),
      save: (next) => {
        if (world) updateWorld(world.id, { layouts: { ...world.layouts, maps: next } });
      },
    },
    own: dm || !pc ? undefined : { layout: ownLayout, maps, editable: true, save: (next) => updateRecord('pcs', pc.id, { layouts: { ...pc.layouts, maps: next } }) },
  };
}

/** A list you can arrange here (a tab of Manage Spaces and Manage Folders): one of the section's bible kinds, or maps (D&D). */
export type Area = { key: string; label: string; noun: string; kind?: EntryKind };

export function useAreas(): Area[] {
  const section = useSection();
  const world = useWorld();
  const player = useRole() === 'player';
  const pc = useCharacter();
  return useMemo(() => {
    const kinds = world ? SECTION_INFO[section].kinds.map((kind): Area => ({ key: kind, kind, label: kindInfo(kind, section).plural, noun: kindInfo(kind, section).singular })) : [];
    const maps: Area[] = section === 'dnd' && (player ? pc : world) ? [{ key: 'maps', label: 'Maps', noun: 'Map' }] : [];
    // In the rail's order: NPCs, Places, Maps, Lore.
    const at = kinds.findIndex((k) => k.kind === 'place');
    return at < 0 ? [...kinds, ...maps] : [...kinds.slice(0, at + 1), ...maps, ...kinds.slice(at + 1)];
  }, [section, world, player, pc]);
}

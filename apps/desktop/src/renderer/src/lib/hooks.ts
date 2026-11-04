/**
 * hooks.ts — reading the vault from components.
 *
 * Select the record map (a stable reference until that collection changes),
 * then derive arrays with useMemo: selecting a fresh array straight from the
 * store would re-render forever.
 */
import { useMemo } from 'react';
import { seesBook } from '@/lib/dnd';
import { byOrder, live, type BaseRecord, type Book, type Collection, type DndRole, type GameMap, type PlayerCharacter, type RecordOf, type Section, type World, type WorldCollection } from '@/lib/model';
import { SECTION_INFO, type SectionInfo } from '@/lib/sections';
import { currentAccountId, usePreferences, worldKey } from '@/stores/preferences';
import { useVault } from '@/stores/vault';

/** Live records of a collection. */
export function useLive<C extends Collection>(collection: C): RecordOf<C>[] {
  const records = useVault((s) => s.vault[collection]) as unknown as Record<string, RecordOf<C> & BaseRecord>;
  return useMemo(() => live(records), [records]);
}

/** One record (undefined if missing or deleted). */
export function useRecord<C extends Collection>(collection: C, id: string | null | undefined): RecordOf<C> | undefined {
  return useVault((s) => {
    if (!id) return undefined;
    const record = s.vault[collection][id] as (RecordOf<C> & BaseRecord) | undefined;
    return record && !record.deletedAt ? record : undefined;
  });
}

/** The open section (Writing, Filmmaking or D&D: the world menu switches). */
export function useSection(): Section {
  return usePreferences((s) => s.sections[currentAccountId()] ?? 'writing');
}

/** The open section's words (what a world, a scene, a kind is called). */
export function useSectionInfo(): SectionInfo {
  return SECTION_INFO[useSection()];
}

/** The open section's worlds (productions, campaigns), in order. */
export function useSectionWorlds(): World[] {
  const worlds = useLive('worlds');
  const section = useSection();
  return useMemo(() => worlds.filter((w) => w.section === section).sort(byOrder), [worlds, section]);
}

/**
 * The open world: the one picked last in this account's open section (the
 * world menu, the Home sidebar), else the section's first. In D&D's Player
 * view, the campaign the character you're playing is in (none if they're in
 * none).
 */
export function useWorld(): World | undefined {
  const worlds = useSectionWorlds();
  const section = useSection();
  const id = usePreferences((s) => s.worldIds[worldKey(currentAccountId(), section)]);
  const player = useRole() === 'player';
  const campaign = useCharacter()?.worldId;
  return useMemo(() => (player ? worlds.find((w) => w.id === campaign) : (worlds.find((w) => w.id === id) ?? worlds[0])), [worlds, id, player, campaign]);
}

/** The open world's records of a collection that belongs to a world (entries, storylines, events…). */
export function useWorldRecords<C extends WorldCollection>(collection: C): RecordOf<C>[] {
  const world = useWorld();
  const records = useLive(collection);
  return useMemo(() => records.filter((r) => (r as { worldId: string }).worldId === world?.id), [records, world?.id]);
}

/** In D&D, whether you're the DM or a player: yours (per account, Ctrl+Shift+D), not a campaign's. Null in the other sections. */
export function useRole(): DndRole | null {
  const section = useSection();
  const role = usePreferences((s) => s.dndRoles[currentAccountId()] ?? 'dm');
  return section === 'dnd' ? role : null;
}

/** Your characters (Player view), in a campaign or not, by name; archived ones aren't among them. */
export function useMyCharacters(): PlayerCharacter[] {
  const pcs = useLive('pcs');
  return useMemo(() => pcs.filter((pc) => pc.mine && !pc.archivedAt).sort((a, b) => a.name.localeCompare(b.name)), [pcs]);
}

/** Your characters in the archive, the latest put away first. */
export function useArchivedCharacters(): PlayerCharacter[] {
  const pcs = useLive('pcs');
  return useMemo(() => pcs.filter((pc) => pc.mine && pc.archivedAt).sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')), [pcs]);
}

/** The character you're playing: the one picked last, else your first. */
export function useCharacter(): PlayerCharacter | undefined {
  const mine = useMyCharacters();
  const id = usePreferences((s) => s.characterIds[currentAccountId()]);
  return useMemo(() => mine.find((pc) => pc.id === id) ?? mine[0], [mine, id]);
}

/** The open world's books, in order. In D&D, the view's own: the DM's session logs, or the journal of the character you're playing. */
export function useBooks(): Book[] {
  const books = useWorldRecords('books');
  const all = useLive('books');
  const role = useRole();
  const character = useCharacter()?.id;
  return useMemo(
    () => (role === 'player' ? all.filter((b) => b.audience === 'player' && b.characterId === character) : books.filter((b) => !role || seesBook(b, role))).sort(byOrder),
    [all, books, role, character],
  );
}

/** The maps you see. DM: the campaign's. Player: your character's campaign's and their own. */
export function useMaps(): GameMap[] {
  const maps = useLive('maps');
  const world = useWorld()?.id;
  const role = useRole();
  const character = useCharacter()?.id;
  return useMemo(
    () => maps.filter((m) => (m.characterId ? role === 'player' && m.characterId === character : Boolean(world) && m.worldId === world)).sort(byOrder),
    [maps, world, role, character],
  );
}

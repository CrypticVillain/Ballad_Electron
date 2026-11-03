/**
 * hooks.ts — reading the vault from components.
 *
 * Select the record map (a stable reference until that collection changes),
 * then derive arrays with useMemo: selecting a fresh array straight from the
 * store would re-render forever.
 */
import { useMemo } from 'react';
import { byOrder, live, type BaseRecord, type Book, type Collection, type RecordOf, type World } from '@/lib/model';
import { usePreferences } from '@/stores/preferences';
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

/** The open world: the one picked last (Settings, the Home sidebar), else the first. */
export function useWorld(): World | undefined {
  const worlds = useLive('worlds');
  const id = usePreferences((s) => s.worldId);
  return useMemo(() => {
    const sorted = [...worlds].sort(byOrder);
    return sorted.find((w) => w.id === id) ?? sorted[0];
  }, [worlds, id]);
}

/** The open world's records of a collection that belongs to a world (entries, storylines, events…). */
export function useWorldRecords<C extends 'books' | 'entries' | 'relationships' | 'storylines' | 'events'>(collection: C): RecordOf<C>[] {
  const world = useWorld();
  const records = useLive(collection);
  return useMemo(() => records.filter((r) => (r as { worldId: string }).worldId === world?.id), [records, world?.id]);
}

/** The open world's books, in order. */
export function useBooks(): Book[] {
  const books = useWorldRecords('books');
  return useMemo(() => [...books].sort(byOrder), [books]);
}

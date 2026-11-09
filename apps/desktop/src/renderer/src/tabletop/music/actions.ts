import { useMemo } from 'react';
import { musicSrc } from '@/components/shared/Portrait';
import { useLive } from '@/lib/hooks';
import { arrange } from '@/lib/layout';
import { live, newId, now, type Layout } from '@/lib/model';
import { useVault } from '@/stores/vault';
import type { FreeTrack } from '@/lib/library/music';
import type { AttachedMusic, MusicTrack, TrackStart } from './model';

/**
 * Tabletop → Library → Music: adding tracks (copied beside the vault),
 * changing and deleting them, how they're arranged (spaces and folders, like
 * every list), and attaching them to an encounter or a scene.
 */

const store = () => useVault.getState();
const stamp = () => {
  const t = now();
  return { id: newId(), createdAt: t, updatedAt: t, deletedAt: null };
};

/** How long a track is, in seconds (0 if it can't be read). */
function durationOf(file: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0);
    audio.onerror = () => resolve(0);
    audio.src = musicSrc(file);
  });
}

/** Asks for music files and adds each as a track (its name from the file). */
export async function addMusic(): Promise<MusicTrack[]> {
  const files = await window.api.files.importMusic();
  const added: MusicTrack[] = [];
  for (const { file, name } of files) {
    const track: MusicTrack = { ...stamp(), name, file, duration: await durationOf(file) };
    store().put('music', track);
    added.push(track);
  }
  return added;
}

/** One of the Library's free tracks, as a track of yours (copied beside the vault once: the one already added comes back). */
export async function addLibraryTrack(entry: FreeTrack): Promise<MusicTrack | null> {
  const had = live(store().vault.music).find((t) => t.library === entry.id);
  if (had) return had;
  const copied = await window.api.files.importLibraryMusic(entry.file);
  if (!copied) return null;
  const track: MusicTrack = { ...stamp(), name: entry.name, file: copied.file, duration: await durationOf(copied.file), credit: `${entry.by} (CC0, ${entry.source})`, library: entry.id };
  store().put('music', track);
  return track;
}

/** A track as a record, for tests and imports that already have the file. */
export function createTrack(input: Pick<MusicTrack, 'name' | 'file'> & Partial<MusicTrack>): MusicTrack {
  const track: MusicTrack = { ...stamp(), duration: 0, ...input };
  store().put('music', track);
  return track;
}

export const updateTrack = (id: string, changes: Partial<MusicTrack>) => store().patch('music', id, changes);

/** Deletes a track (soft); returns its undo. Encounters and scenes it's on just skip it. */
export function deleteTrack(id: string): () => void {
  store().remove('music', id);
  return () => store().restore('music', id);
}

/** "3:07". */
export const formatDuration = (seconds: number) => (seconds > 0 ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}` : '–');

/** The Library's tracks as you've arranged them (once per account, kept as the 'music' library layout). */
export function useMusicLayout(): { layout: Layout; tracks: MusicTrack[]; editable: boolean; save: (next: Layout) => void } {
  const tracks = useLive('music');
  const saved = useVault((s) => s.vault.libraryLayouts.music);
  const sorted = useMemo(() => [...tracks].sort((a, b) => a.name.localeCompare(b.name)), [tracks]);
  const layout = useMemo(() => arrange(saved && !saved.deletedAt ? saved.layout : undefined, sorted.map((t) => ({ id: t.id, name: t.name || 'Untitled Track' })), ['Music']), [saved, sorted]);
  return {
    layout,
    tracks: sorted,
    editable: true,
    save: (next) => {
      const current = store().vault.libraryLayouts.music;
      if (current) store().patch('libraryLayouts', 'music', { layout: next });
      else store().put('libraryLayouts', { ...stamp(), id: 'music', layout: next });
    },
  };
}

/** Where a track is attached: the encounters and scenes that play it. */
export function usesOf(trackId: string): { encounters: string[]; scenes: string[] } {
  const v = store().vault;
  const has = (m?: AttachedMusic) => Boolean(m?.tracks.some((t) => t.trackId === trackId));
  return {
    encounters: live(v.encounters).filter((e) => has(e.music)).map((e) => e.name || 'Untitled Encounter'),
    scenes: live(v.playScenes).filter((s) => has(s.music)).map((s) => s.name || 'Untitled Scene'),
  };
}

// ── Attaching music (pure) ────────────────────────────────────────────────

export function attachTrack(music: AttachedMusic, trackId: string, start: TrackStart = 'manual'): AttachedMusic {
  if (music.tracks.some((t) => t.trackId === trackId)) return music;
  return { ...music, tracks: [...music.tracks, { trackId, start }] };
}

export const detachTrack = (music: AttachedMusic, trackId: string): AttachedMusic => ({ ...music, tracks: music.tracks.filter((t) => t.trackId !== trackId) });

export const setTrackStart = (music: AttachedMusic, trackId: string, start: TrackStart): AttachedMusic => ({ ...music, tracks: music.tracks.map((t) => (t.trackId === trackId ? { ...t, start } : t)) });

/** The track a scene plays when it starts: its first one set to start with the scene that still exists. */
export function autoTrack(music: AttachedMusic | undefined, tracks: Record<string, MusicTrack>): string | null {
  return music?.tracks.find((t) => t.start === 'auto' && tracks[t.trackId] && !tracks[t.trackId]!.deletedAt)?.trackId ?? null;
}

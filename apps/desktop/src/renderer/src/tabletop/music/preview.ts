import { useSyncExternalStore } from 'react';
import { musicSrc } from '@/components/shared/Portrait';

/**
 * Tabletop → Music: listening to a track before you attach it (the Library,
 * an encounter's music). One at a time: playing another stops the first.
 */
let audio: HTMLAudioElement | null = null;
let playing: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function previewTrack(id: string, file: string) {
  if (playing === id) return stopPreview();
  audio?.pause();
  audio = new Audio(musicSrc(file));
  audio.onended = () => stopPreview();
  void audio.play().catch(() => stopPreview());
  playing = id;
  emit();
}

export function stopPreview() {
  audio?.pause();
  audio = null;
  playing = null;
  emit();
}

/** The track being previewed (null: none). */
export function usePreviewing(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => playing,
  );
}

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { musicSrc } from '@/components/shared/Portrait';
import type { MusicTrack } from '@/tabletop/music/model';

/**
 * Play → the table's music: what the started scene plays, for everyone at the
 * table (the GM starts a track; each window plays it). Someone joining late
 * comes in where it is now, as online. Muting and the volume are each
 * person's own (this window's), never the table's.
 */

let muted = false;
let volume = 0.8;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const setMuted = (m: boolean) => {
  muted = m;
  emit();
};
export const setVolume = (v: number) => {
  volume = Math.max(0, Math.min(1, v));
  emit();
};
export const useMuted = () => useSyncExternalStore(subscribe, () => muted);
export const useVolume = () => useSyncExternalStore(subscribe, () => volume);

/** Plays the table's track (null: silence): from where it is now since `startedAt`, over and over if `loop`. */
export function useTableMusic(track: MusicTrack | null, startedAt: string | null, loop: boolean) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const isMuted = useMuted();
  const level = useVolume();

  useEffect(() => {
    if (!track || !startedAt) {
      audio.current?.pause();
      audio.current = null;
      return;
    }
    const el = new Audio(musicSrc(track.file));
    el.loop = loop;
    el.muted = muted;
    el.volume = volume;
    audio.current = el;
    const begin = () => {
      const elapsed = Math.max(0, (Date.now() - Date.parse(startedAt)) / 1000);
      const length = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : track.duration;
      if (length > 0) {
        if (elapsed < length) el.currentTime = elapsed;
        else if (loop) el.currentTime = elapsed % length;
        else return; // it's over already
      }
      void el.play().catch(() => {});
    };
    if (el.readyState >= 1) begin();
    else el.addEventListener('loadedmetadata', begin, { once: true });
    return () => {
      el.pause();
      if (audio.current === el) audio.current = null;
    };
  }, [track, startedAt, loop]);

  useEffect(() => {
    if (audio.current) {
      audio.current.muted = isMuted;
      audio.current.volume = level;
    }
  }, [isMuted, level]);
}

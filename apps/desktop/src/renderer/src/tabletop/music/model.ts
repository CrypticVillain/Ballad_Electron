import type { BaseRecord, Layout } from '@/lib/model';

/**
 * Tabletop → Library → Music: your tracks for the table (tavern noise, a
 * battle theme, rain), files kept beside the vault (its music folder). The
 * Library holds them for every campaign; encounters and Play's scenes attach
 * them.
 */
export type MusicTrack = BaseRecord & {
  name: string;
  /** The file beside the vault (ballad-media://music/…). */
  file: string;
  /** Seconds (0: not known yet). */
  duration: number;
  /** Who made it, as its license asks. */
  credit?: string;
  /** One of the Library's free tracks (lib/library/music): its id, so it's added once. */
  library?: string;
};

/** How an attached track starts: with the scene (Start), or when the GM plays it. */
export type TrackStart = 'auto' | 'manual';

/** Tracks attached to an encounter or a scene, in order. */
export type AttachedMusic = {
  tracks: { trackId: string; start: TrackStart }[];
  /** Each track plays over and over until another starts or it's stopped. */
  loop: boolean;
};

export const noMusic = (): AttachedMusic => ({ tracks: [], loop: true });

/**
 * How a Library list is arranged in spaces and folders, kept once per account
 * (its id: the list, 'music').
 */
export type LibraryLayout = BaseRecord & { layout: Layout };

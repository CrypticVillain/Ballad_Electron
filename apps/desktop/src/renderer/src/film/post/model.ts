import type { BaseRecord } from '@/lib/model';

/**
 * Filmmaking → Post: what happens after the shoot. Visual effects shots and
 * where they stand, the music cues (a cue sheet), and the cuts of the edit.
 */

export const VFX_STATUSES = [
  { id: 'todo', label: 'To Do', tone: 'off' },
  { id: 'progress', label: 'In Progress', tone: 'accent' },
  { id: 'review', label: 'In Review', tone: 'accent' },
  { id: 'final', label: 'Final', tone: 'online' },
] as const;
export type VfxStatus = (typeof VFX_STATUSES)[number]['id'];

export type VfxShot = BaseRecord & {
  worldId: string;
  /** "VFX_010". */
  code: string;
  sceneId: string | null;
  /** A shot from the shot list, if it's one of them. */
  shotId: string | null;
  description: string;
  vendor: string;
  status: VfxStatus;
  /** Day key, or ''. */
  due: string;
  cost: number;
  order: number;
};

/** How music is used, as a cue sheet says it. */
export const CUE_USES = [
  { id: 'BI', label: 'Background Instrumental' },
  { id: 'BV', label: 'Background Vocal' },
  { id: 'VI', label: 'Visual Instrumental' },
  { id: 'VV', label: 'Visual Vocal' },
  { id: 'MT', label: 'Main Title' },
  { id: 'ET', label: 'End Title' },
] as const;

export const CUE_SOURCES = ['Score', 'Licensed', 'Library'] as const;

export const LICENSE_STATUSES = [
  { id: 'none', label: 'Not Needed', tone: 'muted' },
  { id: 'requested', label: 'Requested', tone: 'accent' },
  { id: 'cleared', label: 'Cleared', tone: 'online' },
] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number]['id'];

export type MusicCue = BaseRecord & {
  worldId: string;
  /** "1M1": reel 1, music cue 1. */
  code: string;
  title: string;
  /** Composer, or artist and writers. */
  by: string;
  sceneId: string | null;
  /** Timecode in and out ("01:02:10:00", or "2:10"). */
  start: string;
  end: string;
  use: string;
  source: string;
  license: LicenseStatus;
  cost: number;
  notes: string;
  order: number;
};

export const CUT_STATUSES = [
  { id: 'editing', label: 'Editing', tone: 'accent' },
  { id: 'screened', label: 'Screened', tone: 'off' },
  { id: 'locked', label: 'Picture Lock', tone: 'online' },
] as const;
export type CutStatus = (typeof CUT_STATUSES)[number]['id'];

export type Cut = BaseRecord & {
  worldId: string;
  /** "Assembly", "Rough Cut 2", "Fine Cut". */
  name: string;
  /** Day key. */
  date: string;
  /** Running time, "1:32:10". */
  length: string;
  status: CutStatus;
  /** Where the export is: a path or link. */
  link: string;
  /** Notes from the screening. */
  notes: string;
};

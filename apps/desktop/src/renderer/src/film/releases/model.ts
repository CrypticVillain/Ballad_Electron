import type { BaseRecord } from '@/lib/model';

/**
 * Filmmaking → Releases: the signed permission to put someone or somewhere
 * on screen. Every cast member and location needs one; others (a crowd, a
 * song, artwork) can be added by name.
 */

export const RELEASE_KINDS = [
  { id: 'talent', label: 'Talent Release', for: 'Cast' },
  { id: 'location', label: 'Location Release', for: 'Locations' },
  { id: 'crew', label: 'Crew Deal Memo', for: 'Crew' },
  { id: 'appearance', label: 'Appearance Release', for: 'Others' },
  { id: 'materials', label: 'Materials Release', for: 'Others' },
] as const;
export type ReleaseKind = (typeof RELEASE_KINDS)[number]['id'];

export const RELEASE_STATUSES = [
  { id: 'needed', label: 'Needed', tone: 'off' },
  { id: 'sent', label: 'Sent', tone: 'accent' },
  { id: 'signed', label: 'Signed', tone: 'online' },
] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number]['id'];

export type ReleaseForm = BaseRecord & {
  worldId: string;
  /** The cast member, location or crew member it's for (null: someone or something else, by name). */
  entryId: string | null;
  name: string;
  kind: ReleaseKind;
  status: ReleaseStatus;
  /** Day key it was signed, or ''. */
  signedOn: string;
  /** A picture of the signed form. */
  scan?: string;
  notes: string;
};

import type { BaseRecord } from '@/lib/model';

/**
 * Filmmaking → Script: a script's title page, its lock (scene numbers that
 * never change once the script is locked) and its colored revisions.
 */

/** What a screenplay's elements are, as the script tools read them. */
export const ELEMENT_TYPES = ['sceneHeading', 'action', 'character', 'dialogue', 'parenthetical', 'transition'] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

/** One element of a script, as plain text. `dual`: a character speaking at the same time as the one before (dual dialogue). */
export type ScriptElement = { type: ElementType; text: string; dual?: boolean };

export type TitlePage = {
  /** Empty: the script's own title. */
  title: string;
  /** "Written by", "Screenplay by", "Story by". */
  credit: string;
  authors: string;
  /** "Based on the novel by…". */
  source: string;
  /** "Second Draft", "Shooting Script". */
  draft: string;
  /** Day key, or ''. */
  date: string;
  /** Name, phone, email, agent: one per line, at the bottom left. */
  contact: string;
};

export const emptyTitlePage = (): TitlePage => ({ title: '', credit: 'Written by', authors: '', source: '', draft: '', date: '', contact: '' });

/**
 * The standard revision colors, in order. White is the locked script itself;
 * each later color marks the changes made while it's the current one.
 */
export const REVISION_COLORS = [
  { name: 'White', tint: '#ffffff' },
  { name: 'Blue', tint: '#dfeaff' },
  { name: 'Pink', tint: '#ffe1ec' },
  { name: 'Yellow', tint: '#fff6c9' },
  { name: 'Green', tint: '#dff5df' },
  { name: 'Goldenrod', tint: '#fbe6b0' },
  { name: 'Buff', tint: '#f6ead2' },
  { name: 'Salmon', tint: '#ffd9cc' },
  { name: 'Cherry', tint: '#ffd0d6' },
  { name: 'Tan', tint: '#eadfcd' },
] as const;

/** A colored revision: changes from `startedAt` on are this color's. */
export type RevisionRound = { color: number; startedAt: string; label: string };

/** A locked script: its scenes' numbers as locked (in order), and the revision rounds since. */
export type ScriptLock = {
  lockedAt: string;
  /** [scene id, number] in script order: "12", and later "12A" for a scene put in after the lock. */
  numbers: [string, string][];
  rounds: RevisionRound[];
};

/** A script's own details (kept on its book). */
export type ScriptDetails = { titlePage?: TitlePage; lock?: ScriptLock | null };

/** The script as it stood when a revision round began: each scene's number and elements. What later changes are measured against. */
export type ScriptSnapshot = BaseRecord & {
  worldId: string;
  bookId: string;
  /** The round's color (0: the lock itself). */
  color: number;
  scenes: Record<string, { number: string; elements: ScriptElement[] }>;
};

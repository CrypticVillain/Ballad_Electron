import { newId, now } from '@/lib/model';

/**
 * What Play's modules (play/*) share, and only that: a new record's id and
 * times. Play has no worlds of its own: the open world is the Tabletop
 * campaign it's running.
 */

/** A new record's id and times. */
export const stamp = () => {
  const t = now();
  return { id: newId(), createdAt: t, updatedAt: t, deletedAt: null };
};

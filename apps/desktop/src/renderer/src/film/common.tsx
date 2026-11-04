import { Navigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useSection, useWorld } from '@/lib/hooks';
import { newId, now } from '@/lib/model';
import type { World } from '@/lib/model';

/**
 * What the Filmmaking modules (film/*) share, and only that: a new record's
 * id and times, the guard that keeps their pages to a production, and the
 * next order number. Each module's own logic stays in its folder.
 */

/** A new record's id and times. */
export const stamp = () => {
  const t = now();
  return { id: newId(), createdAt: t, updatedAt: t, deletedAt: null };
};

/** One past the highest order (0 for the first). */
export const nextOrder = (orders: number[]) => (orders.length ? Math.max(...orders) + 1 : 0);

/** A Filmmaking module's page: only in the Filmmaking section, with a production open (else Home). */
export function FilmOnly({ children }: { children: (world: World) => ReactNode }) {
  const section = useSection();
  const world = useWorld();
  if (section !== 'film' || !world) return <Navigate to="/" replace />;
  return <>{children(world)}</>;
}

/** A top-bar button's look (mono, uppercase, round). */
export const PILL = 'rounded-full font-mono text-xs tracking-[0.08em] uppercase';

import { Navigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useSection, useWorld } from '@/lib/hooks';
import { newId, now, type World } from '@/lib/model';

/**
 * What Play's modules (play/*) share, and only that: a new record's id and
 * times, and the guard that keeps their pages to Play. Play has no worlds of
 * its own: the open world is the Tabletop campaign it's running.
 */

/** A new record's id and times. */
export const stamp = () => {
  const t = now();
  return { id: newId(), createdAt: t, updatedAt: t, deletedAt: null };
};

/** A Play page: only in Play, with a campaign open (else Home). */
export function PlayOnly({ children }: { children: (world: World) => ReactNode }) {
  const section = useSection();
  const world = useWorld();
  if (section !== 'play' || !world) return <Navigate to="/" replace />;
  return <>{children(world)}</>;
}

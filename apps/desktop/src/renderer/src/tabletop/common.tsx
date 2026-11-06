import { Navigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useRole, useSection, useWorld } from '@/lib/hooks';
import { newId, now, type World } from '@/lib/model';

/**
 * What the Tabletop modules in their own folders (tabletop/*) share, and only
 * that: a new record's id and times, and the guard that keeps a GM's page to
 * the GM. Each module's own logic stays in its folder.
 */

/** A new record's id and times. */
export const stamp = () => {
  const t = now();
  return { id: newId(), createdAt: t, updatedAt: t, deletedAt: null };
};

/** A GM's page: only in Tabletop, in GM view, with a campaign open (else Home). */
export function GmOnly({ children }: { children: (world: World) => ReactNode }) {
  const section = useSection();
  const world = useWorld();
  const role = useRole();
  if (section !== 'tabletop' || role !== 'gm' || !world) return <Navigate to="/" replace />;
  return <>{children(world)}</>;
}

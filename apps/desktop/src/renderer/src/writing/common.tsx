import { Navigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useSection, useWorld } from '@/lib/hooks';
import { newId, now } from '@/lib/model';
import type { World } from '@/lib/model';

/**
 * What the Writing modules (writing/*) share, and only that: a new record's
 * id and times, and the guard that keeps their pages to a Writing world.
 * Each module's own logic stays in its folder.
 */

/** A new record's id and times. */
export const stamp = () => {
  const t = now();
  return { id: newId(), createdAt: t, updatedAt: t, deletedAt: null };
};

/** A Writing module's page: only in the Writing section, with a world open (else Home). */
export function WritingOnly({ children }: { children: (world: World) => ReactNode }) {
  const section = useSection();
  const world = useWorld();
  if (section !== 'writing' || !world) return <Navigate to="/" replace />;
  return <>{children(world)}</>;
}

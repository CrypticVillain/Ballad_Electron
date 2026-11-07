import { useMemo } from 'react';
import { updateWorld } from '@/lib/actions';
import { useWorld, useWorldRecords } from '@/lib/hooks';
import { arrange } from '@/lib/layout';
import { byOrder, type Layout } from '@/lib/model';
import type { PlayScene } from './model';

/** Play → Scenes: the campaign's scenes as the GM arranges them in the sidebar (spaces and folders, like the other lists). */
export function usePlayLayout(): { layout: Layout; scenes: PlayScene[]; editable: boolean; save: (next: Layout) => void } {
  const world = useWorld();
  const records = useWorldRecords('playScenes');
  const scenes = useMemo(() => [...records].sort(byOrder), [records]);
  const layout = useMemo(() => arrange(world?.layouts?.play, scenes.map((s) => ({ id: s.id, name: s.name || 'Untitled Scene' })), ['Scenes']), [world, scenes]);
  return {
    layout,
    scenes,
    editable: Boolean(world),
    save: (next) => {
      if (world) updateWorld(world.id, { layouts: { ...world.layouts, play: next } });
    },
  };
}

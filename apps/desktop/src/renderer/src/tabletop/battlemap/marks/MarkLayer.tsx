import { CheckIcon, EraserIcon } from 'lucide-react';
import { useMemo, type RefObject } from 'react';
import { toast } from 'sonner';
import { InkMarks, InkToolbar, useInkEditor, type InkEditor } from '@/components/ink/engine';
import { Button } from '@/components/ui/button';
import { live } from '@/lib/model';
import { useVault } from '@/stores/vault';
import type { BoardAccess } from '../tokens/resolve';
import { clearMark, markOf, saveMarks } from './actions';

/**
 * Marks (Play): drawing on a scene's board or a handout with Overture's ink
 * (components/ink): a pen, a highlighter, the eraser and the lasso, with a
 * pen, a finger or the mouse. Strokes are in units 1000 across the thing
 * drawn on, so they sit where they were drawn at any zoom.
 *
 *   useMarks     the marks this viewer sees on a thing: the GM every one (hidden ones faint),
 *                anyone else the shown ones; your own are always yours to see
 *   useMarking   your own marks, being drawn (they save as you go)
 *   MarkSheet    the marks as SVG, over what they're on (and yours, from the editor)
 *   MarkTools    the ink tools, Clear My Marks and Done
 */

/** What marks are drawn on: a scene's board or a handout, and the scene it's in. */
export type MarkTarget = { worldId: string; sceneId: string; onId: string };

export function useMarks(onId: string, access: BoardAccess) {
  const all = useVault((s) => s.vault.marks);
  return useMemo(() => {
    const on = live(all).filter((m) => m.onId === onId);
    return {
      mine: on.find((m) => m.accountId === access.accountId),
      others: on.filter((m) => m.accountId !== access.accountId && (access.gm || !m.hidden)),
    };
  }, [all, onId, access]);
}

export function useMarking({
  target,
  access,
  active,
  surface,
  toUnits,
  unitsPerPixel,
  onDone,
}: {
  target: MarkTarget | null;
  access: BoardAccess;
  active: boolean;
  /** The element drawn on (shown only while marking). */
  surface: RefObject<HTMLElement | null>;
  toUnits: (e: PointerEvent) => [number, number];
  unitsPerPixel: () => number;
  onDone: () => void;
}): InkEditor {
  const { mine } = useMarks(target?.onId ?? '', access);
  return useInkEditor({
    strokes: mine?.strokes ?? NONE,
    save: (strokes) => target && saveMarks(target, access.accountId, strokes),
    active,
    editable: active && Boolean(target),
    onEscape: onDone,
    surface,
    keys: surface,
    toInk: (e) => toUnits(e),
    unitsPerPixel: () => unitsPerPixel(),
  });
}

const NONE: never[] = [];

/** The marks on a thing, as SVG filling a box `width` × `height` (its own pixels), 1000 units across. */
export function MarkSheet({ onId, access, width, height, e, px }: { onId: string; access: BoardAccess; width: number; height: number; e?: InkEditor; px: number }) {
  const { mine, others } = useMarks(onId, access);
  const units = (height / width) * 1000;
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={height} viewBox={`0 0 1000 ${units}`} preserveAspectRatio="none">
      {others.map((m) => (
        <g key={m.id} opacity={m.hidden ? 0.35 : 1}>
          <InkMarks strokes={m.strokes} />
        </g>
      ))}
      {e ? (
        <g opacity={mine?.hidden ? 0.5 : 1}>
          <InkMarks e={e} px={px} />
        </g>
      ) : (
        mine && (
          <g opacity={mine.hidden ? 0.5 : 1}>
            <InkMarks strokes={mine.strokes} />
          </g>
        )
      )}
    </svg>
  );
}

/** The tools while marking: the ink's, then Clear My Marks (yours only; with Undo) and Done. */
export function MarkTools({ e, onId, access, onDone, className }: { e: InkEditor; onId: string; access: BoardAccess; onDone: () => void; className?: string }) {
  const clear = () => {
    const mine = markOf(onId, access.accountId);
    if (!mine) return;
    e.flush();
    const undo = clearMark(mine.id);
    e.clear();
    toast('Your Marks Cleared', { action: { label: 'Undo', onClick: undo } });
  };
  return (
    <InkToolbar e={e} className={className}>
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Button variant="ghost" size="sm" disabled={!e.strokes.length} onClick={clear}>
        <EraserIcon /> Clear My Marks
      </Button>
      <Button size="sm" variant="outline" onClick={onDone}>
        <CheckIcon /> Done
      </Button>
    </InkToolbar>
  );
}

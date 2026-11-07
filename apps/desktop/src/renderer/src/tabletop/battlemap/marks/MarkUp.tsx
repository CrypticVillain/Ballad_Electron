import { EyeIcon, EyeOffIcon, PenLineIcon } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { penInUse, useSurfaceRef } from '@/components/ink/engine';
import { Hint } from '@/components/shared/Hint';
import { mediaSrc } from '@/components/shared/Portrait';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import { useVault } from '@/stores/vault';
import { currentAccount } from '../people';
import type { BoardAccess } from '../tokens/resolve';
import { setMarkHidden } from './actions';
import { MarkSheet, MarkTools, useMarking, useMarks, type MarkTarget } from './MarkLayer';

/**
 * Marking up a picture, without changing it (marks/): a location's scouting
 * photo, a portrait. The marks are kept apart, over the picture, and can be
 * hidden. MarkablePicture shows a picture as big as fits with its marks
 * (Mark Up to draw); MarkUpDialog opens one large; MarkedBadge says a
 * picture has marks.
 */

/** Marks on a picture are its own (keyed by the thing and the picture's file), so another picture starts clean. */
export const pictureMarks = (ownerId: string, file: string) => `${ownerId}:${file}`;

/** Whoever's looking at a picture's marks: all of them, as the GM sees a scene's. */
const viewer = (): BoardAccess => ({ gm: true, accountId: currentAccount() });

export function MarkablePicture({ src, target, marking, onDone, className }: { src: string; target: MarkTarget; marking: boolean; onDone: () => void; className?: string }) {
  const [access] = useState(viewer);
  const finger = usePreferences((s) => s.inkFinger);
  const area = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [overlay, setOverlay] = useSurfaceRef<HTMLDivElement>();
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [fit, setFit] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth || 1000, h: img.naturalHeight || 750 });
    img.src = mediaSrc(src);
  }, [src]);
  useLayoutEffect(() => {
    const el = area.current;
    if (!el || !natural) return;
    const measure = () => {
      const k = Math.min(el.clientWidth / natural.w, el.clientHeight / natural.h);
      setFit({ w: natural.w * k, h: natural.h * k });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [natural]);
  useEffect(() => {
    if (marking) overlay.current?.focus({ preventScroll: true });
  }, [marking, overlay]);

  const units = () => 1000 / (box.current?.getBoundingClientRect().width || 1000);
  const ink = useMarking({
    target,
    access,
    active: marking,
    surface: overlay,
    toUnits: (e) => {
      const r = box.current!.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * 1000, ((e.clientY - r.top) / r.width) * 1000];
    },
    unitsPerPixel: units,
    onDone,
  });
  const { mine } = useMarks(target.onId, access);
  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      {marking && (
        <div className="flex justify-center">
          <MarkTools e={ink} onId={target.onId} access={access} onDone={onDone} className="rounded-xl border bg-background p-1" />
        </div>
      )}
      <div ref={area} className="relative flex min-h-0 flex-1 items-center justify-center">
        <div ref={box} className="relative shrink-0 overflow-hidden rounded-lg" style={{ width: fit.w, height: fit.h }}>
          <img src={mediaSrc(src)} alt="" draggable={false} className="pointer-events-none size-full select-none" />
          {fit.w > 0 && !(mine?.hidden && !marking) && <MarkSheet onId={target.onId} access={access} width={fit.w} height={fit.h} e={ink} px={units()} />}
          {marking && <div ref={setOverlay} tabIndex={-1} aria-label="Marking up the picture" className="absolute inset-0 cursor-crosshair outline-none" style={{ touchAction: finger && !penInUse() ? 'none' : 'pan-y' }} />}
        </div>
      </div>
    </div>
  );
}

/** Mark Up and Hide / Show Marks, for a picture's marks (yours). */
export function MarkUpButtons({ target, marking, setMarking, children }: { target: MarkTarget; marking: boolean; setMarking: (on: boolean) => void; children?: ReactNode }) {
  const [access] = useState(viewer);
  const { mine } = useMarks(target.onId, access);
  return (
    <div className="flex items-center gap-1.5">
      {children}
      {mine && !marking && (
        <Hint label={mine.hidden ? 'Show your marks on it' : 'Hide your marks (the picture itself never changes)'}>
          <Button variant="ghost" size="sm" onClick={() => setMarkHidden(mine.id, !mine.hidden)}>
            {mine.hidden ? <EyeIcon /> : <EyeOffIcon />} {mine.hidden ? 'Show Marks' : 'Hide Marks'}
          </Button>
        </Hint>
      )}
      <Button size="sm" variant={marking ? 'default' : 'outline'} aria-pressed={marking} onClick={() => setMarking(!marking)}>
        <PenLineIcon /> Mark Up
      </Button>
    </div>
  );
}

/** A picture, large, to mark up: a portrait (Mark Up beside it). */
export function MarkUpDialog({ title, src, target, onClose }: { title: string; src: string; target: MarkTarget; onClose: () => void }) {
  const [marking, setMarking] = useState(true);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[min(820px,calc(100vh-64px))] flex-col sm:max-w-[1000px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="flex-row items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <DialogTitle className="font-display text-xl font-black uppercase">Mark Up · {title}</DialogTitle>
            <DialogDescription>Draw on it with a pen, a finger or the mouse. The picture itself never changes: the marks sit on top, and can be hidden.</DialogDescription>
          </div>
          <MarkUpButtons target={target} marking={marking} setMarking={setMarking} />
        </DialogHeader>
        <MarkablePicture src={src} target={target} marking={marking} onDone={() => setMarking(false)} className="flex-1" />
      </DialogContent>
    </Dialog>
  );
}

/** A small pen in a picture's corner: it has marks of yours (shown). */
export function MarkedBadge({ onId, className }: { onId: string; className?: string }) {
  const marked = useVault((s) => Object.values(s.vault.marks).some((m) => m.onId === onId && !m.deletedAt && !m.hidden && m.strokes.length > 0));
  if (!marked) return null;
  return (
    <span aria-label="Marked up" className={cn('flex size-5 items-center justify-center rounded-full bg-background/90 text-primary shadow', className)}>
      <PenLineIcon className="size-3" />
    </span>
  );
}

/**
 * Marks on a map you pan and zoom (Tabletop's maps, Writing's): over the
 * image in its own pixels (`view` places them: translate, then scale), and,
 * while `marking`, a surface over the map that takes the pen (the wheel
 * still zooms), with the tools at the top. Yours and anyone else's on it.
 */
export function MapMarks({ target, width, height, view, marking, onDone }: { target: MarkTarget; width: number; height: number; view: { x: number; y: number; k: number }; marking: boolean; onDone: () => void }) {
  const [access] = useState(viewer);
  const finger = usePreferences((s) => s.inkFinger);
  const overlay = useRef<HTMLDivElement>(null);
  const unit = 1000 / Math.max(1, width);
  const ink = useMarking({
    target,
    access,
    active: marking,
    surface: overlay,
    toUnits: (e) => {
      const r = overlay.current!.getBoundingClientRect();
      return [((e.clientX - r.left - view.x) / view.k) * unit, ((e.clientY - r.top - view.y) / view.k) * unit];
    },
    unitsPerPixel: () => unit / view.k,
    onDone,
  });
  const { mine } = useMarks(target.onId, access);
  useEffect(() => {
    if (marking) overlay.current?.focus({ preventScroll: true });
  }, [marking]);
  return (
    <>
      {!(mine?.hidden && !marking) && (
        <div className="pointer-events-none absolute top-0 left-0 origin-top-left" style={{ width, height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <MarkSheet onId={target.onId} access={access} width={width} height={height} e={ink} px={unit / view.k} />
        </div>
      )}
      {marking && (
        <>
          <div
            ref={overlay}
            tabIndex={-1}
            aria-label="Marking up the map"
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute inset-0 z-20 cursor-crosshair outline-none"
            style={{ touchAction: finger && !penInUse() ? 'none' : 'pan-x pan-y' }}
          />
          <MarkTools e={ink} onId={target.onId} access={access} onDone={onDone} className="absolute top-3 left-1/2 z-30 max-w-[calc(100%-24px)] -translate-x-1/2 rounded-xl border bg-background/95 p-1 shadow-md backdrop-blur" />
        </>
      )}
    </>
  );
}

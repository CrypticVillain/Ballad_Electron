import { ArrowLeftIcon, EraserIcon, PenLineIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { penInUse } from '@/components/ink/engine';
import { Hint } from '@/components/shared/Hint';
import { mediaSrc } from '@/components/shared/Portrait';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import { clearMarksOn, marksOn } from '@/tabletop/battlemap/marks/actions';
import { MarkSheet, MarkTools, useMarking } from '@/tabletop/battlemap/marks/MarkLayer';
import type { BoardAccess } from '@/tabletop/battlemap/tokens/resolve';
import { deleteHandout, updateHandout } from './handouts';
import type { Handout } from './model';
import { VisibilityEye } from './SceneObjects';

/**
 * Play → a handout, open in the board's place: its picture, or a note's
 * words on a card, as big as fits. Mark Up draws on it (everyone at the
 * table sees the marks, unless they're hidden). The GM names it, writes a
 * note's words, shows or hides it (the eye), clears everyone's marks or
 * deletes it; a player sees the shown ones of the scene the table sees.
 */
export function HandoutStage({ handout, access, shown, onBack }: { handout: Handout; access: BoardAccess; shown: boolean; onBack: () => void }) {
  const gm = access.gm;
  const [marking, setMarking] = useState(false);
  const finger = usePreferences((s) => s.inkFinger);
  const area = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ w: 0, h: 0 });

  // As big as fits, keeping its shape.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const measure = () => {
      const k = Math.min((el.clientWidth - 48) / handout.width, (el.clientHeight - 48) / handout.height);
      setFit({ w: Math.max(0, handout.width * k), h: Math.max(0, handout.height * k) });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [handout.width, handout.height]);
  useEffect(() => {
    if (marking) overlay.current?.focus({ preventScroll: true });
  }, [marking]);

  const units = () => 1000 / (box.current?.getBoundingClientRect().width || 1000);
  const target = { worldId: handout.worldId, sceneId: handout.sceneId, onId: handout.id };
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
    onDone: () => setMarking(false),
  });
  const clearAll = () => {
    if (!marksOn(handout.id).length) return;
    const undo = clearMarksOn(handout.id);
    toast('Every Mark Cleared', { description: handout.name || 'Handout', action: { label: 'Undo', onClick: undo } });
  };

  return (
    <main aria-label={`Handout: ${handout.name || 'Handout'}`} className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeftIcon /> The Scene
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        {gm ? (
          <input aria-label="Handout name" value={handout.name} maxLength={80} onChange={(e) => updateHandout(handout.id, { name: e.target.value })} className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-2 text-[14px] font-semibold outline-none hover:bg-muted focus:bg-muted" />
        ) : (
          <span className="min-w-0 flex-1 truncate px-2 text-[14px] font-semibold">{handout.name || 'Handout'}</span>
        )}
        {gm && <VisibilityEye hidden={handout.hidden} shown={shown} label={handout.name || 'Handout'} onToggle={() => updateHandout(handout.id, { hidden: !handout.hidden })} />}
        <Button size="sm" variant={marking ? 'default' : 'outline'} aria-pressed={marking} onClick={() => setMarking(!marking)}>
          <PenLineIcon /> Mark Up
        </Button>
        {gm && (
          <>
            <Hint label="Clear everyone’s marks on it">
              <Button variant="ghost" size="icon" aria-label="Clear Every Mark" onClick={clearAll}>
                <EraserIcon />
              </Button>
            </Hint>
            <Hint label="Delete the handout">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete Handout"
                onClick={() => {
                  deleteHandout(handout);
                  onBack();
                }}
              >
                <Trash2Icon />
              </Button>
            </Hint>
          </>
        )}
      </div>
      {marking && (
        <div className="flex justify-center border-b px-3 py-1.5">
          <MarkTools e={ink} onId={handout.id} access={access} onDone={() => setMarking(false)} />
        </div>
      )}
      <div ref={area} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] [background-size:24px_24px]">
        <div ref={box} className={cn('relative shrink-0 overflow-hidden rounded-md shadow-[0_0_0_1px_rgb(0_0_0/0.15),0_12px_40px_rgb(0_0_0/0.3)]', !handout.image && 'bg-card')} style={{ width: fit.w, height: fit.h }}>
          {handout.image ? (
            <img src={mediaSrc(handout.image)} alt={handout.name} draggable={false} className="pointer-events-none size-full select-none" />
          ) : gm && !marking ? (
            <textarea
              aria-label="Note"
              value={handout.text}
              placeholder="What the note says: a letter, a riddle, a rumor…"
              onChange={(e) => updateHandout(handout.id, { text: e.target.value })}
              className="size-full resize-none bg-transparent p-[6%] font-serif text-[clamp(13px,2.2vw,22px)] leading-relaxed outline-none"
            />
          ) : (
            <p className="size-full overflow-hidden p-[6%] font-serif text-[clamp(13px,2.2vw,22px)] leading-relaxed whitespace-pre-wrap">{handout.text}</p>
          )}
          {fit.w > 0 && <MarkSheet onId={handout.id} access={access} width={fit.w} height={fit.h} e={ink} px={units()} />}
          {marking && <div ref={overlay} tabIndex={-1} aria-label="Marking up the handout" className="absolute inset-0 cursor-crosshair outline-none" style={{ touchAction: finger && !penInUse() ? 'none' : 'pan-x pan-y' }} />}
        </div>
      </div>
    </main>
  );
}

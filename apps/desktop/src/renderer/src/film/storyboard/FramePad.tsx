import { ImageMinusIcon, ImagePlusIcon, SaveIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { InkMarks, InkToolbar, penInUse, resolveColor, useInkEditor, useSurfaceRef } from '@/components/ink/engine';
import { mediaSrc, pickPicture } from '@/components/shared/Portrait';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { encodePoints, inkColor, inkFrameSvg, type InkPoint } from '@/lib/ink';
import { newId, type InkColor, type InkStroke, type Shot } from '@/lib/model';
import { usePreferences } from '@/stores/preferences';
import { FRAME_H, FRAME_W, type Stroke } from './model';

/**
 * Filmmaking → Storyboard: drawing a shot's frame, with handwriting's tools
 * (components/ink, Overture's): a pen with pressure, a highlighter, the
 * eraser, the lasso, Undo and Redo. On a blank frame, or over a picture (an
 * uploaded one, never changed: the drawing sits on top). Save Frame keeps
 * the drawing (to draw on again) and the picture with it on, as the frame.
 *
 * A frame is 1000 units across and 16:9; the paper is white, so `ink` is
 * drawn dark in either theme.
 */

export const FRAME_UNITS = { w: 1000, h: (1000 * FRAME_H) / FRAME_W };

const OLD_COLORS: Record<string, InkColor> = { '#111111': 'ink', '#6b7280': 'gray', '#dc2626': 'red', '#2563eb': 'blue' };

/** What a frame starts from: its drawing, or a sketch from before handwriting (as strokes; one with the eraser in it stays as the picture underneath). */
export function frameStart(shot: Shot): { base: string | null; strokes: InkStroke[] } {
  if (shot.ink || !shot.sketch?.length) return { base: shot.base ?? null, strokes: shot.ink ?? [] };
  if (shot.sketch.some((s) => s.erase)) return { base: shot.frame ?? null, strokes: [] };
  const k = FRAME_UNITS.w / FRAME_W;
  return {
    base: null,
    strokes: shot.sketch.map((s: Stroke) => {
      const points: InkPoint[] = [];
      for (let i = 0; i + 1 < s.points.length; i += 2) points.push([s.points[i]! * k, s.points[i + 1]! * k, 0.5]);
      return { id: newId(), tool: 'pen', color: OLD_COLORS[s.color] ?? 'ink', size: s.width * k, points: encodePoints(points) };
    }),
  };
}

/** The frame as a PNG: white, the picture underneath (filling it), the drawing on top. */
async function framePng(base: string | null, strokes: InkStroke[]): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W;
  canvas.height = FRAME_H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, FRAME_W, FRAME_H);
  const load = async (src: string) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
  };
  if (base) {
    const img = await load(mediaSrc(base));
    const k = Math.max(FRAME_W / img.naturalWidth, FRAME_H / img.naturalHeight);
    const w = img.naturalWidth * k;
    const h = img.naturalHeight * k;
    ctx.drawImage(img, (FRAME_W - w) / 2, (FRAME_H - h) / 2, w, h);
  }
  if (strokes.length) {
    const svg = inkFrameSvg(strokes, FRAME_UNITS.w, FRAME_UNITS.h, (c) => (c === 'ink' ? '#111111' : resolveColor(inkColor(c))));
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      ctx.drawImage(await load(url), 0, 0, FRAME_W, FRAME_H);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('no picture'))), 'image/png'));
}

export function FramePad({ title, shot, onSave, onClose }: { title: string; shot: Shot; onSave: (frame: { frame?: string; base: string | null; ink: InkStroke[] }) => void; onClose: () => void }) {
  const start = useRef(frameStart(shot)).current;
  const [base, setBase] = useState<string | null>(start.base);
  const [busy, setBusy] = useState(false);
  const finger = usePreferences((s) => s.inkFinger);
  const [surface, setSurface] = useSurfaceRef<HTMLDivElement>();
  const latest = useRef(start.strokes);
  const unitsPerPixel = () => FRAME_UNITS.w / (surface.current?.getBoundingClientRect().width || FRAME_UNITS.w);
  const e = useInkEditor({
    strokes: start.strokes,
    save: (strokes) => (latest.current = strokes),
    active: true,
    editable: true,
    surface,
    keys: surface,
    toInk: (ev, el) => {
      const r = el.getBoundingClientRect();
      return [((ev.clientX - r.left) / r.width) * FRAME_UNITS.w, ((ev.clientY - r.top) / r.width) * FRAME_UNITS.w];
    },
    unitsPerPixel,
  });
  useEffect(() => surface.current?.focus({ preventScroll: true }), [surface]);

  const save = async () => {
    setBusy(true);
    try {
      e.flush();
      const strokes = e.strokes;
      if (!base && !strokes.length) {
        onSave({ frame: undefined, base: null, ink: [] });
        return onClose();
      }
      const bytes = new Uint8Array(await (await framePng(base, strokes)).arrayBuffer());
      const saved = await window.api.files.savePicture(bytes, 'png');
      if (!saved) throw new Error('not saved');
      onSave({ frame: saved.file, base, ink: strokes });
      onClose();
    } catch {
      toast.error('The frame couldn’t be saved', { description: 'Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[1000px]" onOpenAutoFocus={(ev) => ev.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-black uppercase">Draw · {title}</DialogTitle>
          <DialogDescription>Draw the frame (who’s where, where the camera looks), on a blank frame or over a picture. Stick figures are fine.</DialogDescription>
        </DialogHeader>
        <InkToolbar e={e} className="rounded-xl border px-2 py-1.5">
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          <Button variant="ghost" size="sm" onClick={() => void pickPicture().then((p) => p && setBase(p))}>
            <ImagePlusIcon /> {base ? 'Another Picture' : 'A Picture Underneath'}
          </Button>
          {base && (
            <Button variant="ghost" size="sm" onClick={() => setBase(null)}>
              <ImageMinusIcon /> No Picture
            </Button>
          )}
          <Button variant="ghost" size="sm" disabled={!e.strokes.length} onClick={() => e.clear()}>
            <Trash2Icon /> Clear
          </Button>
        </InkToolbar>
        {/* White paper: the theme's ink color is drawn dark on it. */}
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-white" style={{ '--foreground': '#111111' } as CSSProperties}>
          {base && <img src={mediaSrc(base)} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full object-cover select-none" />}
          <svg aria-hidden className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${FRAME_UNITS.w} ${FRAME_UNITS.h}`}>
            <InkMarks e={e} px={unitsPerPixel()} />
          </svg>
          <div ref={setSurface} tabIndex={-1} aria-label="Frame" className="absolute inset-0 cursor-crosshair outline-none" style={{ touchAction: finger && !penInUse() ? 'none' : 'pan-y' }} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => void save()}>
            <SaveIcon /> Save Frame
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

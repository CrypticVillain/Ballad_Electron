import { EraserIcon, PenIcon, SaveIcon, Trash2Icon, Undo2Icon } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { FRAME_H, FRAME_W, type Stroke } from './model';

/**
 * Filmmaking → Storyboard: a sketch pad for a shot's frame (16:9). Pen in a
 * few colors and widths, an eraser, undo. Saving keeps the strokes (to draw
 * on again later) and a picture of them as the frame.
 */

const COLORS = ['#111111', '#6b7280', '#dc2626', '#2563eb'];
const WIDTHS = [3, 7, 16];

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, FRAME_W, FRAME_H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    ctx.strokeStyle = s.erase ? '#ffffff' : s.color;
    ctx.lineWidth = s.erase ? s.width * 3 : s.width;
    ctx.beginPath();
    const p = s.points;
    if (p.length < 2) continue;
    ctx.moveTo(p[0]!, p[1]!);
    if (p.length === 2) ctx.lineTo(p[0]! + 0.1, p[1]!);
    for (let i = 2; i < p.length - 2; i += 2) {
      // Through the midpoints, for a smooth line.
      ctx.quadraticCurveTo(p[i]!, p[i + 1]!, (p[i]! + p[i + 2]!) / 2, (p[i + 1]! + p[i + 3]!) / 2);
    }
    if (p.length > 2) ctx.lineTo(p.at(-2)!, p.at(-1)!);
    ctx.stroke();
  }
  // A thirds grid isn't drawn: the frame is the drawing.
}

export function SketchPad({ title, initial, onSave, onClose }: { title: string; initial: Stroke[]; onSave: (file: string, strokes: Stroke[]) => void; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>(initial);
  const [color, setColor] = useState(COLORS[0]!);
  const [width, setWidth] = useState(WIDTHS[1]!);
  const [erase, setErase] = useState(false);
  const [busy, setBusy] = useState(false);
  const drawing = useRef<Stroke | null>(null);

  const redraw = (list: Stroke[]) => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx) drawStrokes(ctx, list);
  };
  useEffect(() => redraw(strokes), [strokes]);

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * FRAME_W), Math.round(((e.clientY - r.top) / r.height) * FRAME_H)];
  };
  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = { color, width, points: point(e), ...(erase ? { erase: true } : {}) };
    redraw([...strokes, drawing.current]);
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current.points.push(...point(e));
    redraw([...strokes, drawing.current]);
  };
  const up = () => {
    if (!drawing.current) return;
    const done = drawing.current;
    drawing.current = null;
    setStrokes((s) => [...s, done]);
  };

  const save = async () => {
    if (!canvas.current) return;
    setBusy(true);
    try {
      redraw(strokes);
      const blob = await new Promise<Blob | null>((resolve) => canvas.current!.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('no picture');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const saved = window.api.files.savePicture ? await window.api.files.savePicture(bytes, 'png') : null;
      onSave(saved?.file ?? canvas.current.toDataURL('image/png'), strokes);
      onClose();
    } catch {
      toast.error('The sketch couldn’t be saved', { description: 'Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[960px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-black uppercase">Sketch · {title}</DialogTitle>
          <DialogDescription>Draw the frame: who’s where, where the camera looks. Stick figures are fine.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" aria-pressed={!erase} onClick={() => setErase(false)} className={cn('flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px]', !erase && 'border-foreground bg-foreground text-background')}>
            <PenIcon className="size-3.5" /> Pen
          </button>
          <button type="button" aria-pressed={erase} onClick={() => setErase(true)} className={cn('flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px]', erase && 'border-foreground bg-foreground text-background')}>
            <EraserIcon className="size-3.5" /> Eraser
          </button>
          <span className="mx-1 h-5 w-px bg-border" />
          {COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c && !erase} onClick={() => (setColor(c), setErase(false))} className={cn('size-7 rounded-full border-2 border-transparent', color === c && !erase && 'border-primary')}>
              <span className="block size-full rounded-full border border-background" style={{ background: c }} />
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-border" />
          {WIDTHS.map((w) => (
            <button key={w} type="button" aria-label={`Width ${w}`} aria-pressed={width === w} onClick={() => setWidth(w)} className={cn('flex size-8 items-center justify-center rounded-full border', width === w && 'border-foreground')}>
              <span className="rounded-full bg-foreground" style={{ width: Math.max(3, w / 1.4), height: Math.max(3, w / 1.4) }} />
            </button>
          ))}
          <span className="flex-1" />
          <Button variant="ghost" size="sm" disabled={!strokes.length} onClick={() => setStrokes((s) => s.slice(0, -1))}>
            <Undo2Icon /> Undo
          </Button>
          <Button variant="ghost" size="sm" disabled={!strokes.length} onClick={() => setStrokes([])}>
            <Trash2Icon /> Clear
          </Button>
        </div>
        <canvas
          ref={canvas}
          width={FRAME_W}
          height={FRAME_H}
          aria-label="Sketch"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="aspect-video w-full cursor-crosshair touch-none rounded-lg border bg-white"
        />
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

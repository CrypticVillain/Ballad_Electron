/**
 * InkSurface — a sheet to write on: the Handwriting block in pages, Quick
 * Capture's Sketch, Today's scratchpad, and a picture being marked up.
 *
 *   Viewing   the ink, drawn sharp in the theme's colors. Click or tap in to
 *             write (a pen starts writing straight away).
 *   Writing   the tools on top (engine.tsx), and ⋯: the paper (blank, lined,
 *             grid), export (PNG, SVG, copy as a picture), Clear, and Delete
 *             when it can be deleted. Esc or clicking outside stops writing.
 *
 * Paper grows as you write near the bottom, and its bottom edge drags to
 * resize it. A picture keeps its own shape: the marks sit on top of it (it's
 * never changed), and can be hidden. Ink is 1000 units wide, so it scales
 * with the space it's shown in.
 */
import { CopyIcon, DownloadIcon, EllipsisIcon, EraserIcon, EyeIcon, EyeOffIcon, ImageIcon, PenLineIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { INK_WIDTH, inkColor, inkSvg, strokeBox } from '@/lib/ink';
import type { Ink, InkStroke } from '@/lib/model';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import { useVault } from '@/stores/vault';
import { InkMarks, InkToolbar, penInUse, resolveColor, useInkEditor } from './engine';

const MIN_HEIGHT = 140;

/** Writing near the bottom grows the paper. */
const needed = (strokes: InkStroke[]) => Math.max(0, ...strokes.map((s) => strokeBox(s).y + strokeBox(s).h));

export function InkSurface({
  ink,
  editable,
  onDelete,
  onPlainPicture,
  startActive = false,
  placeholder,
  onActiveChange,
  onStrokes,
  className,
}: {
  ink: Ink;
  editable: boolean;
  onDelete?: () => void;
  /** A marked-up picture: back to the picture without the marks (the marks go). */
  onPlainPicture?: () => void;
  startActive?: boolean;
  /** What an empty sheet says. */
  placeholder?: ReactNode;
  onActiveChange?: (active: boolean) => void;
  /** Every change, as it's drawn (before it's saved). */
  onStrokes?: (strokes: InkStroke[]) => void;
  className?: string;
}) {
  const finger = usePreferences((s) => s.inkFinger);
  const [active, setActiveState] = useState(startActive && editable);
  const setActive = (next: boolean) => {
    setActiveState(next);
    onActiveChange?.(next);
  };
  const picture = ink.image ?? null;
  const [height, setHeight] = useState(ink.height);
  useEffect(() => {
    if (!active) setHeight(ink.height);
  }, [ink.height, active]);
  const heightRef = useRef(height);
  heightRef.current = height;

  const surface = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const e = useInkEditor({
    strokes: ink.strokes,
    save: (strokes) => useVault.getState().patch('inks', ink.id, { strokes, height: heightRef.current }),
    active,
    editable,
    onActivate: () => {
      setActive(true);
      wrapper.current?.focus({ preventScroll: true });
    },
    onEscape: () => setActive(false),
    surface,
    keys: wrapper,
    toInk: (ev, el) => {
      const rect = el.getBoundingClientRect();
      const scale = INK_WIDTH / rect.width;
      return [(ev.clientX - rect.left) * scale, (ev.clientY - rect.top) * scale];
    },
    unitsPerPixel: (el) => INK_WIDTH / (el.getBoundingClientRect().width || INK_WIDTH),
    onChange: (strokes) => {
      onStrokes?.(strokes);
      if (picture) return;
      const bottom = needed(strokes);
      if (bottom > heightRef.current - 70) {
        const grown = Math.ceil((bottom + 180) / 20) * 20;
        heightRef.current = grown;
        setHeight(grown);
      }
    },
  });

  // The page's editor would treat a mouse-down anywhere here (the toolbar too) as selecting around it, and take the focus.
  // (Only mouse-down: React's click handlers listen above the editor, so clicks have to get through.)
  useEffect(() => {
    const el = wrapper.current;
    if (!el || !editable) return;
    const guard = (ev: Event) => {
      ev.stopPropagation();
      if (!(ev.target as Element).closest('input, textarea')) ev.preventDefault();
    };
    el.addEventListener('mousedown', guard);
    el.addEventListener('dragstart', guard);
    return () => {
      el.removeEventListener('mousedown', guard);
      el.removeEventListener('dragstart', guard);
    };
  }, [editable]);

  // Clicking outside (and outside its menus) stops writing: on the click, not the press, so what was clicked
  // (a Save button below, say) gets the click before the tools fold away and move it.
  useEffect(() => {
    if (!active) return;
    const outside = (ev: Event) => {
      const target = ev.target as Element | null;
      if (!target || wrapper.current?.contains(target) || target.closest('[data-radix-popper-content-wrapper]')) return;
      setTimeout(() => setActive(false));
    };
    document.addEventListener('click', outside, true);
    return () => document.removeEventListener('click', outside, true);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (startActive && editable) wrapper.current?.focus({ preventScroll: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resizing the paper ───────────────────────────────────────────────────
  const resize = (ev: React.PointerEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    const el = surface.current!;
    const scale = INK_WIDTH / el.getBoundingClientRect().width;
    const startY = ev.clientY;
    const start = heightRef.current;
    const floor = Math.max(MIN_HEIGHT, Math.ceil(needed(e.strokes) + 20));
    const moveTo = (m: PointerEvent) => {
      const h = Math.max(floor, Math.round(start + (m.clientY - startY) * scale));
      heightRef.current = h;
      setHeight(h);
    };
    const end = () => {
      window.removeEventListener('pointermove', moveTo);
      window.removeEventListener('pointerup', end);
      useVault.getState().patch('inks', ink.id, { height: heightRef.current });
    };
    window.addEventListener('pointermove', moveTo);
    window.addEventListener('pointerup', end);
  };

  // ── Export ───────────────────────────────────────────────────────────────
  const drawing = (background: boolean) => {
    const colors = (c: Parameters<typeof inkColor>[0]) => resolveColor(inkColor(c));
    if (!picture) return inkSvg(e.strokes, colors, { background: background ? resolveColor('var(--background)') : null });
    // A marked-up picture: the whole picture, with the marks on it.
    const h = Math.round(INK_WIDTH * (picture.height / picture.width));
    const marks = ink.hidden ? '' : inkSvg(e.strokes, colors, { pad: 0 }).svg.replace(/^<svg[^>]*>|<\/svg>$/g, '');
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${INK_WIDTH}" height="${h}" viewBox="0 0 ${INK_WIDTH} ${h}"><image href="${picture.src}" width="${INK_WIDTH}" height="${h}"/>${marks}</svg>`,
      width: INK_WIDTH,
      height: h,
    };
  };
  const toPng = async () => {
    const { svg, width, height: h } = drawing(true);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      const k = picture ? Math.max(1, picture.width / INK_WIDTH) : 2;
      canvas.width = Math.round(width * k);
      canvas.height = Math.round(h * k);
      canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('Couldn’t draw the picture'))), 'image/png'));
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  const exportAs = async (format: 'png' | 'svg' | 'copy') => {
    if (!e.strokes.length && !picture) return toast('Nothing written yet');
    try {
      if (format === 'copy') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': await toPng() })]);
        return toast(picture ? 'Marked-up picture copied' : 'Handwriting copied as a picture');
      }
      const name = picture ? `${(picture.name ?? 'Picture').replace(/\.[^.]+$/, '')} (Marked Up)` : 'Handwriting';
      const path =
        format === 'svg'
          ? await window.api.files.saveText({ defaultName: `${name}.svg`, text: drawing(false).svg, filter: { name: 'SVG Image', extensions: ['svg'] } })
          : await window.api.files.saveBinary({ defaultName: `${name}.png`, data: new Uint8Array(await (await toPng()).arrayBuffer()), filter: { name: 'PNG Image', extensions: ['png'] } });
      if (path) toast(picture ? 'Picture saved' : 'Handwriting saved', { description: path });
    } catch (error) {
      toast.error('Couldn’t export it', { description: (error as Error).message });
    }
  };

  const view = { w: INK_WIDTH, h: picture ? Math.round(INK_WIDTH * (picture.height / picture.width)) : Math.max(MIN_HEIGHT, height) };
  const touchDraws = active && finger && !penInUse();
  const touchAction: CSSProperties['touchAction'] = !active ? 'auto' : touchDraws ? 'none' : 'pan-y';
  const px = INK_WIDTH / (surface.current?.getBoundingClientRect().width || 680);
  const hidden = Boolean(picture && ink.hidden);

  return (
    <div
      ref={wrapper}
      tabIndex={-1}
      contentEditable={false}
      data-active={active || undefined}
      aria-label={picture ? 'Marked-up picture' : 'Handwriting'}
      className={cn('ink-block group/ink relative w-full rounded-xl border bg-card outline-none', active && 'border-primary/60 ring-2 ring-primary/20', className)}
    >
      {active && (
        <InkToolbar e={e} className="sticky top-0 z-10 rounded-t-xl border-b bg-card/95 px-2 py-1.5 backdrop-blur">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More handwriting options">
                <EllipsisIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {picture ? (
                <>
                  <DropdownMenuItem onSelect={() => useVault.getState().patch('inks', ink.id, { hidden: !ink.hidden })}>
                    {ink.hidden ? <EyeIcon /> : <EyeOffIcon />} {ink.hidden ? 'Show the Marks' : 'Hide the Marks'}
                  </DropdownMenuItem>
                  {onPlainPicture && (
                    <DropdownMenuItem onSelect={onPlainPicture}>
                      <ImageIcon /> Back to the Plain Picture
                    </DropdownMenuItem>
                  )}
                </>
              ) : (
                <>
                  <DropdownMenuLabel className="label">Paper</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={ink.background} onValueChange={(background) => useVault.getState().patch('inks', ink.id, { background: background as Ink['background'] })}>
                    <DropdownMenuRadioItem value="blank">Blank</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="lined">Lined</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="grid">Grid</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void exportAs('png')}>
                <DownloadIcon /> Export as PNG…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void exportAs('svg')}>
                <DownloadIcon /> Export as SVG…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void exportAs('copy')}>
                <CopyIcon /> Copy as Picture
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!e.strokes.length} onSelect={e.clear}>
                <EraserIcon /> {picture ? 'Clear the Marks' : 'Clear All'}
              </DropdownMenuItem>
              {onDelete && (
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <Trash2Icon /> Delete Block
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" onClick={() => setActive(false)}>
            Done
          </Button>
        </InkToolbar>
      )}
      <div
        ref={surface}
        data-testid="ink-surface"
        className={cn('relative w-full overflow-hidden select-none', !active && 'rounded-xl', active ? (e.settings.tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair') : editable && 'cursor-text')}
        style={{ aspectRatio: `${view.w} / ${view.h}`, touchAction }}
      >
        <svg viewBox={`0 0 ${view.w} ${view.h}`} className="absolute inset-0 size-full overflow-hidden" aria-hidden>
          {picture ? <image href={picture.src} width={view.w} height={view.h} preserveAspectRatio="none" /> : <Paper kind={ink.background} height={view.h} />}
          {!hidden && <InkMarks e={e} px={px} />}
        </svg>
        {!e.strokes.length && !e.live && !picture && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
            <PenLineIcon className="size-4" /> {active ? 'Write or draw here' : editable ? (placeholder ?? 'Handwriting: click or tap to write') : 'Empty handwriting'}
          </span>
        )}
        {picture && !active && (
          <span className="pointer-events-none absolute top-2 right-2 flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground uppercase opacity-0 transition-opacity group-hover/ink:opacity-100">
            <ImageIcon className="size-3" /> {hidden ? 'Marks Hidden' : editable ? 'Click to Mark Up' : 'Marked Up'}
          </span>
        )}
      </div>
      {editable && !picture && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Drag to resize the handwriting"
          title="Drag to resize"
          onPointerDown={resize}
          data-active={active || undefined}
          className="flex h-3 cursor-ns-resize items-center justify-center opacity-0 transition-opacity group-hover/ink:opacity-100 data-[active]:opacity-100"
        >
          <span className="h-1 w-10 rounded-full bg-border" />
        </div>
      )}
    </div>
  );
}

/** Lined or grid paper, every 40 units. */
function Paper({ kind, height }: { kind: Ink['background']; height: number }) {
  if (kind === 'blank') return null;
  const lines: number[] = [];
  for (let y = 48; y < height; y += 40) lines.push(y);
  const columns: number[] = [];
  if (kind === 'grid') for (let x = 40; x < INK_WIDTH; x += 40) columns.push(x);
  return (
    <g stroke="var(--border)" strokeWidth={1}>
      {lines.map((y) => (
        <line key={`y${y}`} x1={0} x2={INK_WIDTH} y1={y} y2={y} vectorEffect="non-scaling-stroke" />
      ))}
      {columns.map((x) => (
        <line key={`x${x}`} x1={x} x2={x} y1={0} y2={height} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
}

/**
 * engine.tsx — writing with a pen, a finger or the mouse, wherever ink goes:
 * a page's Handwriting block, Quick Capture, Today's scratchpad, a picture
 * being marked up, a DevOps diagram. Each place says how a pointer maps to
 * ink coordinates and where the strokes are saved; this does the rest.
 *
 *   useInkEditor   the strokes (with Undo), the tools, and the pointer:
 *                  pen pressure, the pen's eraser end, palm rejection (once a
 *                  pen's been used, fingers are left to scroll), the eraser,
 *                  the lasso (move, resize from the corner, recolor, duplicate,
 *                  delete), and keys (Ctrl+Z, Delete, Ctrl+A, Esc)
 *   InkToolbar     its tools, colors, sizes, Undo / Redo and Draw With Finger
 *   InkMarks       the strokes as SVG (with the stroke being drawn, the lasso and the selection)
 *
 * The page's editor listens on the page above wherever ink sits, before
 * React would: so the pointer is handled with native listeners.
 */
import { CopyPlusIcon, EraserIcon, HandIcon, HighlighterIcon, LassoIcon, PenToolIcon, Redo2Icon, Trash2Icon, Undo2Icon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Hint } from '@/components/shared/Hint';
import { Button } from '@/components/ui/button';
import {
  encodePoints,
  erasePoints,
  eraseStrokes,
  HIGHLIGHTER_SIZES,
  hasPressure,
  inkColor,
  lassoed,
  PEN_SIZES,
  pointsOf,
  strokeBox,
  strokePath,
  transformStrokes,
  unionBox,
  type Box,
  type InkPoint,
} from '@/lib/ink';
import { INK_TONES, newId, type InkColor, type InkStroke } from '@/lib/model';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';

export type InkTool = 'pen' | 'highlighter' | 'eraser' | 'lasso';
export type InkSettings = { tool: InkTool; color: InkColor; highlight: InkColor; pen: number; marker: number; erase: 'stroke' | 'part' };

const SETTINGS_KEY = 'overture.ink';
const DEFAULTS: InkSettings = { tool: 'pen', color: 'ink', highlight: 'yellow', pen: 1, marker: 1, erase: 'stroke' };
function loadSettings(): InkSettings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<InkSettings>) };
  } catch {
    return DEFAULTS;
  }
}

/** Once a pen has been used, fingers scroll instead of drawing (palm rejection). Shared by every ink surface. */
let penSeen = false;
export const penInUse = () => penSeen;

export const INK_COLORS: InkColor[] = ['ink', ...INK_TONES.filter((c) => c !== 'gray'), 'gray'];

/** The eraser's reach, in screen pixels. */
const ERASER_PX = 10;

export type InkEditorOptions = {
  /** The saved strokes (taken up again whenever they change while not writing). */
  strokes: InkStroke[];
  /** Saves the strokes (called a moment after each change, and when writing stops). */
  save: (strokes: InkStroke[]) => void;
  /** Writing (the tools are up); otherwise a click or tap calls onActivate. */
  active: boolean;
  editable: boolean;
  onActivate?: () => void;
  /** Esc with nothing selected. */
  onEscape?: () => void;
  /** The element drawn on (pointer events), and the one taking keys while writing. */
  surface: RefObject<HTMLElement | null>;
  keys?: RefObject<HTMLElement | null>;
  /** A pointer's place in ink coordinates. */
  toInk: (e: PointerEvent, el: HTMLElement) => [number, number];
  /** Ink units per screen pixel (for the eraser's reach and the resize handle). */
  unitsPerPixel: (el: HTMLElement) => number;
  /** After each change (to grow the paper, say). */
  onChange?: (strokes: InkStroke[]) => void;
};

export function useInkEditor(o: InkEditorOptions) {
  const [settings, setSettingsState] = useState<InkSettings>(loadSettings);
  const setSettings = (next: Partial<InkSettings>) =>
    setSettingsState((s) => {
      const merged = { ...s, ...next };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      } catch {
        // storage blocked: the choice holds for now
      }
      return merged;
    });

  const [strokes, setStrokes] = useState<InkStroke[]>(o.strokes);
  useEffect(() => {
    if (!o.active) setStrokes(o.strokes);
  }, [o.strokes, o.active]);
  const latest = useRef(strokes);
  latest.current = strokes;
  const history = useRef<{ undo: InkStroke[][]; redo: InkStroke[][] }>({ undo: [], redo: [] });
  const [, setVersion] = useState(0);

  // Saving: a moment after each change, and when writing stops or the surface goes.
  const saveRef = useRef(o.save);
  saveRef.current = o.save;
  const saved = useRef(o.strokes);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (latest.current !== saved.current) {
      saved.current = latest.current;
      saveRef.current(latest.current);
    }
  };
  useEffect(() => {
    saved.current = o.strokes;
  }, [o.strokes]);
  useEffect(() => () => flush(), []);
  const onChangeRef = useRef(o.onChange);
  onChangeRef.current = o.onChange;

  /** A change to the strokes (with Undo unless it is one). */
  const commit = (next: InkStroke[], undoable = true) => {
    if (undoable) {
      history.current.undo.push(latest.current);
      if (history.current.undo.length > 100) history.current.undo.shift();
      history.current.redo = [];
    }
    latest.current = next;
    setStrokes(next);
    onChangeRef.current?.(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 400);
    setVersion((v) => v + 1);
  };
  const step = (from: 'undo' | 'redo') => {
    const h = history.current;
    const prev = h[from].pop();
    if (!prev) return;
    h[from === 'undo' ? 'redo' : 'undo'].push(latest.current);
    setSelection(new Set());
    commit(prev, false);
  };

  // ── The lasso's selection ────────────────────────────────────────────────
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const selectedBox = useMemo(() => unionBox(strokes.filter((s) => selection.has(s.id)).map(strokeBox)), [strokes, selection]);
  const [preview, setPreviewState] = useState<{ from: Box; to: Box } | null>(null);
  const previewRef = useRef<{ from: Box; to: Box } | null>(null);
  const setPreview = (next: { from: Box; to: Box } | null) => {
    previewRef.current = next;
    setPreviewState(next);
  };
  useEffect(() => {
    if (settings.tool !== 'lasso') setSelection(new Set());
  }, [settings.tool]);
  useEffect(() => {
    if (!o.active) {
      setSelection(new Set());
      flush();
    }
  }, [o.active]);

  const [live, setLive] = useState<{ points: InkPoint[]; pressured: boolean; tool: InkTool } | null>(null);
  const current = useRef({ o, settings, selectedBox, selection });
  current.current = { o, settings, selectedBox, selection };

  // ── The pointer ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = o.surface.current;
    if (!el) return;
    let drag: null | {
      kind: 'draw' | 'erase' | 'lasso' | 'move' | 'scale';
      pointer: number;
      points: InkPoint[];
      pressured: boolean;
      tool: InkTool;
      start?: [number, number];
      before: InkStroke[];
      box?: Box;
    } = null;
    let frame = 0;
    const toInk = (e: PointerEvent): InkPoint => {
      const [x, y] = current.current.o.toInk(e, el);
      return [x, y, e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5];
    };
    const show = () => {
      if (frame || !drag) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (drag && (drag.kind === 'draw' || drag.kind === 'lasso')) setLive({ points: [...drag.points], pressured: drag.pressured, tool: drag.tool });
      });
    };
    const erase = (path: InkPoint[]) => {
      const reach = ERASER_PX * current.current.o.unitsPerPixel(el);
      const trail = path.map(([x, y]) => [x, y] as [number, number]);
      const now = latest.current;
      const next = current.current.settings.erase === 'part' ? erasePoints(now, trail, reach, newId) : eraseStrokes(now, trail, reach);
      if (next.length !== now.length || next.some((s, i) => s !== now[i])) {
        latest.current = next;
        setStrokes(next);
      }
    };
    const down = (e: PointerEvent) => {
      const { o: opts, settings: s, selectedBox: box } = current.current;
      if (!opts.editable) return;
      if (e.pointerType === 'pen') penSeen = true;
      // A finger that isn't drawing is left to scroll.
      if (e.pointerType === 'touch' && (!usePreferences.getState().inkFinger || penSeen)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.stopPropagation();
      if (!opts.active) {
        opts.onActivate?.();
        // A pen writes straight away; a click or a tap only opens it.
        if (e.pointerType !== 'pen') return;
      }
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // a pointer the browser no longer tracks: drawing still works while it's over the surface
      }
      const p = toInk(e);
      const eraserEnd = e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32) !== 0);
      const tool: InkTool = eraserEnd ? 'eraser' : s.tool;
      const base = { pointer: e.pointerId, points: [p], pressured: e.pointerType === 'pen', tool, before: latest.current };
      if (tool === 'lasso' && box) {
        const handle = 12 * opts.unitsPerPixel(el);
        const corner = Math.hypot(p[0] - (box.x + box.w), p[1] - (box.y + box.h)) < handle;
        const inside = p[0] >= box.x && p[0] <= box.x + box.w && p[1] >= box.y && p[1] <= box.y + box.h;
        if (corner || inside) {
          drag = { ...base, kind: corner ? 'scale' : 'move', start: [p[0], p[1]], box };
          return;
        }
        setSelection(new Set());
      }
      drag = { ...base, kind: tool === 'eraser' ? 'erase' : tool === 'lasso' ? 'lasso' : 'draw' };
      if (drag.kind === 'erase') erase([p]);
      show();
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.pointer) return;
      e.stopPropagation();
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      const pts = (events.length ? events : [e]).map(toInk);
      if (drag.kind === 'erase') return erase(pts);
      if (drag.kind === 'move' || drag.kind === 'scale') {
        const p = pts.at(-1)!;
        const b = drag.box!;
        const [dx, dy] = [p[0] - drag.start![0], p[1] - drag.start![1]];
        const k = Math.max(0.1, (b.w + dx) / b.w);
        setPreview({ from: b, to: drag.kind === 'move' ? { ...b, x: b.x + dx, y: b.y + dy } : { ...b, w: b.w * k, h: b.h * k } });
        return;
      }
      drag.points.push(...pts);
      show();
    };
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.pointer) return;
      e.stopPropagation();
      const d = drag;
      drag = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      setLive(null);
      const s = current.current.settings;
      if (d.kind === 'erase') {
        const after = latest.current;
        latest.current = d.before;
        if (after !== d.before) commit(after);
        return;
      }
      if (d.kind === 'lasso')
        return setSelection(
          new Set(
            lassoed(
              latest.current,
              d.points.map(([x, y]) => [x, y]),
            ),
          ),
        );
      if (d.kind === 'move' || d.kind === 'scale') {
        const pv = previewRef.current;
        setPreview(null);
        if (pv) commit(transformStrokes(latest.current, current.current.selection, pv.from, pv.to));
        return;
      }
      const tool = d.tool === 'highlighter' ? 'highlighter' : 'pen';
      // Sizes are in screen pixels: the same on paper as on a zoomed-in diagram.
      const size = (tool === 'highlighter' ? HIGHLIGHTER_SIZES[s.marker]! : PEN_SIZES[s.pen]!) * current.current.o.unitsPerPixel(el);
      const color = tool === 'highlighter' ? s.highlight : s.color;
      // A tap is a dot; pressure from a mouse or a finger isn't real (the outline guesses from speed).
      const points = d.points.length === 1 ? [d.points[0]!, [d.points[0]![0] + 0.1, d.points[0]![1] + 0.1, d.points[0]![2]] as InkPoint] : d.points;
      const stored = d.pressured ? points : points.map(([x, y]) => [x, y, 0.5] as InkPoint);
      commit([...latest.current, { id: newId(), tool, color, size: Math.round(size * 10) / 10, points: encodePoints(stored) }]);
    };
    // Clicks are the surface's own (the editor would otherwise select around it).
    const stop = (e: Event) => {
      if (!current.current.o.editable) return;
      e.stopPropagation();
      if (e.type === 'mousedown') e.preventDefault();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    for (const type of ['mousedown', 'click', 'dragstart', 'dblclick'] as const) el.addEventListener(type, stop);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      for (const type of ['mousedown', 'click', 'dragstart', 'dblclick'] as const) el.removeEventListener(type, stop);
      if (frame) cancelAnimationFrame(frame);
    };
    // Again when it becomes editable: a surface can appear only then (a diagram's drawing overlay).
  }, [o.surface, o.editable]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keys while writing ───────────────────────────────────────────────────
  useEffect(() => {
    const el = o.keys?.current;
    if (!el || !o.active) return;
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      // Keys the page's editor would act on are kept from it; the app's own shortcuts (Alt+8, Ctrl+K…) go through.
      if (['Escape', 'Backspace', 'Delete', 'Enter', 'Tab'].includes(e.key) || (mod && ['z', 'y', 'a', 'c', 'x', 'v', 'b', 'i', 'u'].includes(k))) e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        if (current.current.selection.size) setSelection(new Set());
        else current.current.o.onEscape?.();
      } else if (mod && k === 'z') {
        e.preventDefault();
        step(e.shiftKey ? 'redo' : 'undo');
      } else if (mod && k === 'y') {
        e.preventDefault();
        step('redo');
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && current.current.selection.size) {
        e.preventDefault();
        removeSelected();
      } else if (mod && k === 'a') {
        e.preventDefault();
        setSettings({ tool: 'lasso' });
        setTimeout(() => setSelection(new Set(latest.current.map((s) => s.id))));
      }
    };
    el.addEventListener('keydown', key);
    return () => el.removeEventListener('keydown', key);
  }, [o.active, o.keys]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeSelected = () => {
    commit(latest.current.filter((s) => !current.current.selection.has(s.id)));
    setSelection(new Set());
  };
  const duplicateSelected = () => {
    const shift = 24;
    const copies = latest.current.filter((s) => selection.has(s.id)).map((s) => ({ ...s, id: newId(), points: encodePoints(pointsOf(s).map(([x, y, p]) => [x + shift, y + shift, p] as InkPoint)) }));
    commit([...latest.current, ...copies]);
    setSelection(new Set(copies.map((c) => c.id)));
  };
  const pickColor = (color: InkColor) => {
    if (selection.size) commit(latest.current.map((s) => (selection.has(s.id) ? { ...s, color } : s)));
    else if (settings.tool === 'highlighter') setSettings({ highlight: color });
    else setSettings({ color, tool: settings.tool === 'eraser' || settings.tool === 'lasso' ? 'pen' : settings.tool });
  };

  return {
    settings,
    setSettings,
    strokes,
    /** The strokes as they'd look with the selection being moved. */
    shown: preview ? transformStrokes(strokes, selection, preview.from, preview.to) : strokes,
    selectionBox: preview ? preview.to : selectedBox,
    selection,
    live,
    commit,
    undo: () => step('undo'),
    redo: () => step('redo'),
    canUndo: history.current.undo.length > 0,
    canRedo: history.current.redo.length > 0,
    removeSelected,
    duplicateSelected,
    pickColor,
    flush,
    clear: () => commit([]),
  };
}

export type InkEditor = ReturnType<typeof useInkEditor>;

/** The tools: Pen, Highlighter, Eraser, Lasso, colors, sizes, the selection's actions, Undo, Redo, Draw With Finger; `children` after them. */
export function InkToolbar({ e, children, className }: { e: InkEditor; children?: ReactNode; className?: string }) {
  const finger = usePreferences((s) => s.inkFinger);
  const { settings, setSettings, selection } = e;
  const sizes = settings.tool === 'highlighter' ? HIGHLIGHTER_SIZES : PEN_SIZES;
  const sizeIndex = settings.tool === 'highlighter' ? settings.marker : settings.pen;
  const currentColor = settings.tool === 'highlighter' ? settings.highlight : settings.color;
  const count = selection.size === 1 ? '1 stroke' : `${selection.size} strokes`;
  return (
    <div role="toolbar" aria-label="Handwriting tools" className={cn('flex flex-wrap items-center gap-1', className)}>
      {(
        [
          ['pen', 'Pen', PenToolIcon],
          ['highlighter', 'Highlighter', HighlighterIcon],
          ['eraser', 'Eraser', EraserIcon],
          ['lasso', 'Lasso (select)', LassoIcon],
        ] as const
      ).map(([tool, label, Icon]) => (
        <Hint key={tool} label={label}>
          <Button variant={settings.tool === tool ? 'secondary' : 'ghost'} size="icon-sm" aria-label={label} aria-pressed={settings.tool === tool} onClick={() => setSettings({ tool })}>
            <Icon />
          </Button>
        </Hint>
      ))}
      {settings.tool === 'eraser' && (
        <div className="ml-1 flex rounded-md border p-0.5 text-[11.5px]" role="radiogroup" aria-label="Eraser">
          {(
            [
              ['stroke', 'Whole Strokes'],
              ['part', 'Just What It Touches'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={settings.erase === mode}
              onClick={() => setSettings({ erase: mode })}
              className={cn('rounded px-2 py-0.5', settings.erase === mode ? 'bg-muted font-medium' : 'text-muted-foreground')}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {settings.tool !== 'eraser' && (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          <div role="radiogroup" aria-label="Ink color" className="flex items-center gap-1">
            {INK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-label={c === 'ink' ? 'Ink (follows the theme)' : c}
                aria-checked={!selection.size && currentColor === c}
                onClick={() => e.pickColor(c)}
                className={cn('size-5 rounded-full border-2 border-transparent', !selection.size && currentColor === c && 'ring-2 ring-primary ring-offset-1 ring-offset-card')}
                style={{ background: inkColor(c), opacity: settings.tool === 'highlighter' && c !== 'ink' ? 0.7 : 1 }}
              />
            ))}
          </div>
          {settings.tool !== 'lasso' && (
            <>
              <span aria-hidden className="mx-1 h-5 w-px bg-border" />
              <div role="radiogroup" aria-label="Size" className="flex items-center gap-0.5">
                {sizes.map((size, i) => (
                  <button
                    key={size}
                    type="button"
                    role="radio"
                    aria-label={['Fine', 'Medium', 'Bold'][i]}
                    aria-checked={sizeIndex === i}
                    onClick={() => setSettings(settings.tool === 'highlighter' ? { marker: i } : { pen: i })}
                    className={cn('flex size-7 items-center justify-center rounded-md hover:bg-muted', sizeIndex === i && 'bg-muted')}
                  >
                    <span className="rounded-full bg-foreground" style={{ width: 3 + i * 4, height: 3 + i * 4, opacity: settings.tool === 'highlighter' ? 0.45 : 1 }} />
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {selection.size > 0 && (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          <Hint label={`Duplicate ${selection.size === 1 ? 'the stroke' : `the ${selection.size} strokes`}`}>
            <Button variant="ghost" size="icon-sm" aria-label={`Duplicate selection (${count})`} onClick={e.duplicateSelected}>
              <CopyPlusIcon />
            </Button>
          </Hint>
          <Hint label={`Delete ${selection.size === 1 ? 'the stroke' : `the ${selection.size} strokes`} (Delete)`}>
            <Button variant="ghost" size="icon-sm" aria-label={`Delete selection (${count})`} onClick={e.removeSelected}>
              <Trash2Icon />
            </Button>
          </Hint>
        </>
      )}
      <span className="flex-1" />
      <Hint label="Undo (Ctrl+Z)">
        <Button variant="ghost" size="icon-sm" aria-label="Undo stroke" disabled={!e.canUndo} onClick={e.undo}>
          <Undo2Icon />
        </Button>
      </Hint>
      <Hint label="Redo (Ctrl+Shift+Z)">
        <Button variant="ghost" size="icon-sm" aria-label="Redo stroke" disabled={!e.canRedo} onClick={e.redo}>
          <Redo2Icon />
        </Button>
      </Hint>
      <Hint label={penSeen ? 'A pen is in use: fingers scroll' : finger ? 'Finger draws (click to scroll with it instead)' : 'Finger scrolls (click to draw with it)'}>
        <Button
          variant={finger ? 'secondary' : 'ghost'}
          size="icon-sm"
          aria-label="Draw with finger"
          aria-pressed={finger}
          onClick={() => usePreferences.getState().setPreference('inkFinger', !finger)}
        >
          <HandIcon />
        </Button>
      </Hint>
      {children}
    </div>
  );
}

/** One saved stroke. */
export function StrokePath({ stroke }: { stroke: InkStroke }) {
  const d = useMemo(() => {
    const pts = pointsOf(stroke);
    return strokePath(pts, stroke.tool, stroke.size, hasPressure(pts));
  }, [stroke]);
  return <path d={d} fill={inkColor(stroke.color)} fillOpacity={stroke.tool === 'highlighter' ? 0.35 : 1} />;
}

/** The strokes (highlighters underneath), the one being drawn, the lasso and the selection, as SVG in ink coordinates. `px`: ink units per screen pixel. */
export function InkMarks({ e, strokes, px = 1 }: { e?: InkEditor; strokes?: InkStroke[]; px?: number }) {
  const list = e ? e.shown : strokes;
  const ordered = useMemo(() => [...(list ?? [])].sort((a, b) => Number(b.tool === 'highlighter') - Number(a.tool === 'highlighter')), [list]);
  const live = e?.live;
  const s = e?.settings;
  const box = e?.selectionBox;
  return (
    <g className="ink-marks">
      {ordered.map((stroke) => (
        <StrokePath key={stroke.id} stroke={stroke} />
      ))}
      {live && s && live.tool !== 'lasso' && live.tool !== 'eraser' && (
        <path
          d={strokePath(live.points, live.tool === 'highlighter' ? 'highlighter' : 'pen', (live.tool === 'highlighter' ? HIGHLIGHTER_SIZES[s.marker]! : PEN_SIZES[s.pen]!) * px, live.pressured, false)}
          fill={inkColor(live.tool === 'highlighter' ? s.highlight : s.color)}
          fillOpacity={live.tool === 'highlighter' ? 0.35 : 1}
        />
      )}
      {live?.tool === 'lasso' && (
        <polygon
          points={live.points.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="color-mix(in oklab, var(--primary) 8%, transparent)"
          stroke="var(--primary)"
          strokeWidth={1.5}
          strokeDasharray="6 5"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {box && (
        <g className="ink-selection">
          <rect
            x={box.x - 6 * px}
            y={box.y - 6 * px}
            width={box.w + 12 * px}
            height={box.h + 12 * px}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={box.x + box.w} cy={box.y + box.h} r={7 * px} fill="var(--background)" stroke="var(--primary)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </g>
      )}
    </g>
  );
}

/** The color of a CSS color expression, resolved on the page (for pictures saved outside it). */
export function resolveColor(css: string): string {
  const probe = document.createElement('span');
  probe.style.color = css;
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

/**
 * A surface's ref that says when the element appears (as a new ref object):
 * for one that isn't there on the first render (in a dialog's portal), so
 * the pointer listeners attach once it is. Pass `[0]` as `surface`, `[1]` as the element's ref.
 */
export function useSurfaceRef<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const ref = useMemo(() => ({ current: el }), [el]);
  return [ref, setEl] as const;
}

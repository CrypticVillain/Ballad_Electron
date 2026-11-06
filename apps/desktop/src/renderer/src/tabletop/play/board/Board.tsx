import { HandIcon, MaximizeIcon, MinusIcon, PlusIcon, RulerIcon, SquareDashedIcon, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { toast } from 'sonner';
import { Hint } from '@/components/shared/Hint';
import { mediaSrc } from '@/components/shared/Portrait';
import { cn } from '@/lib/utils';
import { updateGrid } from '../actions';
import { formatDistance, gridPath, lineUp, measure, snap, type Point } from '../geometry/grid';
import type { PlayScene } from '../model';
import { usePlayUi, type PlayTool } from '../ui';

/**
 * Tabletop → Play: the board. The scene's picture with its grid over it, in
 * a camera you pan (drag, middle button, or Space + drag with any tool) and
 * zoom (the wheel, around the pointer; 0 fits it). Tools (V, R, G):
 *
 *   Select   drag to pan
 *   Ruler    drag to measure, in squares and feet, snapped to squares when
 *            the grid snaps; Space drops a waypoint; the line stays until
 *            you measure again or press Esc
 *   Line Up  drag a box over one square of the map: the grid takes its size
 *            and lines up with it
 *
 * Measuring and boxes are drawn on top in screen space, so their lines and
 * labels stay one size at any zoom.
 */

type Camera = { x: number; y: number; zoom: number };

/** Where each scene's camera was, for this session: coming back to a scene keeps your view. */
const cameras = new Map<string, Camera>();

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

function fit(scene: PlayScene, w: number, h: number): Camera {
  const zoom = clampZoom(Math.min(w / scene.width, h / scene.height) * 0.92);
  return { zoom, x: (w - scene.width * zoom) / 2, y: (h - scene.height * zoom) / 2 };
}

/** Keys go to the board unless you're typing somewhere. */
const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

type Drag = { kind: 'pan'; from: Point; camera: Camera } | { kind: 'ruler' } | { kind: 'lineup' };
type Ruler = { points: Point[]; end: Point; done: boolean };

export function Board({ scene }: { scene: PlayScene }) {
  const ref = useRef<HTMLDivElement>(null);
  const tool = usePlayUi((s) => s.tool);
  const setTool = usePlayUi((s) => s.setTool);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [camera, setCamera] = useState<Camera | null>(() => cameras.get(scene.id) ?? null);
  const [ruler, setRuler] = useState<Ruler | null>(null);
  const [box, setBox] = useState<{ from: Point; to: Point } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const drag = useRef<Drag | null>(null);
  const grid = scene.grid;

  // The board's size, and the first view: the whole scene.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    observer.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!camera && size.w && size.h) setCamera(fit(scene, size.w, size.h));
  }, [camera, size, scene]);
  useEffect(() => {
    if (camera) cameras.set(scene.id, camera);
  }, [camera, scene.id]);

  const toWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = ref.current!.getBoundingClientRect();
      const c = camera ?? { x: 0, y: 0, zoom: 1 };
      return { x: (clientX - rect.left - c.x) / c.zoom, y: (clientY - rect.top - c.y) / c.zoom };
    },
    [camera],
  );
  const toScreen = (p: Point): Point => (camera ? { x: p.x * camera.zoom + camera.x, y: p.y * camera.zoom + camera.y } : p);
  const snapped = (p: Point) => (grid.snap ? snap(grid, p) : p);

  /** Zooms by a factor around a point on the board (its middle by default). */
  const zoomBy = useCallback(
    (factor: number, at?: Point) => {
      setCamera((c) => {
        if (!c) return c;
        const zoom = clampZoom(c.zoom * factor);
        const p = at ?? { x: size.w / 2, y: size.h / 2 };
        const k = zoom / c.zoom;
        return { zoom, x: p.x - (p.x - c.x) * k, y: p.y - (p.y - c.y) * k };
      });
    },
    [size],
  );

  // The wheel zooms around the pointer (a native listener: React's wheel events can't stop the page scrolling).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomBy(Math.exp(-e.deltaY * 0.0015), { x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  // Keys: the tools, zoom, Space (pan, or a waypoint while measuring), Esc.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === ' ') {
        e.preventDefault();
        if (drag.current?.kind === 'ruler') setRuler((r) => (r ? { ...r, points: [...r.points, r.end] } : r));
        else setSpaceHeld(true);
      } else if (key === 'v') setTool('select');
      else if (key === 'r') setTool('ruler');
      else if (key === 'g') setTool('lineup');
      else if (key === '0') setCamera(fit(scene, size.w, size.h));
      else if (key === '=' || key === '+') zoomBy(1.25);
      else if (key === '-') zoomBy(0.8);
      else if (key === 'escape') {
        setRuler(null);
        setBox(null);
        drag.current = null;
        setTool('select');
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ') setSpaceHeld(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [scene, size, setTool, zoomBy]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!camera || (e.button !== 0 && e.button !== 1)) return;
    ref.current?.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toWorld(e.clientX, e.clientY);
    if (e.button === 1 || spaceHeld || tool === 'select') {
      drag.current = { kind: 'pan', from: { x: e.clientX, y: e.clientY }, camera };
      setPanning(true);
    } else if (tool === 'ruler') {
      const start = snapped(p);
      drag.current = { kind: 'ruler' };
      setRuler({ points: [start], end: start, done: false });
    } else if (tool === 'lineup') {
      drag.current = { kind: 'lineup' };
      setBox({ from: p, to: p });
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'pan') setCamera({ ...d.camera, x: d.camera.x + e.clientX - d.from.x, y: d.camera.y + e.clientY - d.from.y });
    else if (d.kind === 'ruler') {
      const end = snapped(toWorld(e.clientX, e.clientY));
      setRuler((r) => (r ? { ...r, end } : r));
    } else setBox((b) => (b ? { ...b, to: toWorld(e.clientX, e.clientY) } : b));
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setPanning(false);
    if (d?.kind === 'ruler') setRuler((r) => (r ? { ...r, done: true } : r));
    if (d?.kind === 'lineup' && box) {
      const fitted = lineUp(grid.kind, { x: box.from.x, y: box.from.y, w: box.to.x - box.from.x, h: box.to.y - box.from.y });
      setBox(null);
      if (!fitted) return toast('Drag a bigger box', { description: `Over one whole ${grid.kind === 'square' ? 'square' : 'hex'} of the map.` });
      updateGrid(scene.id, fitted);
      setTool('select');
      toast('Grid Lined Up', { description: `${grid.kind === 'square' ? 'Squares' : 'Hexes'} of ${Math.round(fitted.size * 10) / 10} px. Fine-tune it in the scene’s settings.` });
    }
  };

  const path = useMemo(() => (grid.show ? gridPath(grid, scene.width, scene.height) : null), [grid, scene.width, scene.height]);
  const route = ruler ? [...ruler.points, ruler.end] : [];
  const measured = ruler ? measure(grid, route) : null;
  const unitName = grid.kind === 'square' ? 'square' : 'hex';
  const cursor = panning ? 'grabbing' : spaceHeld || tool === 'select' ? 'grab' : 'crosshair';

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="application"
      aria-label={`${scene.name || 'Scene'}: the board`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ cursor }}
      className="relative min-w-0 flex-1 touch-none overflow-hidden bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] [background-size:24px_24px] outline-none select-none"
    >
      {camera && (
        <div className="absolute top-0 left-0 origin-top-left" style={{ width: scene.width, height: scene.height, transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
          <div className="absolute inset-0 shadow-[0_0_0_1px_rgb(0_0_0/0.25),0_12px_40px_rgb(0_0_0/0.35)]" style={{ background: scene.background }} />
          {scene.image && <img src={mediaSrc(scene.image)} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full max-w-none" />}
          {path && (
            <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={scene.width} height={scene.height} viewBox={`0 0 ${scene.width} ${scene.height}`}>
              <path d={path} fill="none" stroke={grid.color} strokeOpacity={grid.opacity} strokeWidth={1} vectorEffect="non-scaling-stroke" shapeRendering="crispEdges" />
            </svg>
          )}
        </div>
      )}

      {/* What you measure and the box you line up with: in screen space, one size at any zoom. */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible">
        {ruler && route.length > 1 && (
          <>
            <polyline points={route.map((p) => toScreen(p)).map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="black" strokeOpacity={0.45} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={route.map((p) => toScreen(p)).map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--primary)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="10 6" />
          </>
        )}
        {ruler &&
          route.map((p, i) => {
            const s = toScreen(p);
            return <circle key={i} cx={s.x} cy={s.y} r={i === 0 || i === route.length - 1 ? 5 : 4} fill={i === route.length - 1 ? 'var(--primary)' : 'white'} stroke="var(--primary)" strokeWidth={2} />;
          })}
        {box && (
          <rect
            x={Math.min(toScreen(box.from).x, toScreen(box.to).x)}
            y={Math.min(toScreen(box.from).y, toScreen(box.to).y)}
            width={Math.abs(toScreen(box.to).x - toScreen(box.from).x)}
            height={Math.abs(toScreen(box.to).y - toScreen(box.from).y)}
            fill="var(--primary)"
            fillOpacity={0.15}
            stroke="var(--primary)"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        )}
      </svg>
      {ruler && measured && route.length > 1 && (
        <div role="status" aria-label="Distance" className="pointer-events-none absolute flex flex-col rounded-lg bg-foreground px-2.5 py-1 text-background shadow-lg" style={{ left: toScreen(ruler.end).x + 14, top: toScreen(ruler.end).y - 40 }}>
          <span className="font-mono text-[15px] leading-tight font-bold">{formatDistance(grid, measured)}</span>
          <span className="font-mono text-[10.5px] leading-tight opacity-70">
            {measured.cells} {measured.cells === 1 ? unitName : `${unitName}s`}
            {ruler.points.length > 1 ? ` · ${ruler.points.length - 1} ${ruler.points.length === 2 ? 'waypoint' : 'waypoints'}` : ''}
          </span>
        </div>
      )}

      <Toolbar tool={tool} setTool={setTool} zoom={camera?.zoom ?? 1} onZoom={zoomBy} onFit={() => setCamera(fit(scene, size.w, size.h))} />
      <ToolHint tool={tool} measuring={Boolean(ruler && !ruler.done)} cell={unitName} />
    </div>
  );
}

const TOOLS: { tool: PlayTool; label: string; key: string; icon: LucideIcon }[] = [
  { tool: 'select', label: 'Select', key: 'V', icon: HandIcon },
  { tool: 'ruler', label: 'Ruler', key: 'R', icon: RulerIcon },
  { tool: 'lineup', label: 'Line Up Grid', key: 'G', icon: SquareDashedIcon },
];

function Toolbar({ tool, setTool, zoom, onZoom, onFit }: { tool: PlayTool; setTool: (t: PlayTool) => void; zoom: number; onZoom: (factor: number) => void; onFit: () => void }) {
  const stop = (e: ReactPointerEvent) => e.stopPropagation();
  return (
    <div onPointerDown={stop} className="absolute top-3 left-3 flex items-center gap-1 rounded-xl border bg-background/95 p-1 shadow-md backdrop-blur">
      <div role="toolbar" aria-label="Tools" className="flex gap-0.5">
        {TOOLS.map((t) => (
          <Hint key={t.tool} label={`${t.label} (${t.key})`}>
            <button
              type="button"
              aria-label={t.label}
              aria-pressed={tool === t.tool}
              onClick={() => setTool(t.tool)}
              className={cn('flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground', tool === t.tool && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground')}
            >
              <t.icon className="size-4" />
            </button>
          </Hint>
        ))}
      </div>
      <span className="mx-1 h-5 w-px bg-border" />
      <Hint label="Zoom Out (−)">
        <button type="button" aria-label="Zoom Out" onClick={() => onZoom(0.8)} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
          <MinusIcon className="size-4" />
        </button>
      </Hint>
      <span aria-label="Zoom" className="w-12 text-center font-mono text-[11px] text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <Hint label="Zoom In (+)">
        <button type="button" aria-label="Zoom In" onClick={() => onZoom(1.25)} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
          <PlusIcon className="size-4" />
        </button>
      </Hint>
      <Hint label="Fit The Scene (0)">
        <button type="button" aria-label="Fit The Scene" onClick={onFit} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
          <MaximizeIcon className="size-4" />
        </button>
      </Hint>
    </div>
  );
}

function ToolHint({ tool, measuring, cell }: { tool: PlayTool; measuring: boolean; cell: string }) {
  const text =
    tool === 'ruler'
      ? measuring
        ? 'Space drops a waypoint · let go to finish'
        : 'Drag to measure · Space drops a waypoint · Esc clears'
      : tool === 'lineup'
        ? `Drag a box over one ${cell} of the map, ${cell === 'square' ? 'corner to corner' : 'flat side to flat side'}`
        : 'Drag to move around · scroll to zoom · Space + drag pans with any tool';
  return <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-3 py-1 text-[12px] text-muted-foreground shadow-sm backdrop-blur">{text}</div>;
}

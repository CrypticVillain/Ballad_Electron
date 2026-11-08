import { BrickWallIcon, CircleIcon, CloudFogIcon, ScanEyeIcon, Undo2Icon, ConeIcon, Trash2Icon, MoveRightIcon, ShapesIcon, EyeIcon, EyeOffIcon, HandIcon, PaintbrushIcon, MaximizeIcon, MinusIcon, PenLineIcon, PlusIcon, RotateCcwIcon, RotateCwIcon, RulerIcon, SquareDashedIcon, SquareIcon, SplineIcon, UserRoundPlusIcon, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { templateOutline, templateSize } from '@/play/table/logic';
import type { BoardTemplate, TemplateShape } from '@/play/table/model';
import { toast } from 'sonner';
import { penInUse } from '@/components/ink/engine';
import { Hint } from '@/components/shared/Hint';
import { mediaSrc } from '@/components/shared/Portrait';
import type { Encounter } from '@/lib/model';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import { addFogOp, fogged, rectPoints } from '../geometry/fog';
import { formatDistance, gridPath, lineUp, measure, snap, type Point } from '../geometry/grid';
import { freeSpot, inBox, nudge, sizeFromKind, snapToken } from '../geometry/tokens';
import { MarkSheet, MarkTools, useMarking, type MarkTarget } from '../marks/MarkLayer';
import { defaultFog, type BattleMap, type Fog, type FogOp } from '../model';
import { addToken, moveTokens, placeCombatants, removeTokens, sourceOf, TOKEN_MIME, updateToken, type TokenSource } from '../tokens/actions';
import { canMove, type BoardAccess, type TokenView } from '../tokens/resolve';
import { useBoardUi, type BoardTool } from '../ui';
import { FogLayer } from './FogLayer';
import { VisionLayer } from './VisionLayer';
import { sees, type LightSource, type Viewer, type Wall } from '../geometry/vision';
import { newId } from '@/lib/model';
import { TokenLayer } from './TokenLayer';
import { TokenTray } from './TokenTray';

/**
 * Tabletop → Battle maps: the board, for an encounter's prepared map
 * (Tabletop) and a scene (Play). The map's picture and grid, its tokens and
 * its fog, in a camera you pan (drag the map, middle button, or Space + drag
 * with any tool), zoom (the wheel, around the pointer; 0 fits it) and turn a
 * quarter at a time (Q, E: your view only).
 *
 * The GM (the campaign's owner) has every tool: pick and move any token,
 * measure, line the grid up (G), fog of war (F: reveal or hide, a box, a
 * shape drawn point by point (double-click or Enter closes it) or a brush to
 * paint with), and the Add Tokens tray (T). Anyone else (online: a player) can pan, zoom, turn and
 * measure, and pick and move only the tokens assigned to them; they don't
 * see hidden tokens or what's under the fog (fog is solid for them).
 *
 * Keys with tokens picked: arrows nudge a square, Delete takes them off and
 * H hides or shows them (the GM's). Measuring, moving and the boxes you draw
 * are on top in screen space, so their lines and labels stay one size.
 *
 * `marks` (Play): the board can be marked up (P): drawn on with a pen, a
 * highlighter, the eraser and the lasso, everyone's marks shown over the map
 * (marks/). The GM can mark up any scene; Play gives a player the scene the
 * table sees.
 */

/** What the board shows and changes: a battle map with its id (a scene's or an encounter's), campaign and name. */
export type BoardMap = BattleMap & { id: string; worldId: string; name: string };

/**
 * Play's table on the board (play/table): whose turn it is (a ring on their
 * token), pings (Alt + click: everyone sees it a moment), spells' areas
 * (the Areas tool, A: drag from where it starts), and what sits over the
 * board's corner (the turn order).
 */
export type BoardTable = {
  activeTokenId?: string;
  pings: { id: string; x: number; y: number; color: string; who: string }[];
  onPing: (p: Point) => void;
  templates: BoardTemplate[];
  color: string;
  onTemplate: (t: { shape: TemplateShape; x: number; y: number; angle: number; length: number }) => void;
  /** Clears the templates this viewer may (the GM all, a player their own). */
  onClearTemplates: () => void;
  overlay?: ReactNode;
};

type Camera = { x: number; y: number; zoom: number; rotation: number };

/** Where each map's camera was, for this session: coming back keeps your view. */
const cameras = new Map<string, Camera>();

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** The whole map in view, in the middle, turned as it is. */
function fit(map: BattleMap, w: number, h: number, rotation = 0): Camera {
  const sideways = rotation % 180 !== 0;
  const [mw, mh] = sideways ? [map.height, map.width] : [map.width, map.height];
  const zoom = clampZoom(Math.min(w / mw, h / mh) * 0.92);
  return { zoom, rotation, x: w / 2 - map.width / 2, y: h / 2 - map.height / 2 };
}

/** Keys go to the board unless you're typing somewhere. */
const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

type Drag =
  | { kind: 'pan'; from: Point; camera: Camera; moved: boolean }
  | { kind: 'ruler' }
  | { kind: 'box'; purpose: 'lineup' | 'fog' }
  | { kind: 'brush' }
  | { kind: 'tokens'; start: Point; origins: Map<string, Point>; primary: string }
  | { kind: 'marquee'; add: boolean }
  | { kind: 'template'; from: Point };
type Ruler = { points: Point[]; end: Point; done: boolean };

const ARROWS: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };

export function Board({ board, views, access, onMapChange, encounter, marks, table }: { board: BoardMap; views: TokenView[]; access: BoardAccess; onMapChange: (changes: Partial<BattleMap>) => void; encounter?: Encounter; marks?: MarkTarget; table?: BoardTable }) {
  const ref = useRef<HTMLDivElement>(null);
  const gm = access.gm;
  const tool = useBoardUi((s) => s.tool);
  const setTool = useBoardUi((s) => s.setTool);
  const fogMode = useBoardUi((s) => s.fogMode);
  const setFogMode = useBoardUi((s) => s.setFogMode);
  const fogShape = useBoardUi((s) => s.fogShape);
  const setFogShape = useBoardUi((s) => s.setFogShape);
  const brush = useBoardUi((s) => s.brush);
  const setBrush = useBoardUi((s) => s.setBrush);
  const selectedIds = useBoardUi((s) => s.selected);
  const setSelected = useBoardUi((s) => s.setSelected);
  const tray = useBoardUi((s) => s.tray);
  const setTray = useBoardUi((s) => s.setTray);
  const templateShape = useBoardUi((s) => s.templateShape);
  const setTemplateShape = useBoardUi((s) => s.setTemplateShape);
  const [draft, setDraft] = useState<{ from: Point; to: Point } | null>(null);
  // A wall being drawn, corner by corner, and where the pointer is.
  const [wallDraft, setWallDraft] = useState<{ points: Point[]; hover: Point | null } | null>(null);
  const playersView = useBoardUi((s) => s.playersView);
  const setPlayersView = useBoardUi((s) => s.setPlayersView);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [camera, setCamera] = useState<Camera | null>(() => cameras.get(board.id) ?? null);
  const [ruler, setRuler] = useState<Ruler | null>(null);
  const [box, setBox] = useState<{ from: Point; to: Point } | null>(null);
  const [poly, setPoly] = useState<{ points: Point[]; hover: Point | null } | null>(null);
  // The fog brush: the stroke being painted, and where it is (its outline follows the pointer).
  const [stroke, setStroke] = useState<Point[] | null>(null);
  const [brushAt, setBrushAt] = useState<Point | null>(null);
  const [marquee, setMarquee] = useState<{ from: Point; to: Point } | null>(null);
  const [moving, setMoving] = useState<Map<string, Point>>(new Map());
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const drag = useRef<Drag | null>(null);
  const grid = board.grid;
  const fog = board.fog ?? defaultFog();
  /** The brush's reach either side of its path, on the map: half its width in squares. */
  const brushRadius = (brush * grid.size) / 2;
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const byId = useMemo(() => new Map(views.map((v) => [v.token.id, v])), [views]);
  // Players: a GM's own tool isn't theirs; marking is only where there's something to mark.
  const activeTool: BoardTool = (!gm && (tool === 'lineup' || tool === 'fog' || tool === 'walls')) || (tool === 'mark' && !marks) || (tool === 'template' && !table) ? 'select' : tool;
  const marking = activeTool === 'mark';
  const finger = usePreferences((s) => s.inkFinger);
  const overlay = useRef<HTMLDivElement>(null);
  /** Mark units (1000 across the map) per map pixel. */
  const unit = 1000 / Math.max(1, board.width);

  // Line of sight (on, for the players, or the GM looking as they do): who sees (a player's tokens; the GM's preview, the party's), and the lights.
  const walls = useMemo(() => board.walls ?? [], [board.walls]);
  const sight = board.vision?.enabled && (!gm || playersView) ? board.vision : null;
  const feet = (ft: number) => (ft / Math.max(1, grid.distance)) * grid.size;
  const viewers: Viewer[] = useMemo(
    () => (sight ? views.filter((v) => (gm ? v.token.kind === 'pc' : canMove(access, v))).map((v) => ({ x: v.token.x, y: v.token.y, darkvision: feet(v.token.darkvision ?? 0) })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sight, views, gm, access, grid.distance, grid.size],
  );
  const lights: LightSource[] = useMemo(
    () => (sight ? views.filter((v) => v.token.light && !v.token.hidden).map((v) => ({ x: v.token.x, y: v.token.y, reach: feet(v.token.light!.bright + v.token.light!.dim) })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sight, views, grid.distance, grid.size],
  );
  const inSight = (v: TokenView) => !sight || sees(v.token, viewers, lights, walls, sight.lighting);

  // What this viewer sees: the GM everything; a player no hidden tokens, none under the fog and none out of sight, but their own.
  const shown = useMemo(
    () => (gm && !sight ? views : views.filter((v) => canMove(access, v) || (!v.token.hidden && !fogged(fog, v.token) && inSight(v)))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gm, sight, views, access, fog, viewers, lights, walls],
  );
  const below = gm ? shown : shown.filter((v) => !canMove(access, v));
  const above = gm ? [] : shown.filter((v) => canMove(access, v));

  // The board's size, and the first view: the whole map.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    observer.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!camera && size.w && size.h) setCamera(fit(board, size.w, size.h));
  }, [camera, size, board]);
  useEffect(() => {
    if (camera) cameras.set(board.id, camera);
  }, [camera, board.id]);

  const center = useMemo(() => ({ x: board.width / 2, y: board.height / 2 }), [board.width, board.height]);
  const zoomNow = camera?.zoom ?? 1;
  const turn = (p: Point, degrees: number): Point => {
    const r = (degrees * Math.PI) / 180;
    return { x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) };
  };
  const toWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = ref.current!.getBoundingClientRect();
      const c = camera ?? { x: 0, y: 0, zoom: 1, rotation: 0 };
      const q = { x: (clientX - rect.left - c.x - center.x) / c.zoom, y: (clientY - rect.top - c.y - center.y) / c.zoom };
      const p = turn(q, -c.rotation);
      return { x: p.x + center.x, y: p.y + center.y };
    },
    [camera, center],
  );
  const toScreen = (p: Point): Point => {
    if (!camera) return p;
    const q = turn({ x: p.x - center.x, y: p.y - center.y }, camera.rotation);
    return { x: center.x + camera.x + q.x * camera.zoom, y: center.y + camera.y + q.y * camera.zoom };
  };
  const ink = useMarking({
    target: marks ?? null,
    access,
    active: marking,
    surface: overlay,
    toUnits: (ev) => {
      const p = toWorld(ev.clientX, ev.clientY);
      return [p.x * unit, p.y * unit];
    },
    unitsPerPixel: () => unit / zoomNow,
    onDone: () => setTool('select'),
  });
  // Marking: the overlay takes the keys (Ctrl+Z, Delete, Esc).
  useEffect(() => {
    if (marking) overlay.current?.focus({ preventScroll: true });
  }, [marking]);
  const snapped = (p: Point) => (grid.snap ? snap(grid, p) : p);
  /** The middle of what you can see, on the map. */
  const viewCenter = (): Point => (camera && ref.current ? toWorld(ref.current.getBoundingClientRect().left + size.w / 2, ref.current.getBoundingClientRect().top + size.h / 2) : center);

  /** Zooms by a factor around a point on the board (its middle by default), keeping what's under it there. */
  const zoomBy = useCallback(
    (factor: number, at?: Point) => {
      setCamera((c) => {
        if (!c) return c;
        const zoom = clampZoom(c.zoom * factor);
        const p = at ?? { x: size.w / 2, y: size.h / 2 };
        const k = zoom / c.zoom;
        const ax = center.x + c.x;
        const ay = center.y + c.y;
        return { ...c, zoom, x: p.x - k * (p.x - ax) - center.x, y: p.y - k * (p.y - ay) - center.y };
      });
    },
    [size, center],
  );
  /** Turns your view a quarter (it turns about the map's middle, which stays put). */
  const rotate = useCallback((by: number) => setCamera((c) => (c ? { ...c, rotation: (((c.rotation + by) % 360) + 360) % 360 } : c)), []);

  const setFog = (next: Fog) => onMapChange({ fog: next });
  const addFog = (op: FogOp) => {
    const base = fog.enabled ? fog : { ...fog, enabled: true };
    if (!fog.enabled) toast('Fog Of War Is On', { description: 'Everything else is covered for the players. Reveal what they can see.' });
    setFog(addFogOp(base, op));
  };
  /** A wall's corner: on the grid's corners (squares, snapping on), else where you clicked. */
  const corner = (p: Point): Point => (grid.snap && grid.kind === 'square' ? { x: grid.offsetX + Math.round((p.x - grid.offsetX) / grid.size) * grid.size, y: grid.offsetY + Math.round((p.y - grid.offsetY) / grid.size) * grid.size } : p);
  const finishWall = () => {
    // A double-click's two clicks land on one corner: once is enough.
    const points = (wallDraft?.points ?? []).filter((p, i, all) => i === 0 || p.x !== all[i - 1]!.x || p.y !== all[i - 1]!.y);
    if (points.length >= 2) onMapChange({ walls: [...walls, { id: newId(), points }] as Wall[] });
    setWallDraft(null);
  };
  const closePoly = () => {
    if (poly && poly.points.length >= 3) addFog({ mode: fogMode, shape: 'poly', points: poly.points });
    setPoly(null);
  };

  /** Puts a token on the board and picks it: where it was dropped, or (`clear`) the nearest square nothing covers. */
  const place = (source: TokenSource, at: Point, clear = false) => {
    const size = source.kind === 'monster' ? sizeFromKind(source.monster.kind) : 'medium';
    const spot = clear ? freeSpot(grid, at, size, views.map((v) => ({ x: v.token.x, y: v.token.y, size: v.token.size }))) : at;
    const { token, existing } = addToken(board, source, spot);
    setSelected([token.id]);
    if (existing) toast('Already On The Map', { description: `${token.name} is here once; it’s picked for you.` });
  };
  const placeEncounter = (e: Encounter, onlyMissing = false) => {
    const onMap = new Set(views.map((v) => v.token.combatantId).filter(Boolean));
    const placed = placeCombatants(board, e, viewCenter(), onlyMissing ? (c) => !onMap.has(c.id) : undefined);
    setSelected(placed.map((t) => t.id));
    if (!placed.length) toast('Everyone’s Already On The Map');
  };

  // The wheel zooms around the pointer (a native listener: React's wheel events can't stop the page scrolling).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('[data-tray]')) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomBy(Math.exp(-e.deltaY * 0.0015), { x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  // Keys: the tools, the tray, zoom and turning, Space (pan, or a waypoint while measuring), the picked tokens, Esc.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const picked = selectedIds
        .map((id) => byId.get(id))
        .filter((v) => v !== undefined && canMove(access, v))
        .map((v) => v!.token);
      if (key === ' ') {
        e.preventDefault();
        if (drag.current?.kind === 'ruler') setRuler((r) => (r ? { ...r, points: [...r.points, r.end] } : r));
        else setSpaceHeld(true);
      } else if (key in ARROWS && picked.length) {
        e.preventDefault();
        const [dx, dy] = ARROWS[key]!;
        moveTokens(picked.map((t) => ({ id: t.id, ...nudge(grid, t, dx, dy) })));
      } else if (gm && (key === 'delete' || key === 'backspace') && picked.length) {
        e.preventDefault();
        const undo = removeTokens(picked.map((t) => t.id));
        setSelected([]);
        toast(picked.length === 1 ? 'Token Removed' : `${picked.length} Tokens Removed`, { description: picked.length === 1 ? byId.get(picked[0]!.id)?.name : undefined, action: { label: 'Undo', onClick: undo } });
      } else if (gm && key === 'h' && picked.length) {
        const hide = picked.some((t) => !t.hidden);
        for (const t of picked) updateToken(t.id, { hidden: hide });
      } else if (key === 'enter' && poly) {
        e.preventDefault();
        closePoly();
      } else if (key === 'enter' && wallDraft) {
        e.preventDefault();
        finishWall();
      } else if (key === 'v') setTool('select');
      else if (key === 'r') setTool('ruler');
      else if (gm && key === 'g') setTool('lineup');
      else if (gm && key === 'f') setTool('fog');
      else if (gm && key === 't') setTray(!tray);
      else if (marks && key === 'p') setTool('mark');
      else if (table && key === 'a') setTool('template');
      else if (gm && key === 'w') setTool('walls');
      else if (key === 'q') rotate(-90);
      else if (key === 'e') rotate(90);
      else if (key === '0') setCamera(fit(board, size.w, size.h, camera?.rotation ?? 0));
      else if (key === '=' || key === '+') zoomBy(1.25);
      else if (key === '-') zoomBy(0.8);
      else if (key === 'escape') {
        setRuler(null);
        setBox(null);
        setPoly(null);
        setMarquee(null);
        setDraft(null);
        setWallDraft(null);
        drag.current = null;
        setTool('select');
        setSelected([]);
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
  });

  /** A token pressed: picked (Shift: added or taken away), and dragged with the rest. Another tool, or a token that isn't yours: the board handles it. */
  const onTokenPointerDown = (e: ReactPointerEvent, id: string) => {
    const view = byId.get(id);
    // Alt (a ping) goes through to the board.
    if (e.button !== 0 || e.altKey || activeTool !== 'select' || spaceHeld || !camera || !view || !canMove(access, view)) return;
    e.stopPropagation();
    ref.current?.focus();
    ref.current?.setPointerCapture(e.pointerId);
    let ids: string[];
    if (e.shiftKey) ids = selected.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    else ids = selected.has(id) ? selectedIds : [id];
    setSelected(ids);
    if (!ids.includes(id)) return;
    const origins = new Map(
      ids
        .map((x) => byId.get(x))
        .filter((v) => v !== undefined && canMove(access, v))
        .map((v) => [v!.token.id, { x: v!.token.x, y: v!.token.y }]),
    );
    drag.current = { kind: 'tokens', start: toWorld(e.clientX, e.clientY), origins, primary: id };
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!camera || (e.button !== 0 && e.button !== 1)) return;
    if ((e.target as HTMLElement).closest('[data-tray], [data-toolbar]')) return;
    // Marking: the ink takes the pointer (the middle button still pans).
    if (marking && e.button === 0) return;
    ref.current?.focus();
    const p = toWorld(e.clientX, e.clientY);
    // Alt + click: a ping, for everyone at the table.
    if (table && e.button === 0 && e.altKey) return table.onPing(p);
    if (gm && e.button === 0 && activeTool === 'walls' && !spaceHeld) {
      // A wall, corner by corner; a double-click (or Enter) ends it.
      const c = corner(p);
      setWallDraft((w) => ({ points: [...(w?.points ?? []), c], hover: c }));
      return;
    }
    if (table && e.button === 0 && activeTool === 'template' && !spaceHeld) {
      e.currentTarget.setPointerCapture(e.pointerId);
      const from = grid.snap ? snap(grid, p) : p;
      drag.current = { kind: 'template', from };
      setDraft({ from, to: from });
      return;
    }
    if (e.button === 0 && activeTool === 'fog' && fogShape === 'brush' && !spaceHeld) {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { kind: 'brush' };
      setStroke([p]);
      return;
    }
    if (e.button === 0 && activeTool === 'fog' && fogShape === 'poly' && !spaceHeld) {
      // A shape, point by point; a double-click (or Enter) closes it.
      if (e.detail >= 2) return closePoly();
      setPoly((s) => ({ points: [...(s?.points ?? []), p], hover: p }));
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    if (e.button === 0 && activeTool === 'select' && e.shiftKey && !spaceHeld) {
      drag.current = { kind: 'marquee', add: true };
      setMarquee({ from: p, to: p });
    } else if (e.button === 1 || spaceHeld || activeTool === 'select') {
      drag.current = { kind: 'pan', from: { x: e.clientX, y: e.clientY }, camera, moved: false };
      setPanning(true);
    } else if (activeTool === 'ruler') {
      const start = snapped(p);
      drag.current = { kind: 'ruler' };
      setRuler({ points: [start], end: start, done: false });
    } else if (activeTool === 'lineup' || activeTool === 'fog') {
      drag.current = { kind: 'box', purpose: activeTool === 'fog' ? 'fog' : 'lineup' };
      setBox({ from: p, to: p });
    }
  };

  /** Where dragged tokens would land: the pressed one snapped, the others kept with it. */
  const landing = (d: Extract<Drag, { kind: 'tokens' }>, p: Point): Map<string, Point> => {
    const origin = d.origins.get(d.primary)!;
    const raw = { x: origin.x + p.x - d.start.x, y: origin.y + p.y - d.start.y };
    const token = byId.get(d.primary)?.token;
    const target = grid.snap && token ? snapToken(grid, raw, token.size) : raw;
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    return new Map([...d.origins].map(([id, o]) => [id, { x: o.x + dx, y: o.y + dy }]));
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (poly) setPoly((s) => (s ? { ...s, hover: toWorld(e.clientX, e.clientY) } : s));
    if (wallDraft) setWallDraft((w) => (w ? { ...w, hover: corner(toWorld(e.clientX, e.clientY)) } : w));
    if (activeTool === 'fog' && fogShape === 'brush') setBrushAt(toWorld(e.clientX, e.clientY));
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'brush') {
      const p = toWorld(e.clientX, e.clientY);
      // A point each third of the brush's reach: smooth, without thousands of them.
      setStroke((s) => {
        const last = s?.[s.length - 1];
        return !s ? [p] : last && Math.hypot(p.x - last.x, p.y - last.y) < brushRadius / 3 ? s : [...s, p];
      });
      return;
    }
    if (d.kind === 'template') {
      setDraft({ from: d.from, to: toWorld(e.clientX, e.clientY) });
      return;
    }
    if (d.kind === 'pan') {
      if (Math.abs(e.clientX - d.from.x) + Math.abs(e.clientY - d.from.y) > 3) d.moved = true;
      setCamera({ ...d.camera, x: d.camera.x + e.clientX - d.from.x, y: d.camera.y + e.clientY - d.from.y });
    } else if (d.kind === 'ruler') {
      const end = snapped(toWorld(e.clientX, e.clientY));
      setRuler((r) => (r ? { ...r, end } : r));
    } else if (d.kind === 'tokens') setMoving(landing(d, toWorld(e.clientX, e.clientY)));
    else if (d.kind === 'marquee') setMarquee((m) => (m ? { ...m, to: toWorld(e.clientX, e.clientY) } : m));
    else setBox((b) => (b ? { ...b, to: toWorld(e.clientX, e.clientY) } : b));
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setPanning(false);
    if (d?.kind === 'pan' && !d.moved) setSelected([]);
    if (d?.kind === 'brush' && stroke?.length) {
      addFog({ mode: fogMode, shape: 'brush', points: stroke, radius: brushRadius });
      setStroke(null);
    }
    if (d?.kind === 'ruler') setRuler((r) => (r ? { ...r, done: true } : r));
    if (d?.kind === 'template' && draft && table) {
      const length = Math.hypot(draft.to.x - draft.from.x, draft.to.y - draft.from.y);
      setDraft(null);
      if (length >= grid.size / 2) table.onTemplate({ shape: templateShape, x: draft.from.x, y: draft.from.y, angle: Math.atan2(draft.to.y - draft.from.y, draft.to.x - draft.from.x), length });
    }
    if (d?.kind === 'tokens') {
      const moved = [...moving].filter(([id, p]) => {
        const o = d.origins.get(id);
        return o && (o.x !== p.x || o.y !== p.y);
      });
      if (moved.length) moveTokens(moved.map(([id, p]) => ({ id, ...p })));
      setMoving(new Map());
    }
    if (d?.kind === 'marquee' && marquee) {
      const ids = inBox(shown.filter((v) => canMove(access, v)).map((v) => ({ id: v.token.id, x: v.token.x, y: v.token.y })), marquee.from, marquee.to);
      setSelected(d.add ? [...new Set([...selectedIds, ...ids])] : ids);
      setMarquee(null);
    }
    if (d?.kind === 'box' && box) {
      setBox(null);
      if (d.purpose === 'fog') {
        if (Math.abs(box.to.x - box.from.x) < 4 || Math.abs(box.to.y - box.from.y) < 4) return;
        return addFog({ mode: fogMode, shape: 'rect', points: rectPoints(box.from, box.to) });
      }
      const fitted = lineUp(grid.kind, { x: box.from.x, y: box.from.y, w: box.to.x - box.from.x, h: box.to.y - box.from.y });
      if (!fitted) return toast('Drag a bigger box', { description: `Over one whole ${grid.kind === 'square' ? 'square' : 'hex'} of the map.` });
      onMapChange({ grid: { ...grid, ...fitted } });
      setTool('select');
      toast('Grid Lined Up', { description: `${grid.kind === 'square' ? 'Squares' : 'Hexes'} of ${Math.round(fitted.size * 10) / 10} px. Fine-tune it in the map’s settings.` });
    }
  };

  // Dropped from the tray.
  const onDragOver = (e: DragEvent) => {
    if (gm && e.dataTransfer.types.includes(TOKEN_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const onDrop = (e: DragEvent) => {
    const raw = e.dataTransfer.getData(TOKEN_MIME);
    if (!raw || !gm) return;
    e.preventDefault();
    const source = sourceOf(JSON.parse(raw) as { kind: TokenSource['kind']; id: string | null });
    if (source) place(source, toWorld(e.clientX, e.clientY));
  };

  const path = useMemo(() => (grid.show ? gridPath(grid, board.width, board.height) : null), [grid, board.width, board.height]);
  const route = ruler ? [...ruler.points, ruler.end] : [];
  const measured = ruler ? measure(grid, route) : null;
  const unitName = grid.kind === 'square' ? 'square' : 'hex';
  const d = drag.current;
  const step = d?.kind === 'tokens' && moving.size ? { from: d.origins.get(d.primary)!, to: moving.get(d.primary)! } : null;
  const stepMeasure = step ? measure(grid, [step.from, step.to]) : null;
  const cursor = panning ? 'grabbing' : spaceHeld || activeTool === 'select' ? 'grab' : activeTool === 'fog' && fogShape === 'brush' ? 'none' : 'crosshair';
  const screenPoly = (points: Point[]) => points.map((p) => toScreen(p)).map((p) => `${p.x},${p.y}`).join(' ');
  const fogTint = fogMode === 'reveal' ? '#38bdf8' : '#0f172a';
  const tokenLayer = (list: TokenView[]) =>
    camera && <TokenLayer views={list} grid={grid} zoom={camera.zoom} rotation={camera.rotation} selected={selected} moving={moving} onPointerDown={onTokenPointerDown} active={table?.activeTokenId} />;
  /** A line template's width: one square of the grid's (5 ft). */
  const lineWidth = grid.size;
  const draftTemplate = draft ? { shape: templateShape, x: draft.from.x, y: draft.from.y, angle: Math.atan2(draft.to.y - draft.from.y, draft.to.x - draft.from.x), length: Math.hypot(draft.to.x - draft.from.x, draft.to.y - draft.from.y), color: table?.color ?? '#f97316', id: 'draft' } : null;
  const templateShapes = [...(table?.templates ?? []), ...(draftTemplate ? [draftTemplate] : [])];

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="application"
      aria-label={`${board.name || 'Map'}: the board`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => wallDraft && finishWall()}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{ cursor }}
      className="relative min-w-0 flex-1 touch-none overflow-hidden bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] [background-size:24px_24px] outline-none select-none"
    >
      {camera && (
        <div
          className="absolute top-0 left-0"
          style={{ width: board.width, height: board.height, transformOrigin: `${center.x}px ${center.y}px`, transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom}) rotate(${camera.rotation}deg)` }}
        >
          <div className="absolute inset-0 shadow-[0_0_0_1px_rgb(0_0_0/0.25),0_12px_40px_rgb(0_0_0/0.35)]" style={{ background: board.background }} />
          {board.image && <img src={mediaSrc(board.image)} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full max-w-none" />}
          {path && (
            <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={board.width} height={board.height} viewBox={`0 0 ${board.width} ${board.height}`}>
              <path d={path} fill="none" stroke={grid.color} strokeOpacity={grid.opacity} strokeWidth={1} vectorEffect="non-scaling-stroke" shapeRendering="crispEdges" />
            </svg>
          )}
          {templateShapes.length > 0 && (
            <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={board.width} height={board.height} viewBox={`0 0 ${board.width} ${board.height}`}>
              {templateShapes.map((t) => {
                const outline = templateOutline(t, lineWidth);
                const common = { fill: t.color, fillOpacity: 0.22, stroke: t.color, strokeWidth: 2, vectorEffect: 'non-scaling-stroke' as const, 'data-template': t.shape };
                return t.shape === 'circle' ? <circle key={t.id} cx={t.x} cy={t.y} r={t.length} {...common} /> : <polygon key={t.id} points={outline.map((p) => `${p.x},${p.y}`).join(' ')} {...common} />;
              })}
            </svg>
          )}
          {tokenLayer(below)}
          <FogLayer id={board.id} fog={fog} width={board.width} height={board.height} gm={gm} />
          {sight && <VisionLayer id={board.id} width={board.width} height={board.height} walls={walls} lighting={sight.lighting} viewers={viewers} lights={lights} />}
          {gm && (walls.length > 0 || wallDraft) && (activeTool === 'walls' || !sight) && (
            <svg aria-hidden data-walls className="pointer-events-none absolute inset-0 overflow-visible" width={board.width} height={board.height} viewBox={`0 0 ${board.width} ${board.height}`}>
              {walls.map((w) => (
                <polyline key={w.id} points={w.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#f97316" strokeOpacity={activeTool === 'walls' ? 1 : 0.55} strokeWidth={activeTool === 'walls' ? 4 : 2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              ))}
              {wallDraft && <polyline points={[...wallDraft.points, ...(wallDraft.hover ? [wallDraft.hover] : [])].map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#f97316" strokeWidth={4} strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />}
            </svg>
          )}
          {above.length > 0 && tokenLayer(above)}
          {marks && <MarkSheet onId={marks.onId} access={access} width={board.width} height={board.height} e={ink} px={unit / zoomNow} />}
        </div>
      )}
      {marking && <div ref={overlay} tabIndex={-1} aria-label="Marking up the board" className="absolute inset-0 cursor-crosshair outline-none" style={{ touchAction: finger && !penInUse() ? 'none' : 'pan-x pan-y' }} />}

      {/* What you measure, move and draw: in screen space, one size at any zoom. */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible">
        {ruler && route.length > 1 && (
          <>
            <polyline points={screenPoly(route)} fill="none" stroke="black" strokeOpacity={0.45} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={screenPoly(route)} fill="none" stroke="var(--primary)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="10 6" />
          </>
        )}
        {ruler &&
          route.map((p, i) => {
            const s = toScreen(p);
            return <circle key={i} cx={s.x} cy={s.y} r={i === 0 || i === route.length - 1 ? 5 : 4} fill={i === route.length - 1 ? 'var(--primary)' : 'white'} stroke="var(--primary)" strokeWidth={2} />;
          })}
        {step && <line x1={toScreen(step.from).x} y1={toScreen(step.from).y} x2={toScreen(step.to).x} y2={toScreen(step.to).y} stroke="var(--primary)" strokeWidth={2} strokeDasharray="6 5" />}
        {box && (
          <polygon
            points={screenPoly(rectPoints(box.from, box.to))}
            fill={d?.kind === 'box' && d.purpose === 'fog' ? fogTint : 'var(--primary)'}
            fillOpacity={0.2}
            stroke={d?.kind === 'box' && d.purpose === 'fog' ? fogTint : 'var(--primary)'}
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        )}
        {poly && <polyline points={screenPoly([...poly.points, ...(poly.hover ? [poly.hover] : [])])} fill={fogTint} fillOpacity={0.2} stroke={fogTint} strokeWidth={2} strokeDasharray="6 4" />}
        {stroke && camera && <polyline points={screenPoly(stroke.length === 1 ? [stroke[0]!, stroke[0]!] : stroke)} fill="none" stroke={fogTint} strokeOpacity={0.4} strokeWidth={brushRadius * 2 * camera.zoom} strokeLinecap="round" strokeLinejoin="round" />}
        {activeTool === 'fog' && fogShape === 'brush' && brushAt && camera && <circle cx={toScreen(brushAt).x} cy={toScreen(brushAt).y} r={brushRadius * camera.zoom} fill="none" stroke={fogTint} strokeWidth={1.5} strokeDasharray="4 3" />}
        {marquee && <polygon points={screenPoly(rectPoints(marquee.from, marquee.to))} fill="var(--primary)" fillOpacity={0.08} stroke="var(--primary)" strokeWidth={1.5} />}
        {table?.pings.map((pg) => {
          const s = toScreen(pg);
          return (
            <g key={pg.id} data-ping>
              <circle cx={s.x} cy={s.y} r={10} fill="none" stroke={pg.color} strokeWidth={3}>
                <animate attributeName="r" from="8" to="46" dur="1.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="1" to="0" dur="1.2s" repeatCount="indefinite" />
              </circle>
              <circle cx={s.x} cy={s.y} r={6} fill={pg.color} stroke="white" strokeWidth={2} />
              <text x={s.x + 12} y={s.y - 12} fontSize={12} fontWeight={600} fill="white" stroke="black" strokeWidth={3} paintOrder="stroke">
                {pg.who}
              </text>
            </g>
          );
        })}
      </svg>
      {table?.overlay && <div data-toolbar className="absolute top-3 right-3 max-w-[calc(100%-24px)]">{table.overlay}</div>}
      {draftTemplate && draft && draftTemplate.length > 2 && <DistanceLabel at={toScreen(draft.to)} distance={templateSize(draftTemplate.length, grid.size, grid.distance, grid.unit)} detail={TEMPLATE_LABEL[templateShape]} label="Area" />}
      {ruler && measured && route.length > 1 && (
        <DistanceLabel at={toScreen(ruler.end)} distance={formatDistance(grid, measured)} detail={`${measured.cells} ${measured.cells === 1 ? unitName : `${unitName}s`}${ruler.points.length > 1 ? ` · ${ruler.points.length - 1} ${ruler.points.length === 2 ? 'waypoint' : 'waypoints'}` : ''}`} />
      )}
      {step && stepMeasure && <DistanceLabel at={toScreen(step.to)} distance={formatDistance(grid, stepMeasure)} detail={`${stepMeasure.cells} ${stepMeasure.cells === 1 ? unitName : `${unitName}s`} moved`} label="Moved" />}

      {marking && marks && <MarkTools e={ink} onId={marks.onId} access={access} onDone={() => setTool('select')} className="absolute top-[60px] left-3 max-w-[calc(100%-24px)] rounded-xl border bg-background/95 p-1 shadow-md backdrop-blur" />}
      <Toolbar
        gm={gm}
        markable={Boolean(marks)}
        areas={Boolean(table)}
        templateShape={templateShape}
        setTemplateShape={setTemplateShape}
        onClearTemplates={table?.onClearTemplates}
        walls={walls.length}
        onUndoWall={() => onMapChange({ walls: walls.slice(0, -1) })}
        onClearWalls={() => {
          const before = walls;
          onMapChange({ walls: [] });
          toast('Walls Cleared', { action: { label: 'Undo', onClick: () => onMapChange({ walls: before }) } });
        }}
        playersView={playersView}
        setPlayersView={setPlayersView}
        tool={activeTool}
        setTool={setTool}
        tray={tray}
        setTray={setTray}
        fogMode={fogMode}
        setFogMode={setFogMode}
        fogShape={fogShape}
        setFogShape={(s) => {
          setPoly(null);
          setFogShape(s);
        }}
        brush={brush}
        setBrush={setBrush}
        zoom={camera?.zoom ?? 1}
        onZoom={zoomBy}
        onRotate={rotate}
        onFit={() => setCamera(fit(board, size.w, size.h, camera?.rotation ?? 0))}
      />
      {gm && tray && <TokenTray views={views} encounter={encounter} onAdd={(source) => place(source, viewCenter(), true)} onAddEncounter={(e, missing) => placeEncounter(e, missing)} onClose={() => setTray(false)} />}
      <ToolHint tool={activeTool} measuring={Boolean(ruler && !ruler.done)} cell={unitName} picked={selectedIds.length} gm={gm} fogShape={fogShape} drawing={Boolean(poly)} />
    </div>
  );
}

function DistanceLabel({ at, distance, detail, label = 'Distance' }: { at: Point; distance: string; detail: string; label?: string }) {
  return (
    <div role="status" aria-label={label} className="pointer-events-none absolute flex flex-col rounded-lg bg-foreground px-2.5 py-1 text-background shadow-lg" style={{ left: at.x + 14, top: at.y - 40 }}>
      <span className="font-mono text-[15px] leading-tight font-bold">{distance}</span>
      <span className="font-mono text-[10.5px] leading-tight opacity-70">{detail}</span>
    </div>
  );
}

const TEMPLATE_LABEL: Record<TemplateShape, string> = { circle: 'Radius', cone: 'Cone', line: 'Line', square: 'Square' };
const TEMPLATE_TOOLS: { shape: TemplateShape; label: string; icon: LucideIcon }[] = [
  { shape: 'circle', label: 'A Circle (its radius)', icon: CircleIcon },
  { shape: 'cone', label: 'A Cone', icon: ConeIcon },
  { shape: 'line', label: 'A Line (5 ft wide)', icon: MoveRightIcon },
  { shape: 'square', label: 'A Square (a cube)', icon: SquareIcon },
];

const TOOLS: { tool: BoardTool; label: string; key: string; icon: LucideIcon; gm?: boolean; marks?: boolean; areas?: boolean }[] = [
  { tool: 'select', label: 'Select', key: 'V', icon: HandIcon },
  { tool: 'ruler', label: 'Ruler', key: 'R', icon: RulerIcon },
  { tool: 'mark', label: 'Mark Up', key: 'P', icon: PenLineIcon, marks: true },
  { tool: 'template', label: 'Areas', key: 'A', icon: ShapesIcon, areas: true },
  { tool: 'lineup', label: 'Line Up Grid', key: 'G', icon: SquareDashedIcon, gm: true },
  { tool: 'fog', label: 'Fog Of War', key: 'F', icon: CloudFogIcon, gm: true },
  { tool: 'walls', label: 'Walls', key: 'W', icon: BrickWallIcon, gm: true },
];

const TOOL_BUTTON = 'flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground';
const TOOL_ON = 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground';

function ToolButton({ label, on, onClick, icon: Icon }: { label: string; on?: boolean; onClick: () => void; icon: LucideIcon }) {
  return (
    <Hint label={label}>
      <button type="button" aria-label={label.replace(/ \(.*\)$/, '')} aria-pressed={on} onClick={onClick} className={cn(TOOL_BUTTON, on && TOOL_ON)}>
        <Icon className="size-4" />
      </button>
    </Hint>
  );
}

function Toolbar({
  gm,
  markable,
  areas,
  templateShape,
  setTemplateShape,
  onClearTemplates,
  walls,
  onUndoWall,
  onClearWalls,
  playersView,
  setPlayersView,
  tool,
  setTool,
  tray,
  setTray,
  fogMode,
  setFogMode,
  fogShape,
  setFogShape,
  brush,
  setBrush,
  zoom,
  onZoom,
  onRotate,
  onFit,
}: {
  gm: boolean;
  markable: boolean;
  areas: boolean;
  templateShape: TemplateShape;
  setTemplateShape: (s: TemplateShape) => void;
  onClearTemplates?: () => void;
  walls: number;
  onUndoWall: () => void;
  onClearWalls: () => void;
  playersView: boolean;
  setPlayersView: (on: boolean) => void;
  tool: BoardTool;
  setTool: (t: BoardTool) => void;
  tray: boolean;
  setTray: (open: boolean) => void;
  fogMode: 'reveal' | 'hide';
  setFogMode: (m: 'reveal' | 'hide') => void;
  fogShape: 'rect' | 'poly' | 'brush';
  setFogShape: (s: 'rect' | 'poly' | 'brush') => void;
  brush: number;
  setBrush: (squares: number) => void;
  zoom: number;
  onZoom: (factor: number) => void;
  onRotate: (by: number) => void;
  onFit: () => void;
}) {
  return (
    <div data-toolbar className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
      <div className="flex items-center gap-1 rounded-xl border bg-background/95 p-1 shadow-md backdrop-blur">
        <div role="toolbar" aria-label="Tools" className="flex gap-0.5">
          {TOOLS.filter((t) => (gm || !t.gm) && (markable || !t.marks) && (areas || !t.areas)).map((t) => (
            <ToolButton key={t.tool} label={`${t.label} (${t.key})`} on={tool === t.tool} onClick={() => setTool(t.tool)} icon={t.icon} />
          ))}
        </div>
        {gm && (
          <>
            <span className="mx-1 h-5 w-px bg-border" />
            <ToolButton label="Add Tokens (T)" on={tray} onClick={() => setTray(!tray)} icon={UserRoundPlusIcon} />
          </>
        )}
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolButton label="Turn Left (Q)" onClick={() => onRotate(-90)} icon={RotateCcwIcon} />
        <ToolButton label="Turn Right (E)" onClick={() => onRotate(90)} icon={RotateCwIcon} />
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolButton label="Zoom Out (−)" onClick={() => onZoom(0.8)} icon={MinusIcon} />
        <span aria-label="Zoom" className="w-12 text-center font-mono text-[11px] text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <ToolButton label="Zoom In (+)" onClick={() => onZoom(1.25)} icon={PlusIcon} />
        <ToolButton label="Fit The Map (0)" onClick={onFit} icon={MaximizeIcon} />
      </div>
      {areas && tool === 'template' && (
        <div role="toolbar" aria-label="Areas" className="flex items-center gap-1 rounded-xl border bg-background/95 p-1 shadow-md backdrop-blur">
          {TEMPLATE_TOOLS.map((t) => (
            <ToolButton key={t.shape} label={t.label} on={templateShape === t.shape} onClick={() => setTemplateShape(t.shape)} icon={t.icon} />
          ))}
          {onClearTemplates && (
            <>
              <span className="mx-1 h-5 w-px bg-border" />
              <ToolButton label={gm ? 'Clear The Areas' : 'Clear My Areas'} onClick={onClearTemplates} icon={Trash2Icon} />
            </>
          )}
        </div>
      )}
      {gm && tool === 'walls' && (
        <div role="toolbar" aria-label="Walls" className="flex items-center gap-1 rounded-xl border bg-background/95 p-1 shadow-md backdrop-blur">
          <span className="px-1.5 font-mono text-[11px] text-muted-foreground">{walls === 1 ? '1 wall' : `${walls} walls`}</span>
          <ToolButton label="Undo The Last Wall" onClick={onUndoWall} icon={Undo2Icon} />
          <ToolButton label="Clear The Walls" onClick={onClearWalls} icon={Trash2Icon} />
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolButton label="See As The Players Do (sight and light)" on={playersView} onClick={() => setPlayersView(!playersView)} icon={ScanEyeIcon} />
        </div>
      )}
      {gm && tool === 'fog' && (
        <div role="toolbar" aria-label="Fog" className="flex items-center gap-1 rounded-xl border bg-background/95 p-1 shadow-md backdrop-blur">
          <ToolButton label="Reveal" on={fogMode === 'reveal'} onClick={() => setFogMode('reveal')} icon={EyeIcon} />
          <ToolButton label="Hide" on={fogMode === 'hide'} onClick={() => setFogMode('hide')} icon={EyeOffIcon} />
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolButton label="A Box" on={fogShape === 'rect'} onClick={() => setFogShape('rect')} icon={SquareIcon} />
          <ToolButton label="A Shape (click its corners)" on={fogShape === 'poly'} onClick={() => setFogShape('poly')} icon={SplineIcon} />
          <ToolButton label="A Brush (paint)" on={fogShape === 'brush'} onClick={() => setFogShape('brush')} icon={PaintbrushIcon} />
          {fogShape === 'brush' && (
            <>
              <span className="mx-1 h-5 w-px bg-border" />
              <div role="radiogroup" aria-label="Brush size" className="flex gap-0.5">
                {[1, 2, 4, 6].map((n) => (
                  <Hint key={n} label={`${n} ${n === 1 ? 'square' : 'squares'} wide`}>
                    <button type="button" role="radio" aria-checked={brush === n} aria-label={`Brush ${n} wide`} onClick={() => setBrush(n)} className={cn(TOOL_BUTTON, 'w-7', brush === n && TOOL_ON)}>
                      <span className="rounded-full bg-current" style={{ width: 3 + n * 2, height: 3 + n * 2 }} />
                    </button>
                  </Hint>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ToolHint({ tool, measuring, cell, picked, gm, fogShape, drawing }: { tool: BoardTool; measuring: boolean; cell: string; picked: number; gm: boolean; fogShape: 'rect' | 'poly' | 'brush'; drawing: boolean }) {
  const text =
    tool === 'walls'
      ? 'Click a wall’s corners · double-click or Enter ends it · walls block the players’ sight (Line of sight, in the scene’s settings)'
      : tool === 'template'
      ? 'Drag from where the spell starts · everyone sees it · Alt + click pings'
      : tool === 'mark'
      ? 'Draw with a pen, a finger or the mouse · everyone at the table sees your marks · Esc stops'
      : tool === 'ruler'
      ? measuring
        ? 'Space drops a waypoint · let go to finish'
        : 'Drag to measure · Space drops a waypoint · Esc clears'
      : tool === 'lineup'
        ? `Drag a box over one ${cell} of the map, ${cell === 'square' ? 'corner to corner' : 'flat side to flat side'}`
        : tool === 'fog'
          ? fogShape === 'brush'
            ? 'Paint to reveal or cover · pick the brush’s width beside it'
            : fogShape === 'poly'
              ? drawing
                ? 'Click the next corner · double-click or Enter closes the shape · Esc cancels'
                : 'Click the shape’s corners, one by one'
              : 'Drag a box to reveal or hide'
          : picked
            ? gm
              ? 'Drag to move · arrows nudge · H hides · Delete removes · Esc lets go'
              : 'Drag to move · arrows nudge · Esc lets go'
            : gm
              ? 'Click a token to pick it · Shift + drag picks with a box · drag the map to move around'
              : 'Drag your token to move it · drag the map to move around · Q and E turn it';
  return <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-3 py-1 text-[12px] whitespace-nowrap text-muted-foreground shadow-sm backdrop-blur">{text}</div>;
}

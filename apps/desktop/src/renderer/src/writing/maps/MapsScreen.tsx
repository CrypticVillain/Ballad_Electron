import { Link, Navigate, useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import { ImagePlusIcon, LayersIcon, MapIcon, MapPinIcon, MapPinPlusIcon, MinusIcon, PlusIcon, ScanIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { confirmDelete } from '@/components/tabletop/Sharing';
import { Empty, Label } from '@/components/shared/bits';
import { AREA, FIELD } from '@/components/shared/Field';
import { Hint } from '@/components/shared/Hint';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SidebarLink, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useWorldRecords } from '@/lib/hooks';
import { byOrder, type Entry } from '@/lib/model';
import { cn } from '@/lib/utils';
import { MapMarks, MarkUpButtons } from '@/tabletop/battlemap/marks/MarkUp';
import { WritingOnly } from '@/writing/common';
import { addPin, ancestors, createWritingMap, deleteWritingMap, removePin, updatePin, updateWritingMap } from './actions';
import { PIN_COLORS, type WritingMap, type WritingMapPin, type WritingPinColor } from './model';

/**
 * Writing → Maps (/writing/maps): a world's maps, its own module (not Tabletop's).
 * Upload an image, pan and zoom it, drop pins that mark places (or anyone in
 * the world bible) and open closer maps, nested as deep as the world goes.
 * Mark Up draws on a map (marks/: kept apart; the picture never changes).
 */

const PIN: Record<WritingPinColor, string> = {
  accent: 'bg-primary',
  blue: 'bg-sky-500',
  green: 'bg-online',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
  gray: 'bg-muted-foreground',
};

/** Where an image beside the vault loads from (a data: URL as it is). */
const src = (image: string) => (image.startsWith('data:') ? image : `ballad-media://maps/${encodeURIComponent(image)}`);

/** Asks for an image and makes it a map (a closer one, with `parentId`). */
async function uploadMap(worldId: string, parentId: string | null = null): Promise<WritingMap | null> {
  const picked = await window.api.files.importMap();
  if (!picked) return null;
  const size = await new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 1600, height: image.naturalHeight || 1000 });
    image.onerror = () => resolve({ width: 1600, height: 1000 });
    image.src = src(picked.file);
  });
  return createWritingMap({ worldId, parentId, name: picked.name, image: picked.file, ...size });
}

/** Deletes a map, asked first (Settings → Deleting: Writing, Maps). */
function removeMap(map: WritingMap, after?: () => void) {
  confirmDelete({ noun: 'Map', name: map.name || 'Untitled Map', area: 'writing:maps', extra: 'Its pins go with it; maps closer in stay, one level up.', remove: () => deleteWritingMap(map.id), after });
}

/** /writing/maps: the first map, or how to start. */
export function WritingMapsIndex() {
  return (
    <WritingOnly>
      {(world) => <MapsIndexBody worldId={world.id} />}
    </WritingOnly>
  );
}

function MapsIndexBody({ worldId }: { worldId: string }) {
  const maps = useWorldRecords('writingMaps');
  const navigate = useNavigate();
  const first = [...maps].filter((m) => !m.parentId).sort(byOrder)[0] ?? maps[0];
  if (first) return <Navigate to="/writing/maps/$mapId" params={{ mapId: first.id }} replace />;
  const add = () => void uploadMap(worldId).then((m) => m && navigate({ to: '/writing/maps/$mapId', params: { mapId: m.id } }));
  return (
    <>
      <MapsSidebar worldId={worldId} />
      <main className="flex min-w-0 flex-1 items-center justify-center bg-background">
        <Empty
          title="No Maps Yet"
          action={
            <Button onClick={add}>
              <ImagePlusIcon /> Upload A Map
            </Button>
          }
        >
          A map of the world, a city, a ship: any image. Pin the places in it, and open closer maps from its pins.
        </Empty>
      </main>
    </>
  );
}

/** /writing/maps/$mapId: one map. */
export function WritingMapScreen() {
  const { mapId } = useParams({ from: '/writing/maps/$mapId' });
  return (
    <WritingOnly>
      {(world) => <MapScreenBody worldId={world.id} mapId={mapId} />}
    </WritingOnly>
  );
}

function MapScreenBody({ worldId, mapId }: { worldId: string; mapId: string }) {
  const maps = useWorldRecords('writingMaps');
  const map = maps.find((m) => m.id === mapId);
  if (!map) return <Navigate to="/writing/maps" replace />;
  return (
    <>
      <MapsSidebar worldId={worldId} />
      <MapView key={map.id} map={map} maps={maps} />
    </>
  );
}

// ── The sidebar: maps, and the closer maps under them ──────────────────

function MapsSidebar({ worldId }: { worldId: string }) {
  const maps = useWorldRecords('writingMaps');
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const childrenOf = (parentId: string | null) => maps.filter((m) => (m.parentId ?? null) === parentId).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  // A map whose parent is gone sits at the top.
  const tops = maps.filter((m) => !m.parentId || !maps.some((p) => p.id === m.parentId)).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const add = () => void uploadMap(worldId).then((m) => m && navigate({ to: '/writing/maps/$mapId', params: { mapId: m.id } }));
  const row = (map: WritingMap, depth: number, seen: Set<string>): ReactNode => {
    if (seen.has(map.id)) return null;
    const next = new Set(seen).add(map.id);
    return (
      <div key={map.id}>
        <ContextMenu>
          <ContextMenuTrigger className="block" style={{ paddingLeft: depth * 14 }}>
            <SidebarLink to={`/writing/maps/${map.id}`} icon={depth ? LayersIcon : MapIcon} label={map.name || 'Untitled Map'} meta={map.pins.length || undefined} />
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem disabled className="max-w-56 truncate font-medium opacity-100">
              {map.name || 'Untitled Map'}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => void uploadMap(worldId, map.id).then((m) => m && navigate({ to: '/writing/maps/$mapId', params: { mapId: m.id } }))}>
              <ImagePlusIcon /> Add A Closer Map…
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onSelect={() => removeMap(map, () => path === `/writing/maps/${map.id}` && void navigate({ to: '/writing/maps' }))}>
              <Trash2Icon /> Delete Map
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        {childrenOf(map.id).map((child) => row(child, depth + 1, next))}
      </div>
    );
  };
  return (
    <Sidebar title="Maps" addLabel="New Map" onAdd={add}>
      <SidebarSection title={`Maps · ${maps.length}`}>{tops.map((m) => row(m, 0, new Set()))}</SidebarSection>
      <p className="px-2.5 text-xs text-muted-foreground">A pin can open a closer map: right-click a map to add one, or pick one on a pin.</p>
    </Sidebar>
  );
}

// ── One map ──────────────────────────────────────────────────────────────

type View = { x: number; y: number; k: number };
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function MapView({ map, maps }: { map: WritingMap; maps: WritingMap[] }) {
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<{ kind: 'pan' | 'pin'; id?: string; startX: number; startY: number; view: View; moved: boolean; pin?: { x: number; y: number } } | null>(null);
  const [dragPin, setDragPin] = useState<{ id: string; x: number; y: number } | null>(null);
  const [marking, setMarking] = useState(false);
  const marks = { worldId: map.worldId, sceneId: '', onId: map.id };
  const pin = map.pins.find((p) => p.id === selected);
  const trail = ancestors(map, maps);

  /** Fits the whole map in the window. */
  const fit = () => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const k = Math.min(rect.width / map.width, rect.height / map.height) * 0.95;
    setView({ k, x: (rect.width - map.width * k) / 2, y: (rect.height - map.height * k) / 2 });
  };
  useLayoutEffect(fit, [map.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Zooms by `factor` toward a point in the window (its center if none). */
  const zoom = (factor: number, at?: { x: number; y: number }) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const p = at ?? { x: rect.width / 2, y: rect.height / 2 };
    setView((v) => {
      const k = clamp(v.k * factor, 0.05, 8);
      return { k, x: p.x - ((p.x - v.x) * k) / v.k, y: p.y - ((p.y - v.y) * k) / v.k };
    });
  };
  // Wheel zoom, toward the pointer (a native listener: React's wheel events can't prevent scrolling).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoom(Math.exp(-e.deltaY * 0.0015), { x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /** A point in the window, as a place on the image (0–1). */
  const toImage = (clientX: number, clientY: number) => {
    const rect = box.current!.getBoundingClientRect();
    return { x: clamp((clientX - rect.left - view.x) / (map.width * view.k), 0, 1), y: clamp((clientY - rect.top - view.y) / (map.height * view.k), 0, 1) };
  };

  const down = (e: ReactPointerEvent, pinId?: string) => {
    if (e.button !== 0 || marking) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = pinId ? map.pins.find((x) => x.id === pinId) : undefined;
    drag.current = { kind: pinId ? 'pin' : 'pan', id: pinId, startX: e.clientX, startY: e.clientY, view, moved: false, pin: p && { x: p.x, y: p.y } };
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 3) return;
    d.moved = true;
    if (d.kind === 'pan') setView({ ...d.view, x: d.view.x + dx, y: d.view.y + dy });
    else if (d.id) setDragPin({ id: d.id, ...toImage(e.clientX, e.clientY) });
  };
  const up = (e: ReactPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === 'pin' && d.id) {
      if (d.moved && dragPin) updatePin(map, d.id, { x: dragPin.x, y: dragPin.y });
      else setSelected(d.id);
      setDragPin(null);
      return;
    }
    if (d.moved) return;
    if (adding) {
      const made = addPin(map, toImage(e.clientX, e.clientY));
      setSelected(made.id);
      setAdding(false);
    } else setSelected(null);
  };

  const remove = () => removeMap(map, () => void navigate({ to: map.parentId ? '/writing/maps/$mapId' : '/writing/maps', params: { mapId: map.parentId ?? '' } }));

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      <TopBar crumbs={['Maps', ...trail.map((m) => m.name || 'Untitled Map'), map.name || 'Untitled Map']}>
        <Button variant="outline" size="sm" aria-pressed={adding} className={cn('rounded-full font-mono text-xs tracking-[0.08em] uppercase', adding && 'border-primary bg-primary/10')} onClick={() => setAdding(!adding)}>
          <MapPinPlusIcon /> {adding ? 'Click The Map…' : 'Add Pin'}
        </Button>
        <MarkUpButtons target={marks} marking={marking} setMarking={setMarking} />
        <span className="flex items-center rounded-full border">
          <Button variant="ghost" size="icon-sm" aria-label="Zoom out" className="rounded-full" onClick={() => zoom(1 / 1.25)}>
            <MinusIcon />
          </Button>
          <span className="w-12 text-center font-mono text-[11px] tabular-nums">{Math.round(view.k * 100)}%</span>
          <Button variant="ghost" size="icon-sm" aria-label="Zoom in" className="rounded-full" onClick={() => zoom(1.25)}>
            <PlusIcon />
          </Button>
        </span>
        <Hint label="Fit the map">
          <Button variant="outline" size="icon-sm" aria-label="Fit the map" className="rounded-full" onClick={fit}>
            <ScanIcon />
          </Button>
        </Hint>
        <Hint label="Delete Map">
          <Button variant="outline" size="icon-sm" aria-label="Delete Map" className="rounded-full" onClick={remove}>
            <Trash2Icon />
          </Button>
        </Hint>
      </TopBar>
      {trail.length > 0 && (
        <nav aria-label="Up to" className="flex items-center gap-1.5 border-b px-5 py-1.5 text-[12px]">
          <LayersIcon className="size-3.5 text-muted-foreground" />
          {trail.map((m) => (
            <span key={m.id} className="flex items-center gap-1.5">
              <Link to="/writing/maps/$mapId" params={{ mapId: m.id }} className="text-link hover:underline">
                {m.name || 'Untitled Map'}
              </Link>
              <span className="text-muted-foreground">/</span>
            </span>
          ))}
          <span className="font-medium">{map.name || 'Untitled Map'}</span>
        </nav>
      )}
      <div className="flex min-h-0 flex-1">
        <div
          ref={box}
          role="application"
          aria-label={`${map.name || 'Map'}: drag to move, scroll to zoom`}
          onPointerDown={(e) => down(e)}
          onPointerMove={move}
          onPointerUp={up}
          className={cn('relative min-w-0 flex-1 touch-none overflow-hidden bg-muted/40 select-none', adding ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing')}
        >
          <img src={src(map.image)} alt={map.name} draggable={false} className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left" style={{ width: map.width, height: map.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }} />
          {map.pins.map((p) => {
            const at = dragPin?.id === p.id ? dragPin : p;
            return (
              <button
                key={p.id}
                type="button"
                aria-label={p.label || 'Pin'}
                onPointerDown={(e) => down(e, p.id)}
                onPointerMove={move}
                onPointerUp={up}
                onDoubleClick={() => p.mapId && void navigate({ to: '/writing/maps/$mapId', params: { mapId: p.mapId } })}
                className="absolute flex -translate-x-1/2 -translate-y-full cursor-pointer flex-col items-center"
                style={{ left: view.x + at.x * map.width * view.k, top: view.y + at.y * map.height * view.k }}
              >
                <span className={cn('flex items-center gap-1 rounded-full border bg-background/95 px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap shadow-sm', selected === p.id && 'border-primary ring-2 ring-primary/40')}>
                  {p.mapId && <LayersIcon className="size-3 text-muted-foreground" />}
                  {p.label || 'Pin'}
                </span>
                <span className={cn('mt-0.5 size-3 rounded-full border-2 border-background shadow', PIN[p.color])} />
              </button>
            );
          })}
          <MapMarks target={marks} width={map.width} height={map.height} view={view} marking={marking} onDone={() => setMarking(false)} />
        </div>
        <aside className="flex w-[300px] shrink-0 flex-col gap-4 overflow-y-auto border-l px-5 py-4">
          {pin ? <PinPanel key={pin.id} map={map} maps={maps} pin={pin} onDone={() => setSelected(null)} /> : <MapPanel map={map} maps={maps} onPick={setSelected} />}
        </aside>
      </div>
    </main>
  );
}

/** The map itself: its name and note, its pins, and the closer maps it opens. */
function MapPanel({ map, maps, onPick }: { map: WritingMap; maps: WritingMap[]; onPick: (pinId: string) => void }) {
  const closer = maps.filter((m) => m.parentId === map.id);
  return (
    <>
      <label className="flex flex-col gap-1.5">
        <Label>Map</Label>
        <Input aria-label="Map name" value={map.name} placeholder="Untitled Map" onChange={(e) => updateWritingMap(map.id, { name: e.target.value })} className={FIELD} />
      </label>
      <Textarea aria-label="About this map" rows={3} value={map.note} placeholder="What it shows, when it was drawn, by whom…" onChange={(e) => updateWritingMap(map.id, { note: e.target.value })} className={cn(AREA, 'resize-y text-[13px]')} />
      <section className="flex flex-col gap-1.5">
        <Label>Pins · {map.pins.length}</Label>
        {map.pins.length ? (
          map.pins.map((p) => (
            <button key={p.id} type="button" onClick={() => onPick(p.id)} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] hover:bg-muted">
              <span className={cn('size-2.5 shrink-0 rounded-full', PIN[p.color])} />
              <span className="min-w-0 flex-1 truncate">{p.label || 'Pin'}</span>
              {p.mapId && <LayersIcon className="size-3.5 text-muted-foreground" />}
            </button>
          ))
        ) : (
          <p className="text-[12.5px] text-muted-foreground">Add Pin, then click the map.</p>
        )}
      </section>
      {closer.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <Label>Closer Maps</Label>
          {closer.map((m) => (
            <Link key={m.id} to="/writing/maps/$mapId" params={{ mapId: m.id }} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-muted">
              <LayersIcon className="size-3.5 text-muted-foreground" /> {m.name || 'Untitled Map'}
            </Link>
          ))}
        </section>
      )}
    </>
  );
}

/** A pin: its label, color and note, the entry it marks, and the closer map it opens. */
function PinPanel({ map, maps, pin, onDone }: { map: WritingMap; maps: WritingMap[]; pin: WritingMapPin; onDone: () => void }) {
  const navigate = useNavigate();
  const entries = useWorldRecords('entries');
  const entry = entries.find((e) => e.id === pin.entryId);
  const set = (changes: Partial<WritingMapPin>) => updatePin(map, pin.id, changes);
  // Places first, then characters, then lore, each name with its kind; a line between the kinds.
  const order: Entry['kind'][] = ['place', 'character', 'lore'];
  const kindLabel: Partial<Record<Entry['kind'], string>> = { place: 'Place', character: 'Character', lore: 'Lore' };
  const entryOptions = [
    { value: null as string | null, label: 'Nothing' },
    ...entries
      .filter((e) => e.name && order.includes(e.kind))
      .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name))
      .map((e, i, all) => ({ value: e.id as string | null, label: `${e.name} · ${kindLabel[e.kind]}`, divider: i === 0 || all[i - 1]!.kind !== e.kind }))
  ];
  const mapOptions = [{ value: null as string | null, label: 'No closer map' }, ...maps.filter((m) => m.id !== map.id).map((m) => ({ value: m.id as string | null, label: m.name || 'Untitled Map' }))];
  const closer = async () => {
    const made = await uploadMap(map.worldId, map.id);
    if (made) set({ mapId: made.id });
  };
  const remove = () =>
    confirmDelete({ noun: 'Pin', verb: 'Remove', name: pin.label || 'this pin', area: 'writing:maps', remove: () => removePin(map, pin.id), after: onDone });

  return (
    <>
      <div className="flex items-center justify-between">
        <Label>Pin</Label>
        <button type="button" onClick={onDone} className="text-[12px] text-muted-foreground hover:text-foreground">
          Done
        </button>
      </div>
      <Input aria-label="Pin label" value={pin.label} placeholder="Pin" onChange={(e) => set({ label: e.target.value })} className={FIELD} />
      <div role="radiogroup" aria-label="Pin color" className="flex gap-1.5">
        {PIN_COLORS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={pin.color === c} aria-label={c} onClick={() => set({ color: c })} className={cn('size-6 rounded-full border-2 border-background ring-1 ring-border', PIN[c], pin.color === c && 'ring-2 ring-foreground')} />
        ))}
      </div>
      <Textarea aria-label="Pin note" rows={3} value={pin.note} placeholder="What’s here…" onChange={(e) => set({ note: e.target.value })} className={cn(AREA, 'resize-y text-[13px]')} />
      <section className="flex flex-col gap-1.5">
        <Label>Marks</Label>
        <SelectField label="What this pin marks" value={pin.entryId} options={entryOptions} onChange={(entryId) => set({ entryId, label: pin.label === 'New Pin' && entryId ? (entries.find((e) => e.id === entryId)?.name ?? pin.label) : pin.label })} />
        {entry && (
          <Button variant="outline" size="sm" className="self-start" onClick={() => void navigate({ to: '/bible/$kind/$entryId', params: { kind: entry.kind, entryId: entry.id } })}>
            <MapPinIcon /> Open {entry.name}
          </Button>
        )}
      </section>
      <section className="flex flex-col gap-1.5">
        <Label>Opens</Label>
        <SelectField label="The closer map this pin opens" value={pin.mapId} options={mapOptions} onChange={(mapId) => set({ mapId })} />
        <div className="flex flex-wrap gap-1.5">
          {pin.mapId ? (
            <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/writing/maps/$mapId', params: { mapId: pin.mapId! } })}>
              <LayersIcon /> Open Closer Map
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => void closer()}>
              <ImagePlusIcon /> Upload A Closer Map…
            </Button>
          )}
        </div>
      </section>
      <Button variant="ghost" size="sm" className="mt-auto self-start text-muted-foreground hover:text-destructive" onClick={remove}>
        <Trash2Icon /> Remove Pin
      </Button>
    </>
  );
}

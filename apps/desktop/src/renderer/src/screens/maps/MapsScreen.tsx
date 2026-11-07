import { Navigate, useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import { CopyIcon, EyeOffIcon, ImagePlusIcon, MapIcon, MapPinIcon, MapPinPlusIcon, MinusIcon, PlusIcon, ScanIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Empty, Label } from '@/components/shared/bits';
import { AREA, FIELD } from '@/components/shared/Field';
import { Hint } from '@/components/shared/Hint';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SidebarLink } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { createMap, restore, trash, updateRecord } from '@/lib/actions';
import { useCharacter, useRole, useWorld } from '@/lib/hooks';
import { deleteShared, dropCopy, editShared, useVisibleMaps } from '@/lib/shared';
import { confirmDelete, ShareButton, SharedMark, SharedSwitch, UpdatedDot, useShareMenus } from '@/components/tabletop/Sharing';
import { newId, PIN_TONES, type GameMap, type MapPin, type PinTone } from '@/lib/model';
import { cn } from '@/lib/utils';
import { MapMarks, MarkUpButtons } from '@/tabletop/battlemap/marks/MarkUp';
import { Spaces } from '@/components/shell/Spaces';
import { openNew } from '@/components/dialogs/NewDialog';
import { useMapLayouts } from '@/components/shell/layouts';

/** Where a map's image loads from: a file beside the vault (main/media.ts), or a data: URL (the sample's). */
export const mapSrc = (image: string) => (image.startsWith('data:') ? image : `ballad-media://maps/${encodeURIComponent(image)}`);

const TONE: Record<PinTone, { label: string; color: string; dot: string }> = {
  place: { label: 'Place', color: 'text-primary', dot: 'bg-primary' },
  party: { label: 'Party', color: 'text-online', dot: 'bg-online' },
  danger: { label: 'Danger', color: 'text-destructive', dot: 'bg-destructive' },
  note: { label: 'Note', color: 'text-sky-500', dot: 'bg-sky-500' },
};

/** Who a new map belongs to: the campaign (GM), or the character you're playing (Player). Null if there's nothing to hang it on. */
function useOwner(): { worldId: string | null; characterId: string | null } | null {
  const role = useRole();
  const world = useWorld();
  const character = useCharacter();
  if (role === 'player') return character ? { worldId: null, characterId: character.id } : null;
  return world ? { worldId: world.id, characterId: null } : null;
}

/** Picks an image (an Open dialog), copies it beside the vault and makes it a map. */
async function addMap(owner: { worldId: string | null; characterId: string | null }): Promise<GameMap | null> {
  const picked = await window.api.files.importMap();
  if (!picked) return null;
  const size = await new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 1600, height: image.naturalHeight || 1000 });
    image.onerror = () => resolve({ width: 1600, height: 1000 });
    image.src = mapSrc(picked.file);
  });
  return createMap({ ...owner, name: picked.name, image: picked.file, ...size });
}

/**
 * Deletes a map, asked first: the GM's (players lose the shared version), a
 * player's own, or a player's copy of one the GM deleted. Nothing for a
 * map that's still the GM's, shared with you.
 */
function removeMap(map: GameMap, characterId: string | undefined, after?: () => void) {
  const name = map.name || 'Untitled Map';
  if (map.via) {
    if (map.via.ended && characterId) confirmDelete({ noun: 'Map', name, area: 'tabletop:maps', extra: 'It’s your own version: the GM deleted theirs.', remove: () => dropCopy(map.via!.shareId, characterId), after });
    return;
  }
  if (map.characterId) confirmDelete({ noun: 'Map', name, area: 'tabletop:maps', remove: () => { trash('maps', map.id); return () => restore('maps', map.id); }, after });
  else confirmDelete({ noun: 'Map', name, area: 'tabletop:maps', sharedId: map.id, remove: () => deleteShared('maps', map.id), after });
}

/** /maps: opens the first map you can see, or offers to add one. */
export function MapsIndex() {
  const maps = useVisibleMaps();
  const owner = useOwner();
  const navigate = useNavigate();
  const player = useRole() === 'player';
  if (maps[0]) return <Navigate to="/maps/$mapId" params={{ mapId: maps[0].id }} replace />;
  return (
    <>
      <MapsSidebar />
      <main className="flex min-w-0 flex-1 items-center justify-center bg-background">
        <Empty
          title="No Maps Yet"
          action={
            owner && (
              <Button onClick={() => openNew('map', () => void addMap(owner).then((map) => map && navigate({ to: '/maps/$mapId', params: { mapId: map.id } })))}>
                <ImagePlusIcon /> New Map
              </Button>
            )
          }
        >
          {owner
            ? player
              ? 'Add a map of your own (an image: a sketch, a handout, a screenshot) and pin what your character knows. Maps the GM shares with you show here too.'
              : 'Add a map (any image) for the campaign and pin places, the party and dangers. Share it when the players should have it (without the pins you keep GM Only).'
            : player
              ? 'Make a character first, from Home.'
              : 'Make a campaign first, from Home.'}
        </Empty>
      </main>
    </>
  );
}

/** /maps/$mapId — a map: pan and zoom it, pin it. */
export function MapScreen() {
  const { mapId } = useParams({ from: '/maps/$mapId' });
  const map = useVisibleMaps().find((m) => m.id === mapId);
  if (!map) return <Navigate to="/maps" replace />;
  return (
    <>
      <MapsSidebar />
      <MapView key={map.id} map={map} />
    </>
  );
}

function MapsSidebar() {
  const maps = useVisibleMaps();
  const owner = useOwner();
  const navigate = useNavigate();
  const world = useWorld();
  const role = useRole();
  const gm = role === 'gm';
  const shown = (map: GameMap) => (gm ? map.pins.length : map.pins.filter((p) => !p.gmOnly).length);
  const byId = useMemo(() => new Map(maps.map((m) => [m.id, m])), [maps]);
  const sharing = useShareMenus('maps', (id) => byId.get(id)?.name || 'Untitled Map');
  const link = (map: GameMap) => <SidebarLink key={map.id} to={`/maps/${map.id}`} icon={MapIcon} lead={
        <>
          <SharedMark status={sharing.status(map.id)} />
          <UpdatedDot via={map.via} />
        </>
      } label={map.name || 'Untitled Map'} meta={shown(map)} />;
  const character = useCharacter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const remove = (id: string) => {
    const map = byId.get(id);
    if (map) removeMap(map, character?.id, () => path === `/maps/${id}` && void navigate({ to: '/maps' }));
  };
  // The GM arranges the campaign's maps; a player, theirs and those shared with them, their own way.
  const { campaign, own } = useMapLayouts();
  return (
    <Sidebar title="Maps" addLabel="New Map" onAdd={owner ? () => openNew('map', () => void addMap(owner).then((map) => map && navigate({ to: '/maps/$mapId', params: { mapId: map.id } }))) : undefined}>
      {gm && world && (
        <Spaces scope={`${world.id}:maps`} layout={campaign.layout} items={byId} render={link} nameOf={(m) => m.name || 'Untitled Map'} editable={campaign.editable} noun="map" onChange={campaign.save} itemMenu={sharing.itemMenu} groupMenu={sharing.groupMenu} onDelete={remove} />
      )}
      {own && character && <Spaces scope={`${character.id}:maps`} layout={own.layout} items={byId} render={link} nameOf={(m) => m.name || 'Untitled Map'} editable noun="map" onChange={own.save} onDelete={remove} deletable={(id) => !byId.get(id)?.via || Boolean(byId.get(id)?.via?.ended)} />}
      <p className="px-2.5 text-xs text-muted-foreground">{gm ? 'Players have only the maps you share, as you last sent them, without GM Only pins.' : 'Maps the GM shares are theirs: unlock one to pin notes of your own on it.'}</p>
    </Sidebar>
  );
}

type View = { x: number; y: number; k: number };

/**
 * A map on screen: drag to pan, scroll to zoom (toward the pointer), Fit to
 * see it whole. Add Pin, then click where it goes; drag a pin to move it;
 * pick one to edit it on the right. Mark Up draws on it (your marks, kept
 * apart from the map, which never changes; Hide Marks puts them away). What
 * you can change: the GM their campaign's maps, a player their own (the
 * campaign's they can copy).
 */
function MapView({ map }: { map: GameMap }) {
  const navigate = useNavigate();
  const role = useRole();
  const gm = role === 'gm';
  const character = useCharacter();
  const via = map.via;
  // A shared map: the player's own version once unlocked; the GM's original is read-only.
  const editable = gm ? !map.characterId : via ? via.showing === 'edited' : map.characterId === character?.id;
  const save = (changes: Partial<GameMap>) => {
    if (!via) updateRecord('maps', map.id, changes);
    else if (character && editable) editShared(via.shareId, character.id, changes);
  };
  const pins = gm ? map.pins : map.pins.filter((p) => !p.gmOnly);
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; x: number; y: number } | null>(null);
  const [broken, setBroken] = useState(false);
  const [marking, setMarking] = useState(false);
  const marks = { worldId: map.worldId ?? '', sceneId: '', onId: map.id };
  const selected = pins.find((p) => p.id === selectedId);
  const setPins = (next: MapPin[]) => save({ pins: next });
  const changePin = (id: string, changes: Partial<MapPin>) => setPins(map.pins.map((p) => (p.id === id ? { ...p, ...changes } : p)));

  const fitScale = () => {
    const rect = box.current?.getBoundingClientRect();
    return rect ? Math.min(rect.width / map.width, rect.height / map.height) * 0.94 : 1;
  };
  const fit = () => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const k = fitScale();
    setView({ k, x: (rect.width - map.width * k) / 2, y: (rect.height - map.height * k) / 2 });
  };
  const zoomAt = (cx: number, cy: number, factor: number) =>
    setView((v) => {
      const k = Math.max(fitScale() * 0.5, Math.min(8, v.k * factor));
      return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) };
    });
  const zoomCenter = (factor: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (rect) zoomAt(rect.width / 2, rect.height / 2, factor);
  };

  useLayoutEffect(fit, [map.width, map.height]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  /** Where on the image (0-1) a point on screen is. */
  const toMap = (clientX: number, clientY: number) => {
    const rect = box.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left - view.x) / view.k / map.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top - view.y) / view.k / map.height)),
    };
  };

  const pan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || marking) return;
    const start = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
    let moved = false;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.px;
      const dy = ev.clientY - start.py;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      if (moved) setView((v) => ({ ...v, x: start.x + dx, y: start.y + dy }));
    };
    const up = (ev: PointerEvent) => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      if (moved) return;
      if (adding && editable) {
        const at = toMap(ev.clientX, ev.clientY);
        const pin: MapPin = { id: newId(), ...at, label: 'New Pin', note: '', tone: 'place', ...(gm ? { gmOnly: false } : {}) };
        setPins([...map.pins, pin]);
        setSelected(pin.id);
        setAdding(false);
      } else {
        setSelected(null);
      }
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };

  const grabPin = (e: ReactPointerEvent<HTMLButtonElement>, pin: MapPin) => {
    e.stopPropagation();
    setSelected(pin.id);
    if (!editable || e.button !== 0) return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const start = { px: e.clientX, py: e.clientY };
    let last: { x: number; y: number } | null = null;
    const move = (ev: PointerEvent) => {
      if (!last && Math.abs(ev.clientX - start.px) + Math.abs(ev.clientY - start.py) < 4) return;
      last = toMap(ev.clientX, ev.clientY);
      setDragging({ id: pin.id, ...last });
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      if (last) changePin(pin.id, last);
      setDragging(null);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };

  const center = (pin: MapPin) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    setView((v) => ({ ...v, x: rect.width / 2 - pin.x * map.width * v.k, y: rect.height / 2 - pin.y * map.height * v.k }));
  };

  const remove = () => removeMap(map, character?.id, () => void navigate({ to: '/maps' }));

  const copy = () => {
    if (!character) return;
    const mine = createMap({ worldId: null, characterId: character.id, name: `${map.name || 'Map'} (Mine)`, image: map.image, width: map.width, height: map.height, pins: pins.map((p) => ({ ...p, id: newId() })) });
    void navigate({ to: '/maps/$mapId', params: { mapId: mine.id } });
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      <TopBar crumbs={['Maps', map.name || 'Untitled Map']}>
        {editable && (
          <Button variant="outline" size="sm" aria-pressed={adding} className={cn('rounded-full font-mono text-xs tracking-[0.08em] uppercase', adding && 'border-primary bg-primary/10')} onClick={() => setAdding(!adding)}>
            <MapPinPlusIcon /> {adding ? 'Click The Map…' : 'Add Pin'}
          </Button>
        )}
        <MarkUpButtons target={marks} marking={marking} setMarking={setMarking} />
        {via && <SharedSwitch via={via} />}
        {gm && !map.characterId && <ShareButton collection="maps" id={map.id} name={map.name || 'Untitled Map'} />}
        {!editable && !gm && character && (
          <Button variant="outline" size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={copy}>
            <CopyIcon /> Copy To My Maps
          </Button>
        )}
        <span className="flex items-center rounded-full border">
          <Hint label="Zoom Out (−)">
            <Button variant="ghost" size="icon-sm" aria-label="Zoom out" className="rounded-full" onClick={() => zoomCenter(1 / 1.3)}>
              <MinusIcon />
            </Button>
          </Hint>
          <span className="w-12 text-center font-mono text-[11px] tabular-nums">{Math.round(view.k * 100)}%</span>
          <Hint label="Zoom In (+)">
            <Button variant="ghost" size="icon-sm" aria-label="Zoom in" className="rounded-full" onClick={() => zoomCenter(1.3)}>
              <PlusIcon />
            </Button>
          </Hint>
        </span>
        <Hint label="Fit (0)">
          <Button variant="outline" size="icon-sm" aria-label="Fit the map" className="rounded-full" onClick={fit}>
            <ScanIcon />
          </Button>
        </Hint>
        {editable && !via && (
          <Hint label="Delete Map">
            <Button variant="outline" size="icon-sm" aria-label="Delete Map" className="rounded-full" onClick={remove}>
              <Trash2Icon />
            </Button>
          </Hint>
        )}
      </TopBar>

      <div className="flex min-h-0 flex-1">
        <div
          ref={box}
          tabIndex={0}
          aria-label={`Map: ${map.name}`}
          onPointerDown={pan}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setAdding(false);
            else if (e.key === '+' || e.key === '=') zoomCenter(1.3);
            else if (e.key === '-') zoomCenter(1 / 1.3);
            else if (e.key === '0') fit();
          }}
          className={cn('relative min-w-0 flex-1 touch-none overflow-hidden bg-muted/40 outline-none select-none', adding ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing')}
        >
          <div className="absolute top-0 left-0 origin-top-left" style={{ width: map.width, height: map.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
            {broken ? (
              <div className="flex size-full items-center justify-center rounded-md border-4 border-dashed text-4xl text-muted-foreground">The map’s image is missing</div>
            ) : (
              <img src={mapSrc(map.image)} alt="" draggable={false} onError={() => setBroken(true)} className="pointer-events-none size-full rounded-md shadow-[0_20px_60px_rgb(0_0_0/0.35)]" />
            )}
          </div>
          {pins.map((pin) => {
            const at = dragging?.id === pin.id ? dragging : pin;
            const on = pin.id === selectedId;
            return (
              <button
                key={pin.id}
                type="button"
                aria-label={`Pin: ${pin.label}`}
                onPointerDown={(e) => grabPin(e, pin)}
                className={cn('group/pin absolute flex -translate-x-1/2 -translate-y-full flex-col items-center', editable && 'cursor-move', on && 'z-10')}
                style={{ left: view.x + at.x * map.width * view.k, top: view.y + at.y * map.height * view.k }}
              >
                <span
                  className={cn(
                    'mb-0.5 max-w-44 truncate rounded-full border bg-popover/95 px-2 py-0.5 text-[11.5px] font-medium text-popover-foreground shadow-md',
                    on && 'border-primary ring-2 ring-primary/40',
                    pin.gmOnly && 'border-dashed',
                  )}
                >
                  {pin.gmOnly && <EyeOffIcon className="mr-1 inline size-3 align-[-2px] text-muted-foreground" />}
                  {pin.label || 'Pin'}
                </span>
                <MapPinIcon className={cn('size-7 fill-current stroke-white drop-shadow-[0_2px_3px_rgb(0_0_0/0.45)] transition-transform group-hover/pin:-translate-y-0.5', TONE[pin.tone].color, on && 'scale-110')} strokeWidth={1.5} />
              </button>
            );
          })}
          {adding && <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-3 py-1 text-[12px] text-background shadow-lg">Click where the pin goes · Esc to cancel</div>}
          {!broken && <MapMarks target={marks} width={map.width} height={map.height} view={view} marking={marking} onDone={() => setMarking(false)} />}
        </div>

        <aside className="flex w-[290px] shrink-0 flex-col gap-4 overflow-y-auto border-l bg-sidebar px-4 py-4">
          <div className="flex flex-col gap-1.5">
            <Label>Map</Label>
            <Input aria-label="Map name" value={map.name} disabled={!editable} placeholder="Untitled Map" onChange={(e) => save({ name: e.target.value })} className={cn(FIELD, 'font-semibold')} />
            <span className="text-[12px] text-muted-foreground">
              {map.characterId ? 'Your own map.' : via ? (via.showing === 'edited' ? 'Your version of the GM’s map: the GM’s stays as it is.' : 'The GM’s map, as they shared it. Unlock it to keep your own version.') : 'The campaign’s. Players get it once you share it, without GM Only pins.'}
            </span>
          </div>

          {selected && (
            <section className="flex flex-col gap-2 rounded-xl border bg-background px-3 py-3">
              <Input aria-label="Pin label" value={selected.label} disabled={!editable} onChange={(e) => changePin(selected.id, { label: e.target.value })} className={cn(FIELD, 'font-semibold')} />
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Kind">
                {PIN_TONES.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    role="radio"
                    aria-checked={selected.tone === tone}
                    disabled={!editable}
                    onClick={() => changePin(selected.id, { tone })}
                    className={cn('flex h-6 items-center gap-1.5 rounded-full border px-2 text-[11.5px] text-muted-foreground', selected.tone === tone && 'border-foreground/40 text-foreground')}
                  >
                    <span className={cn('size-2 rounded-full', TONE[tone].dot)} /> {TONE[tone].label}
                  </button>
                ))}
              </div>
              <Textarea aria-label="Pin note" rows={4} value={selected.note} disabled={!editable} placeholder="What’s here…" onChange={(e) => changePin(selected.id, { note: e.target.value })} className={cn(AREA, 'resize-y text-[13px]')} />
              {editable && gm && (
                <label className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="flex items-center gap-1.5">
                    <EyeOffIcon className="size-3.5" /> GM Only
                  </span>
                  <Switch checked={Boolean(selected.gmOnly)} onCheckedChange={(gmOnly) => changePin(selected.id, { gmOnly })} />
                </label>
              )}
              {editable && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="self-start text-muted-foreground"
                  onClick={() => {
                    setPins(map.pins.filter((p) => p.id !== selected.id));
                    setSelected(null);
                  }}
                >
                  <Trash2Icon /> Remove Pin
                </Button>
              )}
            </section>
          )}

          <div className="flex flex-col gap-1">
            <Label>Pins · {pins.length}</Label>
            {pins.map((pin) => (
              <button
                key={pin.id}
                type="button"
                onClick={() => {
                  setSelected(pin.id);
                  center(pin);
                }}
                className={cn('flex min-h-[30px] items-center gap-2 rounded-md px-2 text-left text-[13px] hover:bg-sidebar-accent', pin.id === selectedId && 'bg-sidebar-accent font-medium')}
              >
                <span className={cn('size-2 shrink-0 rounded-full', TONE[pin.tone].dot)} />
                <span className="min-w-0 flex-1 truncate">{pin.label || 'Pin'}</span>
                {pin.gmOnly && <EyeOffIcon className="size-3.5 text-muted-foreground" />}
              </button>
            ))}
            {!pins.length && <p className="text-[12.5px] text-muted-foreground">{editable ? 'No pins yet. Add Pin, then click the map.' : 'No pins.'}</p>}
          </div>
          <p className="mt-auto text-[11.5px] text-muted-foreground">Drag to pan · scroll to zoom · 0 fits it{editable && ' · drag a pin to move it'}.</p>
        </aside>
      </div>
    </main>
  );
}

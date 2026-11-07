import { CheckIcon, ImagePlusIcon, SearchIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { PillTabs } from '@/components/shared/bits';
import { Field, FIELD } from '@/components/shared/Field';
import { mediaSrc } from '@/components/shared/Portrait';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorldRecords } from '@/lib/hooks';
import { DYSON_MAPS, type DysonMap } from '@/lib/library';
import { cn } from '@/lib/utils';
import { BACKGROUNDS, defaultFog, defaultGrid, type BattleMap } from './model';

/**
 * Tabletop → Battle maps: where a map comes from. A picture you have (the
 * system's Open dialog: kept at full size, beside the vault), one of the
 * campaign's maps, a map from the Library (Dyson Logos's: its credit is kept),
 * or nothing: a blank grid in a color, so many squares across and down.
 * `extra` adds a tab of the caller's own (Play's New Scene: an encounter).
 */

export type MapChoice =
  | { kind: 'upload'; file: string }
  | { kind: 'campaign'; image: string }
  | { kind: 'library'; map: DysonMap }
  | { kind: 'blank'; cols: number; rows: number; background: string };

/** A picture's size in pixels, read by loading it. */
export function pictureSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error(`Couldn't load ${src}`));
    img.src = src;
  });
}

/** The battle map a choice makes (a Library map is copied beside the vault first). Throws if its picture can't be had. */
export async function mapFromChoice(choice: MapChoice): Promise<BattleMap> {
  const base = { grid: defaultGrid(), fog: defaultFog() };
  if (choice.kind === 'blank') return { ...base, image: '', width: choice.cols * base.grid.size, height: choice.rows * base.grid.size, background: choice.background };
  let image: string;
  let credit: string | undefined;
  if (choice.kind === 'upload') image = choice.file;
  else if (choice.kind === 'campaign') image = choice.image;
  else {
    const got = await window.api.files.importLibraryMap(choice.map.file ? { bundled: choice.map.file } : { url: choice.map.image });
    if (!got) throw new Error('not saved');
    image = got.file;
    credit = 'Cartography by Dyson Logos';
  }
  const size = await pictureSize(mediaSrc(image));
  return { ...base, image, ...size, background: '#1b1b1b', credit };
}

type Tab = 'upload' | 'campaign' | 'library' | 'blank' | 'extra';

export function MapSourcePicker({ onChoice, extra }: { onChoice: (choice: MapChoice | null, name?: string) => void; extra?: { label: string; render: ReactNode; onSelect?: () => void } }) {
  const maps = useWorldRecords('maps').filter((m) => !m.characterId);
  const [tab, setTab] = useState<Tab>(extra ? 'extra' : 'upload');
  const [upload, setUpload] = useState<{ file: string; name: string } | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);
  const [dyson, setDyson] = useState<DysonMap | null>(null);
  const [query, setQuery] = useState('');
  const [cols, setCols] = useState(30);
  const [rows, setRows] = useState(20);
  const [background, setBackground] = useState<string>(BACKGROUNDS[0].value);
  const tabs: { value: Tab; label: string }[] = [
    ...(extra ? [{ value: 'extra' as const, label: extra.label }] : []),
    { value: 'upload', label: 'Your Picture' },
    { value: 'campaign', label: 'Campaign Map' },
    { value: 'library', label: 'Library Map' },
    { value: 'blank', label: 'Blank' },
  ];

  const library = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DYSON_MAPS.filter((m) => !q || m.title.toLowerCase().includes(q))
      .sort((a, b) => Number(Boolean(b.file)) - Number(Boolean(a.file)))
      .slice(0, 60);
  }, [query]);

  /** Tells the caller what's chosen now (on a tab with nothing picked: nothing). */
  const choose = (next: Tab, state = { upload, mapId, dyson, cols, rows, background }) => {
    if (next === 'extra') return extra?.onSelect?.();
    if (next === 'upload') return onChoice(state.upload ? { kind: 'upload', file: state.upload.file } : null, state.upload?.name);
    if (next === 'campaign') {
      const m = maps.find((x) => x.id === state.mapId);
      return onChoice(m ? { kind: 'campaign', image: m.image } : null, m?.name);
    }
    if (next === 'library') return onChoice(state.dyson ? { kind: 'library', map: state.dyson } : null, state.dyson?.title);
    onChoice({ kind: 'blank', cols: state.cols, rows: state.rows, background: state.background });
  };
  const state = { upload, mapId, dyson, cols, rows, background };

  return (
    <div className="flex flex-col gap-4">
      <PillTabs
        label="Map from"
        value={tab}
        options={tabs}
        onChange={(t) => {
          setTab(t);
          choose(t);
        }}
      />
      {tab === 'extra' && extra?.render}

      {tab === 'upload' && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-6 text-center">
          {upload ? <img src={mediaSrc(upload.file)} alt="" className="max-h-56 max-w-full rounded-md object-contain" /> : <ImagePlusIcon className="size-8 text-muted-foreground" />}
          <Button
            variant="outline"
            onClick={async () => {
              const got = await window.api.files.importMap();
              if (!got) return;
              setUpload(got);
              choose('upload', { ...state, upload: got });
            }}
          >
            {upload ? 'Choose Another Picture…' : 'Choose A Picture…'}
          </Button>
          <p className="text-xs text-muted-foreground">A battle map, a dungeon, a town: PNG, JPG, WebP, GIF or SVG, kept at full size.</p>
        </div>
      )}

      {tab === 'campaign' &&
        (maps.length ? (
          <Thumbs>
            {maps.map((m) => (
              <Thumb
                key={m.id}
                src={mediaSrc(m.image)}
                title={m.name || 'Untitled Map'}
                picked={mapId === m.id}
                onPick={() => {
                  setMapId(m.id);
                  choose('campaign', { ...state, mapId: m.id });
                }}
              />
            ))}
          </Thumbs>
        ) : (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">This campaign has no maps yet. Add one on Maps, or start from your own picture.</p>
        ))}

      {tab === 'library' && (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search Library maps" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${DYSON_MAPS.length} maps by Dyson Logos`} className={cn(FIELD, 'pl-8')} />
          </div>
          <Thumbs>
            {library.map((m) => (
              <Thumb
                key={m.image}
                src={m.file ? `library/maps/${m.file}` : `${m.image}?w=400`}
                title={m.title}
                picked={dyson?.image === m.image}
                note={m.file ? undefined : 'Downloads'}
                onPick={() => {
                  setDyson(m);
                  choose('library', { ...state, dyson: m });
                }}
              />
            ))}
          </Thumbs>
          <p className="text-xs text-muted-foreground">Free for personal and commercial use with credit (“Cartography by Dyson Logos”); the map keeps it.</p>
        </div>
      )}

      {tab === 'blank' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Squares Across">
              <Input
                type="number"
                min={1}
                max={200}
                value={cols}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(200, Number(e.target.value) || 1));
                  setCols(n);
                  choose('blank', { ...state, cols: n });
                }}
                className={FIELD}
              />
            </Field>
            <Field label="Squares Down">
              <Input
                type="number"
                min={1}
                max={200}
                value={rows}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(200, Number(e.target.value) || 1));
                  setRows(n);
                  choose('blank', { ...state, rows: n });
                }}
                className={FIELD}
              />
            </Field>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="label">Color</span>
            <div className="flex flex-wrap gap-2">
              {BACKGROUNDS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  aria-label={b.label}
                  aria-pressed={background === b.value}
                  onClick={() => {
                    setBackground(b.value);
                    choose('blank', { ...state, background: b.value });
                  }}
                  className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[13px]', background === b.value && 'border-primary ring-1 ring-primary')}
                >
                  <span className="size-4 rounded-sm border" style={{ background: b.value }} />
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Thumbs({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-3 gap-2.5">{children}</ul>;
}

export function Thumb({ src, title, picked, onPick, note }: { src?: string; title: string; picked: boolean; onPick: () => void; note?: string }) {
  return (
    <li>
      <button type="button" aria-pressed={picked} onClick={onPick} className={cn('relative flex w-full flex-col overflow-hidden rounded-xl border text-left hover:bg-muted/50', picked && 'border-primary ring-1 ring-primary')}>
        <span className="flex h-28 items-center justify-center bg-muted/40">{src ? <img src={src} alt="" loading="lazy" className="max-h-full max-w-full object-contain" /> : <span className="font-mono text-[11px] text-muted-foreground">No map yet</span>}</span>
        <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12.5px]">
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {note && <span className="font-mono text-[10px] text-muted-foreground">{note}</span>}
          {picked && <CheckIcon className="size-3.5 text-primary" />}
        </span>
      </button>
    </li>
  );
}

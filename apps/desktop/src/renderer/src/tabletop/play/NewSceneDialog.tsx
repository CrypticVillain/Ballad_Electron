import { CheckIcon, ImagePlusIcon, SearchIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PillTabs } from '@/components/shared/bits';
import { Field, FIELD } from '@/components/shared/Field';
import { mediaSrc } from '@/components/shared/Portrait';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useWorldRecords } from '@/lib/hooks';
import { DYSON_MAPS, type DysonMap } from '@/lib/library';
import { cn } from '@/lib/utils';
import { createPlayScene, pictureSize } from './actions';
import { BACKGROUNDS, defaultGrid, type PlayScene } from './model';

/**
 * Tabletop → Play: New Scene. A scene starts from a picture you have (the
 * system's Open dialog: kept at full size, beside the vault), one of the
 * campaign's maps, a map from the Library (Dyson Logos's), or nothing: a
 * blank grid in a color, so many squares across and down.
 */

type Source = 'upload' | 'campaign' | 'library' | 'blank';
const SOURCES: { value: Source; label: string }[] = [
  { value: 'upload', label: 'Your Picture' },
  { value: 'campaign', label: 'Campaign Map' },
  { value: 'library', label: 'Library Map' },
  { value: 'blank', label: 'Blank' },
];

export function NewSceneDialog({ worldId, open, onClose, onCreated }: { worldId: string; open: boolean; onClose: () => void; onCreated: (scene: PlayScene) => void }) {
  const maps = useWorldRecords('maps').filter((m) => !m.characterId);
  const [source, setSource] = useState<Source>('upload');
  const [name, setName] = useState('');
  const [named, setNamed] = useState(false);
  const [upload, setUpload] = useState<{ file: string; name: string } | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);
  const [dyson, setDyson] = useState<DysonMap | null>(null);
  const [query, setQuery] = useState('');
  const [cols, setCols] = useState(30);
  const [rows, setRows] = useState(20);
  const [background, setBackground] = useState<string>(BACKGROUNDS[0].value);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSource('upload');
    setName('');
    setNamed(false);
    setUpload(null);
    setMapId(null);
    setDyson(null);
    setQuery('');
  }, [open]);

  /** The name follows the picture picked, until you type one. */
  const suggest = (n: string) => !named && setName(n);

  const library = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DYSON_MAPS.filter((m) => !q || m.title.toLowerCase().includes(q))
      .sort((a, b) => Number(Boolean(b.file)) - Number(Boolean(a.file)))
      .slice(0, 60);
  }, [query]);

  const ready = source === 'upload' ? Boolean(upload) : source === 'campaign' ? Boolean(mapId) : source === 'library' ? Boolean(dyson) : cols > 0 && rows > 0;

  const create = async () => {
    setBusy(true);
    try {
      let input: Partial<PlayScene>;
      if (source === 'blank') {
        const size = defaultGrid().size;
        input = { image: '', width: cols * size, height: rows * size, background };
      } else {
        let image: string;
        let credit: string | undefined;
        if (source === 'upload') image = upload!.file;
        else if (source === 'campaign') image = maps.find((m) => m.id === mapId)!.image;
        else {
          const got = await window.api.files.importLibraryMap(dyson!.file ? { bundled: dyson!.file } : { url: dyson!.image });
          if (!got) throw new Error('not saved');
          image = got.file;
          credit = 'Cartography by Dyson Logos';
        }
        const size = await pictureSize(mediaSrc(image));
        input = { image, ...size, credit, background: '#1b1b1b' };
      }
      const scene = createPlayScene(worldId, { name: name.trim() || 'New Scene', ...input });
      onCreated(scene);
    } catch {
      toast.error('That scene couldn’t be made', { description: source === 'library' ? 'The map couldn’t be downloaded. Check the connection and try again.' : 'Its picture couldn’t be opened.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[calc(100vh-64px)] flex-col sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-black uppercase">New Scene</DialogTitle>
          <DialogDescription>A map to play on, with a grid over it. You can line the grid up with the map’s own squares once it’s open.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <Field label="Name">
            <Input
              value={name}
              placeholder="The Drowned Crypt"
              maxLength={80}
              onChange={(e) => {
                setName(e.target.value);
                setNamed(Boolean(e.target.value));
              }}
              className={FIELD}
            />
          </Field>
          <PillTabs label="Start from" value={source} options={SOURCES} onChange={setSource} />

          {source === 'upload' && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-6 text-center">
              {upload ? <img src={mediaSrc(upload.file)} alt="" className="max-h-56 max-w-full rounded-md object-contain" /> : <ImagePlusIcon className="size-8 text-muted-foreground" />}
              <Button
                variant="outline"
                onClick={async () => {
                  const got = await window.api.files.importMap();
                  if (!got) return;
                  setUpload(got);
                  suggest(got.name);
                }}
              >
                {upload ? 'Choose Another Picture…' : 'Choose A Picture…'}
              </Button>
              <p className="text-xs text-muted-foreground">A battle map, a dungeon, a town: PNG, JPG, WebP, GIF or SVG, kept at full size.</p>
            </div>
          )}

          {source === 'campaign' &&
            (maps.length ? (
              <Thumbs>
                {maps.map((m) => (
                  <Thumb key={m.id} src={mediaSrc(m.image)} title={m.name || 'Untitled Map'} picked={mapId === m.id} onPick={() => (setMapId(m.id), suggest(m.name))} />
                ))}
              </Thumbs>
            ) : (
              <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">This campaign has no maps yet. Add one on Maps, or start from your own picture.</p>
            ))}

          {source === 'library' && (
            <div className="flex flex-col gap-3">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Search Library maps" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${DYSON_MAPS.length} maps by Dyson Logos`} className={cn(FIELD, 'pl-8')} />
              </div>
              <Thumbs>
                {library.map((m) => (
                  <Thumb key={m.image} src={m.file ? `library/maps/${m.file}` : `${m.image}?w=400`} title={m.title} picked={dyson?.image === m.image} onPick={() => (setDyson(m), suggest(m.title))} note={m.file ? undefined : 'Downloads'} />
                ))}
              </Thumbs>
              <p className="text-xs text-muted-foreground">Free for personal and commercial use with credit (“Cartography by Dyson Logos”); the scene keeps it.</p>
            </div>
          )}

          {source === 'blank' && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Squares Across">
                  <Input type="number" min={1} max={200} value={cols} onChange={(e) => setCols(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} className={FIELD} />
                </Field>
                <Field label="Squares Down">
                  <Input type="number" min={1} max={200} value={rows} onChange={(e) => setRows(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} className={FIELD} />
                </Field>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="label">Color</span>
                <div className="flex flex-wrap gap-2">
                  {BACKGROUNDS.map((b) => (
                    <button key={b.value} type="button" aria-label={b.label} aria-pressed={background === b.value} onClick={() => setBackground(b.value)} className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[13px]', background === b.value && 'border-primary ring-1 ring-primary')}>
                      <span className="size-4 rounded-sm border" style={{ background: b.value }} />
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!ready || busy} onClick={() => void create()}>
            {busy ? 'Making…' : 'Create Scene'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Thumbs({ children }: { children: React.ReactNode }) {
  return <ul className="grid grid-cols-3 gap-2.5">{children}</ul>;
}

function Thumb({ src, title, picked, onPick, note }: { src: string; title: string; picked: boolean; onPick: () => void; note?: string }) {
  return (
    <li>
      <button type="button" aria-pressed={picked} onClick={onPick} className={cn('relative flex w-full flex-col overflow-hidden rounded-xl border text-left hover:bg-muted/50', picked && 'border-primary ring-1 ring-primary')}>
        <span className="flex h-28 items-center justify-center bg-muted/40">
          <img src={src} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12.5px]">
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {note && <span className="font-mono text-[10px] text-muted-foreground">{note}</span>}
          {picked && <CheckIcon className="size-3.5 text-primary" />}
        </span>
      </button>
    </li>
  );
}

import { useNavigate } from '@tanstack/react-router';
import { MusicIcon, PauseIcon, PlayIcon, PlusIcon, SearchIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Field, FIELD } from '@/components/shared/Field';
import { musicSrc } from '@/components/shared/Portrait';
import { SIDEBAR_ROW, SIDEBAR_ROW_ON } from '@/components/shell/Sidebar';
import { Spaces } from '@/components/shell/Spaces';
import { confirmDelete } from '@/components/tabletop/Sharing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { addMusic, deleteTrack, formatDuration, updateTrack, useMusicLayout, usesOf } from './actions';
import type { MusicTrack } from './model';
import { previewTrack, stopPreview, usePreviewing } from './preview';

/**
 * Tabletop → Library → Music (/library/music?id=…): your tracks for the
 * table. Add Music copies files beside the vault (several at once); the list
 * is arranged in spaces and folders like every list (drag, right-click);
 * a track's page plays it, names it, credits it, says where it's attached
 * (encounters, Play's scenes), and deletes it (Undo brings it back).
 */
export function MusicLibrary({ id }: { id?: string }) {
  const navigate = useNavigate();
  const { layout, tracks, editable, save } = useMusicLayout();
  const [query, setQuery] = useState('');
  const previewing = usePreviewing();
  const open = (trackId?: string) => void navigate({ to: '/library/$kind', params: { kind: 'music' }, search: trackId ? { id: trackId } : {} });
  const track = tracks.find((t) => t.id === id) ?? tracks[0];
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => (q ? tracks.filter((t) => `${t.name} ${t.credit ?? ''}`.toLowerCase().includes(q)) : null), [q, tracks]);
  const byId = new Map(tracks.map((t) => [t.id, t]));

  const add = async () => {
    const added = await addMusic();
    if (added.length) {
      open(added[0]!.id);
      toast(added.length === 1 ? 'Track Added' : `${added.length} Tracks Added`, { description: added.length === 1 ? added[0]!.name : undefined });
    }
  };
  const remove = (t: MusicTrack) =>
    confirmDelete({
      noun: 'Track',
      name: t.name || 'Untitled Track',
      area: 'tabletop:music',
      remove: () => {
        if (previewing === t.id) stopPreview();
        return deleteTrack(t.id);
      },
      after: () => open(),
    });

  const row = (t: MusicTrack) => (
    <button key={t.id} type="button" onClick={() => open(t.id)} aria-current={t.id === track?.id ? 'page' : undefined} className={cn(SIDEBAR_ROW, t.id === track?.id && SIDEBAR_ROW_ON)}>
      <MusicIcon className={cn('size-4 shrink-0', previewing === t.id && 'text-primary')} strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate">{t.name || 'Untitled Track'}</span>
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatDuration(t.duration)}</span>
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-[300px] shrink-0 flex-col gap-3 border-r px-3 py-4">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search music" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}`} className={cn(FIELD, 'h-8 pl-8')} />
          </div>
          <Button size="sm" onClick={() => void add()}>
            <PlusIcon /> Add Music
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {shown ? (
            <div className="flex flex-col gap-0.5">{shown.map(row)}</div>
          ) : (
            <Spaces scope="library:music" layout={layout} items={byId} render={row} nameOf={(t) => t.name || 'Untitled Track'} editable={editable} noun="track" onChange={save} onDelete={(trackId) => byId.get(trackId) && remove(byId.get(trackId)!)} />
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto">
        {track ? (
          <TrackPage key={track.id} track={track} previewing={previewing === track.id} onDelete={() => remove(track)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="font-display text-3xl font-black text-muted-foreground/60 uppercase">No Music Yet</span>
            <p className="max-w-sm text-sm text-muted-foreground">Tavern noise, a battle theme, rain on the roof: add tracks here, then attach them to an encounter or a scene in Play.</p>
            <Button onClick={() => void add()}>
              <PlusIcon /> Add Music
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function TrackPage({ track, previewing, onDelete }: { track: MusicTrack; previewing: boolean; onDelete: () => void }) {
  const uses = usesOf(track.id);
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-8 pt-7 pb-16">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" aria-label={previewing ? 'Stop' : `Play ${track.name}`} onClick={() => previewTrack(track.id, track.file)}>
          {previewing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Input aria-label="Track name" value={track.name} maxLength={120} onChange={(e) => updateTrack(track.id, { name: e.target.value })} className={cn(FIELD, 'text-lg font-semibold')} />
      </div>
      <audio controls src={musicSrc(track.file)} className="w-full" preload="metadata" />
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Credit (as its license asks)">
          <Input value={track.credit ?? ''} placeholder="“Tavern Ambience” by …" onChange={(e) => updateTrack(track.id, { credit: e.target.value })} className={FIELD} />
        </Field>
        <Field label="Length">
          <span className="flex h-9 items-center font-mono text-[13px]">{formatDuration(track.duration)}</span>
        </Field>
      </div>
      <section className="flex flex-col gap-1.5">
        <h3 className="label">Attached To</h3>
        {uses.encounters.length || uses.scenes.length ? (
          <ul className="flex flex-col gap-0.5 text-[13px]">
            {uses.encounters.map((n) => (
              <li key={`e-${n}`}>Encounter · {n}</li>
            ))}
            {uses.scenes.map((n) => (
              <li key={`s-${n}`}>Play scene · {n}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">Nothing yet: attach it to an encounter (its Music) or a scene in Play.</p>
        )}
      </section>
      <div>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
          <Trash2Icon /> Delete Track
        </Button>
      </div>
    </div>
  );
}

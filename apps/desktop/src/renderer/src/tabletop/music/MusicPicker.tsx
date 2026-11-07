import { MusicIcon, PauseIcon, PlayIcon, PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { FIELD } from '@/components/shared/Field';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { useLive } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { attachTrack, detachTrack, formatDuration, setTrackStart } from './actions';
import { noMusic, type AttachedMusic, type TrackStart } from './model';
import { previewTrack, usePreviewing } from './preview';

/**
 * Tabletop → Music: the tracks attached to an encounter or a scene, from the
 * Library. Each starts with the scene (Start, in Play) or when the GM plays
 * it; Loop plays a track over until another starts. `onPlay` (Play's GM) plays
 * one for the table now; without it the button previews it for you.
 */
export function MusicPicker({ music, onChange, onPlay, playing }: { music: AttachedMusic | undefined; onChange: (next: AttachedMusic) => void; onPlay?: (trackId: string | null) => void; playing?: string | null }) {
  const current = music ?? noMusic();
  const library = useLive('music');
  const previewing = usePreviewing();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const byId = new Map(library.map((t) => [t.id, t]));
  const attached = new Set(current.tracks.map((t) => t.trackId));
  const q = query.trim().toLowerCase();
  const choices = library.filter((t) => !attached.has(t.id) && (!q || t.name.toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-2">
      {current.tracks.length > 0 && (
        <ul aria-label="Attached music" className="flex flex-col gap-1.5">
          {current.tracks.map((a) => {
            const track = byId.get(a.trackId);
            const isPlaying = onPlay ? playing === a.trackId : previewing === a.trackId;
            return (
              <li key={a.trackId} className="flex flex-col gap-1.5 rounded-lg border px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={!track}
                    aria-label={isPlaying ? `Stop ${track?.name}` : `Play ${track?.name}`}
                    onClick={() => (onPlay ? onPlay(isPlaying ? null : a.trackId) : track && previewTrack(track.id, track.file))}
                  >
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                  </Button>
                  <span className={cn('min-w-0 flex-1 truncate text-[13px]', !track && 'text-muted-foreground line-through')}>{track ? track.name || 'Untitled Track' : 'A deleted track'}</span>
                  <span className="font-mono text-[10.5px] text-muted-foreground">{track ? formatDuration(track.duration) : ''}</span>
                  <button type="button" aria-label={`Take off ${track?.name ?? 'the track'}`} onClick={() => onChange(detachTrack(current, a.trackId))} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <XIcon className="size-3.5" />
                  </button>
                </div>
                <SelectField<TrackStart>
                  label={`How ${track?.name ?? 'it'} starts`}
                  variant="chip"
                  value={a.start}
                  onChange={(start) => onChange(setTrackStart(current, a.trackId, start))}
                  options={[
                    { value: 'auto', label: 'Plays when the scene starts' },
                    { value: 'manual', label: 'Played by hand' },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <PlusIcon /> Add Music
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="flex w-72 flex-col gap-2 p-2">
            <Input aria-label="Search the Library’s music" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the Library’s music" className={cn(FIELD, 'h-8')} />
            <ul className="flex max-h-64 flex-col overflow-y-auto">
              {choices.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(attachTrack(current, t.id, current.tracks.some((x) => x.start === 'auto') ? 'manual' : 'auto'));
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted"
                  >
                    <MusicIcon className="size-3.5 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{t.name || 'Untitled Track'}</span>
                    <span className="font-mono text-[10.5px] text-muted-foreground">{formatDuration(t.duration)}</span>
                  </button>
                </li>
              ))}
              {!choices.length && <li className="px-2 py-4 text-center text-[12px] text-muted-foreground">{library.length ? 'Nothing else matches.' : 'The Library has no music yet: Library → Music → Add Music.'}</li>}
            </ul>
          </PopoverContent>
        </Popover>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-[12.5px]">
          Loop
          <Switch checked={current.loop} onCheckedChange={(loop) => onChange({ ...current, loop })} />
        </label>
      </div>
    </div>
  );
}

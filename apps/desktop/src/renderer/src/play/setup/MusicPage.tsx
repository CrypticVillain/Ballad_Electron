import { Grid3x3Icon, MusicIcon, PauseIcon, PlayIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { useLive } from '@/lib/hooks';
import type { World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { addMusic, formatDuration } from '@/tabletop/music/actions';
import { MusicPicker } from '@/tabletop/music/MusicPicker';
import { previewTrack, usePreviewing } from '@/tabletop/music/preview';
import { PlayOnly } from '../common';
import { updatePlayScene } from '../scenes/actions';
import { usePlayLayout } from '../scenes/layout';
import { usePlayUi } from '../scenes/ui';

/**
 * Play → Music (/play/music): the campaign's scenes and their music, set up
 * ahead. Tracks come from the Library (Add Music brings files into it); each
 * scene's are set to start with the scene or to be played by hand, and in
 * the session (Play's window) they play for the table. Here they're only
 * listened to.
 */
export function MusicPage() {
  return <PlayOnly>{(world) => <Music world={world} />}</PlayOnly>;
}

function Music({ world }: { world: World }) {
  const { scenes } = usePlayLayout();
  const library = useLive('music');
  const previewing = usePreviewing();
  const setSceneId = usePlayUi((s) => s.setSceneId);
  const add = async () => {
    const added = await addMusic();
    if (added.length) toast(added.length === 1 ? 'Track Added To The Library' : `${added.length} Tracks Added To The Library`, { description: 'Attach them to a scene below.' });
  };
  return (
    <>
      <Sidebar title="Music">
        <p className="px-1.5 text-[12.5px] text-muted-foreground">The Library’s tracks, for {world.name || 'this campaign'}’s scenes. In the session they play for the table; here ▶ lets you listen.</p>
        <div className="flex flex-col gap-0.5">
          {[...library]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => previewTrack(t.id, t.file)}
                aria-label={previewing === t.id ? `Stop ${t.name}` : `Listen to ${t.name}`}
                className="flex min-h-[30px] items-center gap-2 rounded-md px-2.5 text-left text-[13px] hover:bg-sidebar-accent"
              >
                {previewing === t.id ? <PauseIcon className="size-3.5 text-primary" /> : <PlayIcon className="size-3.5 text-muted-foreground" />}
                <span className="min-w-0 flex-1 truncate">{t.name || 'Untitled Track'}</span>
                <span className="font-mono text-[10.5px] text-muted-foreground">{formatDuration(t.duration)}</span>
              </button>
            ))}
          {!library.length && <p className="px-2.5 text-[12.5px] text-muted-foreground">No music in the Library yet.</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => void add()}>
          <PlusIcon /> Add Music To The Library
        </Button>
      </Sidebar>
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background">
        <TopBar crumbs={['Play', 'Music']} />
        <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4 px-8 py-7">
          <header className="flex flex-col gap-1">
            <h1 className="font-display text-3xl leading-tight font-black uppercase">Music For The Scenes</h1>
            <p className="text-[13px] text-muted-foreground">Each scene’s tracks: one can start when the scene starts; the rest wait for you to play them.</p>
          </header>
          {scenes.length ? (
            <ul className="flex flex-col gap-3">
              {scenes.map((s) => (
                <li key={s.id} className={cn('flex flex-col gap-2 rounded-xl border px-4 py-3')}>
                  <div className="flex items-center gap-2">
                    <Grid3x3Icon className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{s.name || 'Untitled Scene'}</span>
                    <button type="button" onClick={() => setSceneId(s.id)} className="text-[12px] text-muted-foreground hover:text-foreground">
                      {s.music?.tracks.length ? `${s.music.tracks.length} ${s.music.tracks.length === 1 ? 'track' : 'tracks'}` : 'No music'}
                    </button>
                  </div>
                  <MusicPicker music={s.music} onChange={(music) => updatePlayScene(s.id, { music })} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
              <MusicIcon className="size-4" /> No scenes yet: make one in Scenes, then give it music here.
            </p>
          )}
        </div>
      </main>
    </>
  );
}

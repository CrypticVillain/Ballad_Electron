import { DicesIcon, MusicIcon, PanelRightIcon, PlayIcon, SquareIcon, Volume2Icon, VolumeXIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Toaster } from 'sonner';
import { Empty } from '@/components/shared/bits';
import { ConfirmHost } from '@/components/shared/Confirm';
import { ThemeSync } from '@/components/shared/ThemeSync';
import { DiceOverlay } from '@/components/tabletop/DiceOverlay';
import { DiceTray, DockedDiceTray } from '@/components/tabletop/DiceTray';
import { useUi } from '@/stores/ui';
import { Hint } from '@/components/shared/Hint';
import { setMediaOwner } from '@/components/shared/Portrait';
import { Button } from '@/components/ui/button';
import { useLive, useRecord, useWorld } from '@/lib/hooks';
import type { Vault, World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { keepPreferencesInMemory, usePreferences, worldKey } from '@/stores/preferences';
import { setRemote, useVault, type Change } from '@/stores/vault';
import { currentAccount } from '@/tabletop/battlemap/people';
import { type BoardAccess } from '@/tabletop/battlemap/tokens/resolve';
import { useBoardUi } from '@/tabletop/battlemap/ui';
import { startScene, stopScene } from '../scenes/actions';
import type { PlayScene } from '../scenes/model';
import { NoScenes, SceneStage, ScenesSidebar, useOpenScene } from '../scenes/Workspace';
import { usePlayUi } from '../scenes/ui';
import { setMuted, setVolume, useMuted, useTableMusic, useVolume } from './music';

/**
 * Play's window (#/play-window?owner=…&world=…): one campaign at the table, a
 * module of its own with no way back into the rest of the app. It's a client
 * of the table (main/table.ts, a server's part on this computer): it loads
 * the campaign from its owner and sends its changes back, and takes the
 * other window's changes in as they happen.
 *
 * The campaign's owner (its GM) runs it: the scenes (new, arranged, changed,
 * deleted), Start for the scene the table sees, the board with every tool,
 * the music. Anyone else (online: a player) sees the started scene, can pan,
 * zoom, turn and measure, move the tokens assigned to them, and mute or turn
 * down the music for themselves.
 */
export function PlayWindow() {
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const owner = params.get('owner') ?? '';
  const worldId = params.get('world') ?? '';
  const [state, setState] = useState<'loading' | 'ready' | 'gone'>('loading');

  useEffect(() => {
    const me = currentAccount();
    // This window's preferences stay in memory (the main window saves them), set to this campaign in Play.
    keepPreferencesInMemory();
    const prefs = usePreferences.getState();
    usePreferences.setState({ sections: { ...prefs.sections, [me]: 'play' }, worldIds: { ...prefs.worldIds, [worldKey(me, 'tabletop')]: worldId } });
    setMediaOwner(owner === me ? null : owner);
    document.title = 'Ballad · Play';
    // The look follows the main window's (they share this storage): a change there shows here.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'ballad.preferences' || !e.newValue) return;
      try {
        const saved = JSON.parse(e.newValue) as { theme?: string; style?: string };
        usePreferences.setState({ ...(saved.theme ? { theme: saved.theme as never } : {}), ...(saved.style ? { style: saved.style as never } : {}) });
      } catch {
        // unreadable: keep the look
      }
    };
    window.addEventListener('storage', onStorage);
    let stop = () => {};
    void window.api.table.load(owner, worldId).then((text) => {
      if (!text) return setState('gone');
      setRemote((changes: Change[]) => window.api.table.send(owner, changes));
      useVault.getState().replace(JSON.parse(text) as Vault);
      useVault.setState({ status: 'ready' });
      stop = window.api.table.onChanges((changes) => useVault.getState().applyRemote(changes as Change[]));
      setState('ready');
    });
    return () => {
      stop();
      window.removeEventListener('storage', onStorage);
    };
  }, [owner, worldId]);

  // The dice (Ctrl+D), as in the main window: the tray pops out, or docks beside the board when pinned.
  const dice = useUi((s) => s.dice);
  const pinned = usePreferences((s) => s.dicePinned);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        useUi.getState().setDice(!useUi.getState().dice);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {state === 'ready' ? (
            <Table owner={owner} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">{state === 'loading' ? 'Setting the table…' : 'This campaign isn’t there any more.'}</div>
          )}
        </div>
        {dice && pinned && <DockedDiceTray />}
      </div>
      <DiceTray />
      <DiceOverlay />
      <ThemeSync />
      <Toaster position="bottom-right" />
      <ConfirmHost />
    </div>
  );
}

function Table({ owner }: { owner: string }) {
  const world = useWorld();
  const me = currentAccount();
  const access: BoardAccess = useMemo(() => ({ gm: me === owner, accountId: me }), [me, owner]);
  if (!world) return <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">This campaign isn’t there any more.</div>;
  return access.gm ? <GmTable world={world} access={access} /> : <PlayerTable world={world} access={access} />;
}

/** The started scene's music, for this window: what the GM plays, joined where it is. */
function TableMusic({ scene }: { scene: PlayScene | undefined }) {
  const tracks = useVault((s) => s.vault.music);
  const now = scene?.nowPlaying ?? null;
  const track = now ? tracks[now.trackId] : undefined;
  useTableMusic(track && !track.deletedAt ? track : null, now?.startedAt ?? null, scene?.music?.loop ?? true);
  return null;
}

/** The header's music: what's playing, and this window's own mute and volume. */
function MusicControls({ scene }: { scene: PlayScene | undefined }) {
  const tracks = useVault((s) => s.vault.music);
  const muted = useMuted();
  const volume = useVolume();
  const playing = scene?.nowPlaying ? tracks[scene.nowPlaying.trackId] : undefined;
  return (
    <div className="flex items-center gap-2">
      <MusicIcon className={cn('size-4', playing && !muted ? 'text-primary' : 'text-muted-foreground')} />
      <span aria-label="Now playing" className="max-w-48 truncate text-[12.5px] text-muted-foreground">
        {playing ? playing.name || 'Untitled Track' : 'No music'}
      </span>
      <Hint label={muted ? 'Unmute (just for you)' : 'Mute (just for you)'}>
        <Button variant="ghost" size="icon" aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted} onClick={() => setMuted(!muted)}>
          {muted ? <VolumeXIcon /> : <Volume2Icon />}
        </Button>
      </Hint>
      <input type="range" aria-label="Volume (just for you)" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-20 accent-primary" />
    </div>
  );
}

function Header({ world, scene, children }: { world: World; scene: PlayScene | undefined; children?: React.ReactNode }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
      <span className="font-display text-lg font-black tracking-wide uppercase">Play</span>
      <span className="truncate text-[13px] text-muted-foreground">
        {world.name || 'Untitled Campaign'}
        {scene ? ` · ${scene.name || 'Untitled Scene'}` : ''}
      </span>
      <span className="flex-1" />
      {children}
      <MusicControls scene={scene} />
      <Hint label="Dice (Ctrl+D)">
        <Button variant="outline" size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => useUi.getState().setDice(!useUi.getState().dice)}>
          <DicesIcon /> Dice
        </Button>
      </Hint>
    </header>
  );
}

function GmTable({ world, access }: { world: World; access: BoardAccess }) {
  const { scene, liveId, scenes } = useOpenScene(world);
  const panel = usePlayUi((s) => s.panel);
  const setPanel = usePlayUi((s) => s.setPanel);
  const setSceneId = usePlayUi((s) => s.setSceneId);
  const live = scenes.find((s) => s.id === liveId);
  return (
    <>
      <TableMusic scene={live} />
      <Header world={world} scene={scene}>
        {scene &&
          (scene.id === liveId ? (
            <Button size="sm" variant="outline" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => stopScene(world)}>
              <SquareIcon /> Stop The Scene
            </Button>
          ) : (
            <Button size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => startScene(world, scene)}>
              <PlayIcon /> Start {live ? 'This Scene' : 'The Scene'}
            </Button>
          ))}
        <Hint label={panel ? 'Hide Settings' : 'Show Settings'}>
          <Button variant="ghost" size="icon" aria-label="Scene Settings" aria-pressed={panel} onClick={() => setPanel(!panel)} className={cn(panel && 'text-primary')}>
            <PanelRightIcon />
          </Button>
        </Hint>
      </Header>
      <div className="flex min-h-0 flex-1">
        <ScenesSidebar world={world} sceneId={scene?.id} liveId={liveId} />
        {scene ? <SceneStage key={scene.id} world={world} scene={scene} access={access} panel={panel} session onDeleted={() => setSceneId(null)} /> : <NoScenes />}
      </div>
    </>
  );
}

function PlayerTable({ world, access }: { world: World; access: BoardAccess }) {
  const liveId = world.tabletop?.live?.sceneId ?? null;
  const scene = useRecord('playScenes', liveId);
  const pcs = useLive('pcs');
  const mine = pcs.filter((pc) => pc.ownerAccountId === access.accountId).map((pc) => pc.name || 'Unnamed Character');
  const setSelected = useBoardUi((s) => s.setSelected);
  useEffect(() => setSelected([]), [scene?.id, setSelected]);
  return (
    <>
      <TableMusic scene={scene} />
      <Header world={world} scene={scene}>
        <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">{mine.length ? `Playing ${mine.join(', ')}` : 'At the table'}</span>
      </Header>
      <div className="flex min-h-0 flex-1">
        {scene ? (
          <SceneStage key={scene.id} world={world} scene={scene} access={access} panel={false} session onDeleted={() => {}} />
        ) : (
          <main className="flex min-w-0 flex-1 items-center justify-center">
            <Empty title="Waiting For The GM">The GM hasn’t started a scene yet. When they do, it shows here.</Empty>
          </main>
        )}
      </div>
    </>
  );
}

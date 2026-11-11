import { ChevronRightIcon, EyeIcon, EyeOffIcon, Grid3x3Icon, PlusIcon } from 'lucide-react';
import { useEffect, useMemo, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Empty } from '@/components/shared/bits';
import { Hint } from '@/components/shared/Hint';
import { SIDEBAR_ROW, SIDEBAR_ROW_ON } from '@/components/shell/Sidebar';
import { Spaces } from '@/components/shell/Spaces';
import { Button } from '@/components/ui/button';
import { ContextMenuItem } from '@/components/ui/context-menu';
import type { World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useVault } from '@/stores/vault';
import { Board } from '@/tabletop/battlemap/board/Board';
import { currentAccount, useCampaignPeople } from '@/tabletop/battlemap/people';
import { SelectionPicker } from '@/tabletop/battlemap/SelectionPicker';
import { useBoardTokens } from '@/tabletop/battlemap/tokens/hooks';
import { canMove, type BoardAccess } from '@/tabletop/battlemap/tokens/resolve';
import { TokenPanel } from '@/tabletop/battlemap/tokens/TokenPanel';
import { useBoardUi } from '@/tabletop/battlemap/ui';
import { showScene, stopScene, updateSceneMap } from './actions';
import { HandoutStage } from './HandoutStage';
import { usePlayLayout } from './layout';
import type { PlayScene } from './model';
import { NewSceneDialog } from './NewSceneDialog';
import { SceneObjects, VisibilityEye } from './SceneObjects';
import { ScenePanel } from './ScenePanel';
import { usePlayUi } from './ui';
import { useBoardTable, useSpeaker } from '../table/hooks';
import { TurnOrder } from '../table/TurnOrder';
import { useTableRules } from '../table/rules';
import { checkConcentration, concentratorOf } from '../table/apply';

/**
 * Play → Scenes: the workspace both places share. The Play module (main
 * window) is where the GM sets scenes up; Play's own window is where the
 * session happens (Start, the music for the table, the players). Same
 * scenes, same board and panels, from here.
 *
 *   ScenesSidebar    the campaign's scenes (spaces and folders), New Scene; the started one marked Live,
 *                    a shown one Shown; each scene's eye (lit: the players see it) and, folding
 *                    out under it, its tokens, handouts and marks (SceneObjects); a footer at its
 *                    foot (Play's window: the GM's Music and Library)
 *   SceneStage       the board (or a handout open in its place), and beside it (the GM's) the picked
 *                    token or the scene's settings, a dropdown of what's picked at their top
 *   useOpenScene     the scene open: the one picked, else the started one, else the first
 */

export function useOpenScene(world: World): { scenes: PlayScene[]; scene: PlayScene | undefined; liveId: string | null } {
  const { scenes } = usePlayLayout();
  const sceneId = usePlayUi((s) => s.sceneId);
  const liveId = world.tabletop?.live?.sceneId ?? null;
  const scene = scenes.find((s) => s.id === sceneId) ?? scenes.find((s) => s.id === liveId) ?? scenes[0];
  return { scenes, scene, liveId };
}

/** `picked`: the open scene's row shows it's open (not while Music or the Library is in the board's place). */
export function ScenesSidebar({ world, sceneId, picked = true, footer }: { world: World; sceneId: string | undefined; picked?: boolean; footer?: ReactNode }) {
  const { layout, scenes, editable, save } = usePlayLayout();
  const setSceneId = usePlayUi((s) => s.setSceneId);
  const setCreating = usePlayUi((s) => s.setCreating);
  const creating = usePlayUi((s) => s.creating);
  const setTool = useBoardUi((s) => s.setTool);
  const byId = new Map(scenes.map((s) => [s.id, s]));
  const expanded = usePlayUi((s) => s.expanded);
  const setExpanded = usePlayUi((s) => s.setExpanded);
  const live = world.tabletop?.live;
  const me = currentAccount();
  /** What the players see: the started or shown scene. */
  const seen = (s: PlayScene) => live?.sceneId === s.id;
  const setSeen = (s: PlayScene, on: boolean) => (on ? showScene(world, s) : stopScene(world));
  const link = (s: PlayScene) => {
    const open = expanded[s.id] ?? s.id === sceneId;
    const name = s.name || 'Untitled Scene';
    return (
      <>
        <div className={cn(SIDEBAR_ROW, 'gap-1 pr-1 pl-0.5', picked && s.id === sceneId && SIDEBAR_ROW_ON)}>
          <button type="button" aria-label={`${open ? 'Fold' : 'Unfold'} ${name}`} aria-expanded={open} onClick={() => setExpanded(s.id, !open)} className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground">
            <ChevronRightIcon className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
          </button>
          <button type="button" onClick={() => setSceneId(s.id)} aria-current={picked && s.id === sceneId ? 'true' : undefined} className="flex min-h-[30px] min-w-0 flex-1 items-center gap-2 text-left">
            <Grid3x3Icon className="size-4 shrink-0" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate">{name}</span>
            {seen(s) && <span className={cn('shrink-0 rounded-full px-1.5 font-mono text-[9.5px] tracking-wide uppercase', live?.shownOnly ? 'border border-primary text-primary' : 'bg-primary text-primary-foreground')}>{live?.shownOnly ? 'Shown' : 'Live'}</span>}
          </button>
          <VisibilityEye hidden={!seen(s)} shown={seen(s)} label={name} onToggle={() => setSeen(s, !seen(s))} />
        </div>
        {open && <SceneObjects world={world} scene={s} shown={seen(s)} me={me} />}
      </>
    );
  };
  return (
    <>
      <aside aria-label="Scenes" className="flex w-[240px] shrink-0 flex-col gap-3 overflow-y-auto border-r bg-sidebar px-3 py-4 text-sidebar-foreground">
        <div className="flex items-center justify-between gap-2 px-1.5">
          <span className="font-display text-xl font-black tracking-wide uppercase">Scenes</span>
          <Hint label="New Scene">
            <Button variant="ghost" size="icon" aria-label="New Scene" onClick={() => setCreating(true)}>
              <PlusIcon />
            </Button>
          </Hint>
        </div>
        <Spaces
          scope={`${world.id}:play`}
          layout={layout}
          items={byId}
          render={link}
          nameOf={(s) => s.name || 'Untitled Scene'}
          editable={editable}
          noun="scene"
          onChange={save}
          itemMenu={(id) => {
            const s = byId.get(id);
            if (!s) return null;
            return (
              <ContextMenuItem onSelect={() => setSeen(s, !seen(s))}>
                {seen(s) ? <EyeOffIcon /> : <EyeIcon />} {seen(s) ? 'Hide From The Players' : 'Show To The Players'}
              </ContextMenuItem>
            );
          }}
        />
        {footer && <div className="sticky bottom-0 -mx-3 -mb-4 mt-auto border-t bg-sidebar px-3 py-2">{footer}</div>}
      </aside>
      <NewSceneDialog
        worldId={world.id}
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(made) => {
          setCreating(false);
          setSceneId(made.id);
          if (made.image && !made.encounterId) {
            setTool('lineup');
            toast('Line Up The Grid', { description: 'Drag a box over one square of the map, corner to corner. Esc to skip.' });
          }
        }}
      />
    </>
  );
}

/** No scenes yet: a start. */
export function NoScenes() {
  const setCreating = usePlayUi((s) => s.setCreating);
  return (
    <main className="flex min-w-0 flex-1 items-center justify-center">
      <Empty title="No Scenes Yet" action={<Button onClick={() => setCreating(true)}>New Scene</Button>}>
        A scene is a map to play on: from an encounter you prepared in Tabletop (its map, tokens, fog and music come along), or a map of its own.
      </Empty>
    </main>
  );
}

/**
 * The board, and (the GM's, with `panel`) the side panel: the picked token,
 * or the scene's settings, the dropdown of what's picked at its top.
 * `session`: Play's window (once started, ▶ plays music for the table).
 */
export function SceneStage({ world, scene, access, panel, session, onDeleted }: { world: World; scene: PlayScene; access: BoardAccess; panel: boolean; session: boolean; onDeleted: () => void }) {
  const all = useBoardTokens(scene.id);
  // Table Settings: the players see creatures' health bars, or only their own side's.
  const rules = useTableRules(world.id);
  const hpBars = rules.creatureHpBars;
  const views = useMemo(() => (access.gm || hpBars ? all : all.map((v) => (v.token.kind === 'pc' || canMove(access, v) ? v : { ...v, hp: null }))), [all, access, hpBars]);
  const people = useCampaignPeople(world);
  const speaker = useSpeaker(world, access);
  const table = useBoardTable(scene, speaker, access, <TurnOrder scene={scene} views={views} gm={access.gm} speaker={speaker} />);
  const selected = useBoardUi((s) => s.selected);
  const setSelected = useBoardUi((s) => s.setSelected);
  const handoutId = usePlayUi((s) => s.handoutId);
  const setHandoutId = usePlayUi((s) => s.setHandoutId);
  const handout = useVault((s) => (handoutId ? s.vault.handouts[handoutId] : undefined));
  useEffect(() => setSelected([]), [scene.id, setSelected]);
  const pickable = views.filter((v) => canMove(access, v));
  const picked = pickable.filter((v) => selected.includes(v.token.id));
  const board = { ...scene, id: scene.id, worldId: scene.worldId, name: scene.name };
  const header = <SelectionPicker views={pickable} mapLabel="The Scene (Its Settings)" />;
  const open = handout && !handout.deletedAt && handout.sceneId === scene.id && (access.gm || !handout.hidden) ? handout : undefined;
  if (open) return <HandoutStage handout={open} access={access} shown={world.tabletop?.live?.sceneId === scene.id} onBack={() => setHandoutId(null)} />;
  return (
    <>
      <Board board={board} views={views} access={access} onMapChange={(changes) => updateSceneMap(scene.id, changes)} marks={{ worldId: scene.worldId, sceneId: scene.id, onId: scene.id }} table={table} />
      {access.gm && panel && (picked.length ? <TokenPanel views={picked} grid={scene.grid} people={people} links={false} header={header} concentration={rules.concentration} onDamage={(v, n) => checkConcentration(concentratorOf(v), n, speaker)} /> : <ScenePanel world={world} scene={scene} session={session} onDeleted={onDeleted} header={header} />)}
    </>
  );
}

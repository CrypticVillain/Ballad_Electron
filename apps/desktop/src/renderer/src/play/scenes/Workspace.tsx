import { Grid3x3Icon, PlusIcon } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Empty } from '@/components/shared/bits';
import { Hint } from '@/components/shared/Hint';
import { SIDEBAR_ROW, SIDEBAR_ROW_ON } from '@/components/shell/Sidebar';
import { Spaces } from '@/components/shell/Spaces';
import { Button } from '@/components/ui/button';
import type { World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { Board } from '@/tabletop/battlemap/board/Board';
import { useCampaignPeople } from '@/tabletop/battlemap/people';
import { SelectionPicker } from '@/tabletop/battlemap/SelectionPicker';
import { useBoardTokens } from '@/tabletop/battlemap/tokens/hooks';
import { canMove, type BoardAccess } from '@/tabletop/battlemap/tokens/resolve';
import { TokenPanel } from '@/tabletop/battlemap/tokens/TokenPanel';
import { useBoardUi } from '@/tabletop/battlemap/ui';
import { updateSceneMap } from './actions';
import { usePlayLayout } from './layout';
import type { PlayScene } from './model';
import { NewSceneDialog } from './NewSceneDialog';
import { ScenePanel } from './ScenePanel';
import { usePlayUi } from './ui';

/**
 * Play → Scenes: the workspace both places share. The Play module (main
 * window) is where the GM sets scenes up; Play's own window is where the
 * session happens (Start, the music for the table, the players). Same
 * scenes, same board and panels, from here.
 *
 *   ScenesSidebar    the campaign's scenes (spaces and folders), New Scene; the started one marked Live;
 *                    a footer at its foot (Play's window: the GM's Library)
 *   SceneStage       the board, and beside it (the GM's) the picked token or the scene's settings,
 *                    a dropdown of what's picked at their top
 *   useOpenScene     the scene open: the one picked, else the started one, else the first
 */

export function useOpenScene(world: World): { scenes: PlayScene[]; scene: PlayScene | undefined; liveId: string | null } {
  const { scenes } = usePlayLayout();
  const sceneId = usePlayUi((s) => s.sceneId);
  const liveId = world.tabletop?.live?.sceneId ?? null;
  const scene = scenes.find((s) => s.id === sceneId) ?? scenes.find((s) => s.id === liveId) ?? scenes[0];
  return { scenes, scene, liveId };
}

export function ScenesSidebar({ world, sceneId, liveId, footer }: { world: World; sceneId: string | undefined; liveId: string | null; footer?: ReactNode }) {
  const { layout, scenes, editable, save } = usePlayLayout();
  const setSceneId = usePlayUi((s) => s.setSceneId);
  const setCreating = usePlayUi((s) => s.setCreating);
  const creating = usePlayUi((s) => s.creating);
  const setTool = useBoardUi((s) => s.setTool);
  const byId = new Map(scenes.map((s) => [s.id, s]));
  const link = (s: PlayScene) => (
    <button key={s.id} type="button" onClick={() => setSceneId(s.id)} aria-current={s.id === sceneId ? 'true' : undefined} className={cn(SIDEBAR_ROW, s.id === sceneId && SIDEBAR_ROW_ON)}>
      <Grid3x3Icon className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate">{s.name || 'Untitled Scene'}</span>
      {s.id === liveId && <span className="shrink-0 rounded-full bg-primary px-1.5 font-mono text-[9.5px] tracking-wide text-primary-foreground uppercase">Live</span>}
    </button>
  );
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
        <Spaces scope={`${world.id}:play`} layout={layout} items={byId} render={link} nameOf={(s) => s.name || 'Untitled Scene'} editable={editable} noun="scene" onChange={save} />
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
  const views = useBoardTokens(scene.id);
  const people = useCampaignPeople(world);
  const selected = useBoardUi((s) => s.selected);
  const setSelected = useBoardUi((s) => s.setSelected);
  useEffect(() => setSelected([]), [scene.id, setSelected]);
  const pickable = views.filter((v) => canMove(access, v));
  const picked = pickable.filter((v) => selected.includes(v.token.id));
  const board = { ...scene, id: scene.id, worldId: scene.worldId, name: scene.name };
  const header = <SelectionPicker views={pickable} mapLabel="The Scene (Its Settings)" />;
  return (
    <>
      <Board board={board} views={views} access={access} onMapChange={(changes) => updateSceneMap(scene.id, changes)} />
      {access.gm && panel && (picked.length ? <TokenPanel views={picked} grid={scene.grid} people={people} links={false} header={header} /> : <ScenePanel world={world} scene={scene} session={session} onDeleted={onDeleted} header={header} />)}
    </>
  );
}

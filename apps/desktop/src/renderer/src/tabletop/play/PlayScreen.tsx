import { Navigate, useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import { Grid3x3Icon, PanelRightIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Empty } from '@/components/shared/bits';
import { Hint } from '@/components/shared/Hint';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SidebarLink } from '@/components/shell/Sidebar';
import { Spaces } from '@/components/shell/Spaces';
import { confirmDelete } from '@/components/tabletop/Sharing';
import { Button } from '@/components/ui/button';
import { useRecord } from '@/lib/hooks';
import type { World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { GmOnly } from '../common';
import { deletePlayScene } from './actions';
import { Board } from './board/Board';
import { usePlayLayout } from './layout';
import type { PlayScene } from './model';
import { NewSceneDialog } from './NewSceneDialog';
import { ScenePanel } from './ScenePanel';
import { usePlayUi } from './ui';

/**
 * Tabletop → Play (/play, /play/$sceneId): where the table plays. The GM's
 * scenes in the sidebar (spaces and folders, like the other lists), and the
 * open one on the board: its picture and grid, to pan, zoom and measure on,
 * with its settings beside it.
 */

/** /play: the scene last worked on, or a start. */
export function PlayIndex() {
  return (
    <GmOnly>
      {(world) => <PlayIndexOf world={world} />}
    </GmOnly>
  );
}

function PlayIndexOf({ world }: { world: World }) {
  const { scenes } = usePlayLayout();
  const setCreating = usePlayUi((s) => s.setCreating);
  const last = [...scenes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (last) return <Navigate to="/play/$sceneId" params={{ sceneId: last.id }} replace />;
  return (
    <>
      <PlaySidebar world={world} />
      <main className="flex min-w-0 flex-1 items-center justify-center bg-background">
        <Empty title="No Scenes Yet" action={<Button onClick={() => setCreating(true)}>New Scene</Button>}>
          Play at the table: put up a battle map, line its grid up with the map’s squares, and measure moves on it.
        </Empty>
      </main>
    </>
  );
}

/** /play/$sceneId: one scene on the board. */
export function PlayScreen() {
  const { sceneId } = useParams({ from: '/play/$sceneId' });
  const scene = useRecord('playScenes', sceneId);
  return (
    <GmOnly>
      {(world) =>
        !scene || scene.worldId !== world.id ? (
          <Navigate to="/play" replace />
        ) : (
          <>
            <PlaySidebar world={world} />
            <SceneView key={scene.id} scene={scene} />
          </>
        )
      }
    </GmOnly>
  );
}

function SceneView({ scene }: { scene: PlayScene }) {
  const panel = usePlayUi((s) => s.panel);
  const setPanel = usePlayUi((s) => s.setPanel);
  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      <TopBar crumbs={['Play', scene.name || 'Untitled Scene']}>
        <Hint label={panel ? 'Hide Scene Settings' : 'Show Scene Settings'}>
          <Button variant="ghost" size="icon" aria-label="Scene Settings" aria-pressed={panel} onClick={() => setPanel(!panel)} className={cn(panel && 'text-primary')}>
            <PanelRightIcon />
          </Button>
        </Hint>
      </TopBar>
      <div className="flex min-h-0 flex-1">
        <Board scene={scene} />
        {panel && <ScenePanel scene={scene} />}
      </div>
    </main>
  );
}

/** The campaign's scenes, arranged in spaces and folders; New Scene at the top. */
function PlaySidebar({ world }: { world: World }) {
  const navigate = useNavigate();
  const { layout, scenes, editable, save } = usePlayLayout();
  const creating = usePlayUi((s) => s.creating);
  const setCreating = usePlayUi((s) => s.setCreating);
  const setTool = usePlayUi((s) => s.setTool);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const byId = new Map(scenes.map((s) => [s.id, s]));
  const remove = (id: string) => {
    const scene = byId.get(id);
    if (!scene) return;
    confirmDelete({
      noun: 'Scene',
      name: scene.name || 'Untitled Scene',
      area: 'tabletop:play',
      remove: () => deletePlayScene(id),
      after: () => path === `/play/${id}` && void navigate({ to: '/play' }),
    });
  };
  const link = (s: PlayScene) => <SidebarLink key={s.id} to={`/play/${s.id}`} icon={Grid3x3Icon} label={s.name || 'Untitled Scene'} />;
  return (
    <>
      <Sidebar title="Play" addLabel="New Scene" onAdd={() => setCreating(true)}>
        <Spaces scope={`${world.id}:play`} layout={layout} items={byId} render={link} nameOf={(s) => s.name || 'Untitled Scene'} editable={editable} noun="scene" onChange={save} onDelete={remove} />
      </Sidebar>
      <NewSceneDialog
        worldId={world.id}
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(scene) => {
          setCreating(false);
          void navigate({ to: '/play/$sceneId', params: { sceneId: scene.id } });
          // A map's own squares are rarely the grid's default size: offer to line it up straight away.
          if (scene.image) {
            setTool('lineup');
            toast('Line Up The Grid', { description: 'Drag a box over one square of the map, corner to corner. Esc to skip.' });
          }
        }}
      />
    </>
  );
}

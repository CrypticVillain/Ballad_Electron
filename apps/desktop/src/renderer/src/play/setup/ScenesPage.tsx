import { ExternalLinkIcon, PanelRightIcon } from 'lucide-react';
import { Hint } from '@/components/shared/Hint';
import { TopBar } from '@/components/shared/TopBar';
import { Button } from '@/components/ui/button';
import type { World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { currentAccount } from '@/tabletop/battlemap/people';
import { PlayOnly } from '../common';
import { usePlayUi } from '../scenes/ui';
import { NoScenes, SceneStage, ScenesSidebar, useOpenScene } from '../scenes/Workspace';

/**
 * Play → Scenes (/scenes): where the GM sets up the table ahead of the session.
 * Everything Play's window has for a scene (new scenes, from an encounter or a
 * map; the board with every tool, fog included; tokens; the scene's music),
 * on your own campaign, with no one else at the table. Open Play starts the
 * session in its own window (online: where it connects).
 */
export function ScenesPage() {
  return <PlayOnly>{(world) => <Setup world={world} />}</PlayOnly>;
}

function Setup({ world }: { world: World }) {
  const { scene } = useOpenScene(world);
  const panel = usePlayUi((s) => s.panel);
  const setPanel = usePlayUi((s) => s.setPanel);
  const setSceneId = usePlayUi((s) => s.setSceneId);
  const access = { gm: true, accountId: currentAccount() };
  return (
    <>
      <ScenesSidebar world={world} sceneId={scene?.id} />
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Play', 'Scenes', ...(scene ? [scene.name || 'Untitled Scene'] : [])]}>
          <Hint label="Play the session in its own window">
            <Button size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => void window.api.table.open(currentAccount(), world.id)}>
              <ExternalLinkIcon /> Open Play
            </Button>
          </Hint>
          <Hint label={panel ? 'Hide Settings' : 'Show Settings'}>
            <Button variant="ghost" size="icon" aria-label="Scene Settings" aria-pressed={panel} onClick={() => setPanel(!panel)} className={cn(panel && 'text-primary')}>
              <PanelRightIcon />
            </Button>
          </Hint>
        </TopBar>
        <div className="flex min-h-0 flex-1">{scene ? <SceneStage key={scene.id} world={world} scene={scene} access={access} panel={panel} session={false} onDeleted={() => setSceneId(null)} /> : <NoScenes />}</div>
      </main>
    </>
  );
}

import { Navigate, useNavigate } from '@tanstack/react-router';
import { ExternalLinkIcon, PanelRightIcon, SwordsIcon } from 'lucide-react';
import { Empty } from '@/components/shared/bits';
import { Hint } from '@/components/shared/Hint';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Button } from '@/components/ui/button';
import { makeCampaign, openWorld } from '@/lib/actions';
import { useSection, useSectionWorlds, useWorld } from '@/lib/hooks';
import type { World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { currentAccount } from '@/tabletop/battlemap/people';
import { useCampaigns } from '@/tabletop/members/campaigns';
import { usePlayUi } from '../scenes/ui';
import { TableSettingsRow } from '../table/TableSettings';
import { NoScenes, SceneStage, ScenesSidebar, useOpenScene } from '../scenes/Workspace';

/**
 * Play → Scenes (/scenes): where the GM sets up the table ahead of the session.
 * Everything Play's window has for a scene (new scenes, from an encounter or a
 * map; the board with every tool, fog included; tokens; the scene's music),
 * on a campaign you run (picked at the top), with no one else at the table.
 * Open Play starts the session in its own window (online: where it
 * connects). An account that runs no campaign (a player's) is told how to
 * get one.
 */
export function ScenesPage() {
  const section = useSection();
  const world = useWorld();
  if (section !== 'play') return <Navigate to="/" replace />;
  return world ? <Setup world={world} /> : <NoCampaign />;
}

/** No campaign of your own: scenes are a GM's, so make one (or play in someone else's, from Home). */
function NoCampaign() {
  const navigate = useNavigate();
  const joined = useCampaigns().filter((c) => c.gm);
  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      <TopBar crumbs={['Play', 'Scenes']} />
      <div className="flex flex-1 items-center justify-center">
        <Empty
          title="Run A Campaign First"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={makeCampaign}>
                <SwordsIcon /> Make A Campaign In Tabletop
              </Button>
              {joined.length > 0 && (
                <Button variant="outline" onClick={() => void navigate({ to: '/' })}>
                  Go To Play’s Home
                </Button>
              )}
            </div>
          }
        >
          Scenes are set up by a campaign’s GM, and you don’t run one yet. Make a campaign in Tabletop (it switches to GM view: you’re its GM), then come back here to build its scenes.
          {joined.length > 0 && ` In ${joined.map((c) => c.name).join(' and ')}, the GM’s scenes show in Play’s window: open it from Play’s Home.`}
        </Empty>
      </div>
    </main>
  );
}

function Setup({ world }: { world: World }) {
  const { scene } = useOpenScene(world);
  const panel = usePlayUi((s) => s.panel);
  const setPanel = usePlayUi((s) => s.setPanel);
  const setSceneId = usePlayUi((s) => s.setSceneId);
  const campaigns = useSectionWorlds();
  const access = { gm: true, accountId: currentAccount() };
  return (
    <>
      <ScenesSidebar world={world} sceneId={scene?.id} footer={<TableSettingsRow world={world} />} />
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Play', 'Scenes', ...(scene ? [scene.name || 'Untitled Scene'] : [])]}>
          {/* Which of your campaigns these scenes are for: new scenes go to it. */}
          <SelectField
            label="Campaign"
            value={world.id}
            options={campaigns.map((w) => ({ value: w.id, label: w.name || 'Untitled Campaign' }))}
            onChange={(id) => {
              setSceneId(null);
              openWorld(id, currentAccount(), 'play');
            }}
            className="h-8 w-56 text-[12.5px]"
          />
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

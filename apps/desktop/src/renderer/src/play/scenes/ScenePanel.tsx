import { Trash2Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Field, FIELD } from '@/components/shared/Field';
import { confirmDelete } from '@/components/tabletop/Sharing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { World } from '@/lib/model';
import { MapPanel, PanelSection } from '@/tabletop/battlemap/MapPanel';
import { MusicPicker } from '@/tabletop/music/MusicPicker';
import { deletePlayScene, playTrack, updatePlayScene, updateSceneMap } from './actions';
import type { PlayScene } from './model';

/**
 * Play → Scenes: a scene's settings, beside the board (the GM's). Its name;
 * its music (from the Library: each track plays when the scene starts or by
 * hand; in a session, once it's started, ▶ plays one for the table, else it
 * lets you listen); the map's settings (tabletop/battlemap: grid, measuring,
 * fog, picture); and Delete.
 */
export function ScenePanel({ world, scene, session, onDeleted, header }: { world: World; scene: PlayScene; session: boolean; onDeleted: () => void; header?: ReactNode }) {
  const live = session && world.tabletop?.live?.sceneId === scene.id;
  const remove = () =>
    confirmDelete({
      noun: 'Scene',
      name: scene.name || 'Untitled Scene',
      area: 'play:scenes',
      remove: () => deletePlayScene(scene.id),
      after: onDeleted,
    });
  return (
    <MapPanel
      map={scene}
      onChange={(changes) => updateSceneMap(scene.id, changes)}
      label="Scene settings"
      header={header}
      footer={
        <div className="mt-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={remove} className="w-full text-destructive hover:text-destructive">
            <Trash2Icon /> Delete Scene
          </Button>
        </div>
      }
    >
      <PanelSection title="Scene">
        <Field label="Name">
          <Input value={scene.name} maxLength={80} onChange={(e) => updatePlayScene(scene.id, { name: e.target.value })} className={FIELD} />
        </Field>
      </PanelSection>
      <PanelSection title="Music">
        <MusicPicker music={scene.music} onChange={(music) => updatePlayScene(scene.id, { music })} onPlay={live ? (trackId) => playTrack(scene.id, trackId) : undefined} playing={live ? (scene.nowPlaying?.trackId ?? null) : undefined} />
        {!live && <p className="text-[12px] text-muted-foreground">{session ? 'Start the scene to play music for the table; until then ▶ lets you listen.' : 'In a session (Open Play), the scene’s music plays for the table; here ▶ lets you listen.'}</p>}
      </PanelSection>
    </MapPanel>
  );
}

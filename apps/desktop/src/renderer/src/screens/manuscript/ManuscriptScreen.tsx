import { Navigate, useNavigate, useParams } from '@tanstack/react-router';
import { MaximizeIcon, MinimizeIcon } from 'lucide-react';
import { useMemo } from 'react';
import { ManuscriptEditor } from '@/components/editor/ManuscriptEditor';
import { Empty } from '@/components/shared/bits';
import { TopBar } from '@/components/shared/TopBar';
import { Button } from '@/components/ui/button';
import { startBook, updateScene } from '@/lib/actions';
import { useBooks, useLive, useRecord, useWorld } from '@/lib/hooks';
import { byOrder } from '@/lib/model';
import { roman } from '@/lib/text';
import { cn } from '@/lib/utils';
import { useUi } from '@/stores/ui';
import { Binder } from './Binder';
import { ScenePanel } from './ScenePanel';

/** /manuscript: opens the scene you last worked on in the open world. */
export function ManuscriptIndex() {
  const world = useWorld();
  const books = useBooks();
  const scenes = useLive('scenes');
  const navigate = useNavigate();
  const last = useMemo(() => {
    const ids = new Set(books.map((b) => b.id));
    return scenes.filter((s) => ids.has(s.bookId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }, [books, scenes]);

  if (last) return <Navigate to="/manuscript/$sceneId" params={{ sceneId: last.id }} replace />;
  return (
    <main className="flex min-w-0 flex-1 items-center justify-center bg-background">
      <Empty
        title="No Book Yet"
        action={
          world && (
            <Button onClick={() => void navigate({ to: '/manuscript/$sceneId', params: { sceneId: startBook(world.id).id } })}>
              Start A Book
            </Button>
          )
        }
      >
        {world ? `Start the first book in ${world.name}.` : 'Make a world first, from World Home.'}
      </Empty>
    </main>
  );
}

/**
 * /manuscript/$sceneId — writing a scene: the binder (acts and scenes) on the
 * left, the scene's prose in the middle, the scene panel (POV, place, goal,
 * who's in it, a note) on the right. Focus mode (Ctrl+Shift+F) leaves only
 * the prose.
 */
export function ManuscriptScreen() {
  const { sceneId } = useParams({ from: '/manuscript/$sceneId' });
  const scene = useRecord('scenes', sceneId);
  const book = useRecord('books', scene?.bookId);
  const part = useRecord('parts', scene?.partId);
  const pov = useRecord('entries', scene?.povId);
  const world = useWorld();
  const focus = useUi((s) => s.focus);
  const parts = useLive('parts');
  const scenes = useLive('scenes');

  if (!scene || !book || !part || !world) return <Navigate to="/manuscript" replace />;

  const partNumber = parts.filter((p) => p.bookId === book.id).sort(byOrder).findIndex((p) => p.id === part.id) + 1;
  const sceneNumber = scenes.filter((s) => s.partId === part.id).sort(byOrder).findIndex((s) => s.id === scene.id) + 1;

  return (
    <>
      {!focus && <Binder book={book} sceneId={scene.id} />}
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={[book.title || 'Untitled Book', `${book.partNoun} ${roman(partNumber)}`, `Scene ${sceneNumber}`]}>
          <Button variant="outline" size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => useUi.getState().setFocus(!focus)}>
            {focus ? <MinimizeIcon /> : <MaximizeIcon />}
            {focus ? 'Leave Focus' : 'Focus'}
          </Button>
        </TopBar>
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto" data-selectable>
            <article className={cn('mx-auto flex w-full max-w-[700px] flex-col gap-4 px-12 pt-10 pb-32', focus && 'max-w-[760px] pt-16')}>
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[11.5px] tracking-[0.08em] text-link uppercase">
                  {book.partNoun} {roman(partNumber)} · Scene {sceneNumber}
                  {pov && ` · POV ${pov.name.split(' ')[0]}`}
                </span>
                <input
                  aria-label="Scene title"
                  value={scene.title}
                  placeholder="UNTITLED SCENE"
                  onChange={(e) => updateScene(scene.id, { title: e.target.value })}
                  className="w-full bg-transparent font-display text-[40px] leading-[1.05] font-black uppercase outline-none placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="-mx-[54px]">
                <ManuscriptEditor key={scene.id} scene={scene} worldId={world.id} />
              </div>
            </article>
          </div>
          {!focus && <ScenePanel scene={scene} />}
        </div>
      </main>
    </>
  );
}

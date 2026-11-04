import { Navigate, useNavigate, useParams } from '@tanstack/react-router';
import { MaximizeIcon, MinimizeIcon } from 'lucide-react';
import { useMemo } from 'react';
import { ManuscriptEditor } from '@/components/editor/ManuscriptEditor';
import { Empty } from '@/components/shared/bits';
import { TopBar } from '@/components/shared/TopBar';
import { Button } from '@/components/ui/button';
import { startBook, updateScene } from '@/lib/actions';
import { useBooks, useCharacter, useLive, useRecord, useRole, useSection, useSectionInfo, useWorld } from '@/lib/hooks';
import { byOrder, type Book, type Entry, type Part, type Scene, type Section, type World } from '@/lib/model';
import { JOURNAL, SECTION_INFO } from '@/lib/sections';
import { roman } from '@/lib/text';
import { cn } from '@/lib/utils';
import { useUi } from '@/stores/ui';
import { Binder } from './Binder';
import { NOTE_INFO } from './notes';
import { ScenePanel, useSessionNumber } from './ScenePanel';
import { ManuscriptTools, useAutoRevision, useEditorKey } from '@/writing/manuscript/ManuscriptTools';
import { ScriptTools } from '@/film/script/ScriptTools';

/** /manuscript: opens the scene (script scene, session, journal entry) you last worked on in the open world. */
export function ManuscriptIndex() {
  const world = useWorld();
  const info = useSectionInfo();
  const journal = useRole() === 'player';
  const character = useCharacter();
  const books = useBooks();
  const scenes = useLive('scenes');
  const navigate = useNavigate();
  const last = useMemo(() => {
    const ids = new Set(books.map((b) => b.id));
    return scenes.filter((s) => ids.has(s.bookId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }, [books, scenes]);

  if (last) return <Navigate to="/manuscript/$sceneId" params={{ sceneId: last.id }} replace />;
  if (journal) {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center bg-background">
        <Empty
          title="No Journal Yet"
          action={
            character ? (
              <Button onClick={() => void navigate({ to: '/manuscript/$sceneId', params: { sceneId: startBook('', { ...JOURNAL, characterId: character.id }).id } })}>Start {character.name ? `${character.name.split(' ')[0]}’s` : 'Your'} Journal</Button>
            ) : (
              <Button onClick={() => void navigate({ to: '/' })}>Make A Character First</Button>
            )
          }
        >
          Your character’s own notes of each session: what happened, who they met, what they’re after. Kept with the character, apart from the DM’s session log.
        </Empty>
      </main>
    );
  }
  return (
    <main className="flex min-w-0 flex-1 items-center justify-center bg-background">
      <Empty
        title={`No ${info.book.title} Yet`}
        action={
          world && <Button onClick={() => void navigate({ to: '/manuscript/$sceneId', params: { sceneId: startBook(world.id).id } })}>Start {world.section === 'writing' ? 'A Book' : `The ${info.book.title}`}</Button>
        }
      >
        {world ? `Start the first ${info.book.title.toLowerCase()} in ${world.name}.` : `Make a ${info.container.toLowerCase()} first, from Home.`}
      </Empty>
    </main>
  );
}

/**
 * /manuscript/$sceneId — writing a scene (a script's scene, a session's
 * notes): the binder on the left, the text in the middle, the scene panel on
 * the right. Focus mode (Ctrl+Shift+F) leaves only the text.
 */
export function ManuscriptScreen() {
  const { sceneId } = useParams({ from: '/manuscript/$sceneId' });
  const scene = useRecord('scenes', sceneId);
  const book = useRecord('books', scene?.bookId);
  const part = useRecord('parts', scene?.partId);
  const pov = useRecord('entries', scene?.povId);
  const world = useWorld();
  const section = useSection();
  const books = useBooks();
  const focus = useUi((s) => s.focus);
  const parts = useLive('parts');
  const scenes = useLive('scenes');

  // A scene of another world (or section, or the other D&D view's book) than the open one: back to this one's. (A
  // player's journal needs no campaign; a D&D note sits in no part.)
  const note = scene?.kind === 'note';
  if (!scene || !book || (!part && !note) || !books.some((b) => b.id === book.id)) return <Navigate to="/manuscript" replace />;
  return <Writing key={scene.id} scene={scene} book={book} part={part} pov={pov} world={world} section={section} focus={focus} parts={parts} scenes={scenes} />;
}

function Writing({
  scene,
  book,
  part,
  pov,
  world,
  section,
  focus,
  parts,
  scenes,
}: {
  scene: Scene;
  book: Book;
  part: Part | undefined;
  pov: Entry | undefined;
  world: World | undefined;
  section: Section;
  focus: boolean;
  parts: Part[];
  scenes: Scene[];
}) {
  const info = SECTION_INFO[section];
  // A player's journal is made of entries (a session, as they saw it).
  const sceneNoun = book.audience === 'player' ? 'Entry' : info.scene;
  const session = useSessionNumber(scene);
  const note = scene.kind === 'note' ? NOTE_INFO[scene.category ?? 'general'] : null;
  const partNumber = part ? parts.filter((p) => p.bookId === book.id).sort(byOrder).findIndex((p) => p.id === part.id) + 1 : 0;
  const sceneNumber = section === 'dnd' ? session : scenes.filter((s) => s.partId === part?.id).sort(byOrder).findIndex((s) => s.id === scene.id) + 1;
  // A Writing scene's own tools (writing/manuscript): history, comments, export.
  const writing = section === 'writing' && !note && Boolean(world);
  useAutoRevision(scene, writing);
  const editorKey = useEditorKey(scene.id);
  const crumbs = note ? [book.title || `Untitled ${info.book.title}`, 'Notes', note.label] : [book.title || `Untitled ${info.book.title}`, `${book.partNoun} ${roman(partNumber)}`, `${sceneNoun} ${sceneNumber}`];

  return (
    <>
      {!focus && <Binder book={book} sceneId={scene.id} />}
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={crumbs}>
          {writing && world && !focus && <ManuscriptTools scene={scene} book={book} world={world} />}
          {section === 'film' && world && !focus && <ScriptTools scene={scene} book={book} world={world} />}
          <Button variant="outline" size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => useUi.getState().setFocus(!focus)}>
            {focus ? <MinimizeIcon /> : <MaximizeIcon />}
            {focus ? 'Leave Focus' : 'Focus'}
          </Button>
        </TopBar>
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto" data-selectable>
            <article className={cn('mx-auto flex w-full max-w-[700px] flex-col gap-4 px-12 pt-10 pb-32', focus && 'max-w-[760px] pt-16', section === 'film' && 'max-w-[760px]')}>
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[11.5px] tracking-[0.08em] text-link uppercase">
                  {note ? (
                    <>
                      {note.label}
                      {scene.pinned && ' · Pinned'}
                    </>
                  ) : (
                    <>
                      {book.partNoun} {roman(partNumber)} · {sceneNoun} {sceneNumber}
                      {pov && section === 'writing' && ` · POV ${pov.name.split(' ')[0]}`}
                      {scene.when && section !== 'writing' && ` · ${scene.when}`}
                    </>
                  )}
                </span>
                {/* Wraps instead of scrolling sideways; Enter goes to the text. */}
                <textarea
                  aria-label={`${note ? 'Note' : sceneNoun} title`}
                  rows={1}
                  value={scene.title}
                  placeholder={`UNTITLED ${(note?.label ?? sceneNoun).toUpperCase()}`}
                  onChange={(e) => updateScene(scene.id, { title: e.target.value.replace(/\n/g, ' ') })}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    document.querySelector<HTMLElement>('.bn-editor')?.focus();
                  }}
                  className="field-sizing-content w-full resize-none overflow-hidden bg-transparent font-display text-[40px] leading-[1.05] font-black uppercase outline-none placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="-mx-[54px]">
                <ManuscriptEditor key={`${scene.id}:${editorKey}`} scene={scene} worldId={world?.id ?? ''} section={section} placeholder={note ? `${note.placeholder} @ names an NPC or place; / makes a checklist or a heading.` : undefined} />
              </div>
            </article>
          </div>
          {!focus && <ScenePanel scene={scene} section={section} />}
        </div>
      </main>
    </>
  );
}

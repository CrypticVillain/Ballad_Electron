import { Link, Navigate, useNavigate, useParams } from '@tanstack/react-router';
import { PenLineIcon, PlusIcon } from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { PillTabs } from '@/components/shared/bits';
import { TopBar } from '@/components/shared/TopBar';
import { Button } from '@/components/ui/button';
import { createScene, placeScene, updateScene } from '@/lib/actions';
import { useBooks, useLive, useRecord, useSection } from '@/lib/hooks';
import { byOrder, type Book, type Entry, type Part, type Scene } from '@/lib/model';
import { SECTION_INFO } from '@/lib/sections';
import { formatWords, roman } from '@/lib/text';
import { cn } from '@/lib/utils';
import { Binder, StatusLed } from '@/screens/manuscript/Binder';

/**
 * /corkboard/$bookId — a book (or a script) at a glance: its acts, each a row
 * of index cards, one per scene, with its number, status, title, the note
 * beside it (its summary), POV and place. Type on a card to change its title
 * or note, drag a card before another (or to an act's New Scene card, for its
 * end) to move it. Outline lays the same out as a table, act by act.
 */

type View = 'cards' | 'outline';
const VIEWS: { value: View; label: string }[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'outline', label: 'Outline' },
];

/** The view picked last (kept in this browser only: a convenience). */
const remembered = (): View => {
  try {
    return localStorage.getItem('ballad:corkboard') === 'outline' ? 'outline' : 'cards';
  } catch {
    return 'cards';
  }
};

export function CorkboardScreen() {
  const { bookId } = useParams({ from: '/corkboard/$bookId' });
  const book = useRecord('books', bookId);
  const books = useBooks();
  if (!book || !books.some((b) => b.id === book.id)) return <Navigate to="/manuscript" replace />;
  return <Corkboard key={book.id} book={book} />;
}

function Corkboard({ book }: { book: Book }) {
  const section = useSection();
  const info = SECTION_INFO[section];
  const navigate = useNavigate();
  const allParts = useLive('parts');
  const allScenes = useLive('scenes');
  const entries = useLive('entries');
  const [view, setView] = useState<View>(remembered);
  const pick = (v: View) => {
    setView(v);
    try {
      localStorage.setItem('ballad:corkboard', v);
    } catch {
      // Only a convenience.
    }
  };

  const parts = useMemo(() => allParts.filter((p) => p.bookId === book.id).sort(byOrder), [allParts, book.id]);
  const scenesOf = (partId: string) => allScenes.filter((s) => s.partId === partId && s.kind !== 'note').sort(byOrder);
  const names = useMemo(() => new Map(entries.map((e: Entry) => [e.id, e.name || 'Untitled'])), [entries]);
  // The binder marks the scene worked on last.
  const last = useMemo(() => allScenes.filter((s) => s.bookId === book.id && s.kind !== 'note').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0], [allScenes, book.id]);

  // ── Dragging a card: before another, or to an act's end ──
  const dragging = useRef<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const target = (key: string, drop: (id: string) => void) => ({
    onDragOver: (e: DragEvent) => {
      if (!dragging.current || dragging.current === key) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (over !== key) setOver(key);
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === key ? null : o));
    },
    onDrop: (e: DragEvent) => {
      const id = dragging.current;
      if (!id) return;
      e.preventDefault();
      drop(id);
      dragging.current = null;
      setOver(null);
    },
  });
  const drag = (id: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      dragging.current = id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/x-ballad-card', id);
    },
    onDragEnd: () => {
      dragging.current = null;
      setOver(null);
    },
  });

  const open = (scene: Scene) => void navigate({ to: '/manuscript/$sceneId', params: { sceneId: scene.id } });
  const sceneWord = info.scene;

  return (
    <>
      <Binder book={book} sceneId={last?.id ?? ''} />
      <main data-surface="page" className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={[book.title || `Untitled ${info.book.title}`, view === 'cards' ? 'Corkboard' : 'Outline']}>
          <PillTabs label="View" value={view} options={VIEWS} onChange={pick} />
          {last && (
            <Button variant="outline" size="sm" onClick={() => open(last)}>
              <PenLineIcon /> Write
            </Button>
          )}
        </TopBar>
        <div className="min-h-0 flex-1 overflow-y-auto" data-selectable>
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-8 pt-6 pb-24">
            {parts.map((part, index) => {
              const scenes = scenesOf(part.id);
              const heading = `${book.partNoun} ${roman(index + 1)}${part.title ? ` · ${part.title}` : ''}`;
              const words = scenes.reduce((n, s) => n + s.words, 0);
              return (
                <section key={part.id} aria-label={heading} className="flex flex-col gap-3">
                  <header {...target(`act:${part.id}`, (id) => placeScene(id, part.id, null))} className={cn('flex items-baseline gap-3 border-b pb-1.5', over === `act:${part.id}` && 'border-primary')}>
                    <h2 className="font-display text-lg font-black uppercase">{heading}</h2>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {scenes.length} {scenes.length === 1 ? sceneWord.toLowerCase() : `${sceneWord.toLowerCase()}s`} · {formatWords(words, true)}
                    </span>
                  </header>
                  {view === 'cards' ? (
                    <ol className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                      {scenes.map((scene, i) => (
                        <li key={scene.id} {...drag(scene.id)} {...target(scene.id, (id) => placeScene(id, part.id, scene.id))} className={cn('rounded-lg', over === scene.id && 'shadow-[-3px_0_0_var(--color-primary)]')}>
                          <Card scene={scene} number={i + 1} noun={sceneWord} pov={scene.povId ? names.get(scene.povId) : undefined} place={scene.placeId ? names.get(scene.placeId) : undefined} />
                        </li>
                      ))}
                      <li {...target(`end:${part.id}`, (id) => placeScene(id, part.id, null))}>
                        <button
                          type="button"
                          onClick={() => createScene(book.id, part.id)}
                          className={cn('flex size-full min-h-[168px] items-center justify-center gap-1.5 rounded-lg border border-dashed text-[13px] text-muted-foreground hover:bg-muted/40 hover:text-foreground', over === `end:${part.id}` && 'border-primary bg-primary/10')}
                        >
                          <PlusIcon className="size-4" /> New {sceneWord}
                        </button>
                      </li>
                    </ol>
                  ) : (
                    <Outline part={part} scenes={scenes} noun={sceneWord} names={names} status={info.status} onAdd={() => createScene(book.id, part.id)} />
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}

/** A scene's index card: its number, status and words; its title and note to type in; who and where. */
function Card({ scene, number, noun, pov, place }: { scene: Scene; number: number; noun: string; pov?: string; place?: string }) {
  return (
    <article aria-label={`${noun} ${number}`} className="flex h-full min-h-[168px] cursor-grab flex-col gap-1.5 rounded-lg border bg-card p-3 shadow-xs active:cursor-grabbing">
      <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
        <span>{number}</span>
        <StatusLed status={scene.status} />
        <span className="ml-auto">{scene.words ? formatWords(scene.words) : ''}</span>
      </div>
      <input
        aria-label={`${noun} ${number} title`}
        value={scene.title}
        placeholder={`Untitled ${noun}`}
        onChange={(e) => updateScene(scene.id, { title: e.target.value })}
        className="w-full bg-transparent text-[14px] font-semibold outline-none placeholder:text-muted-foreground/50"
      />
      <textarea
        aria-label={`${noun} ${number} note`}
        value={scene.note}
        placeholder="What happens…"
        onChange={(e) => updateScene(scene.id, { note: e.target.value })}
        className="min-h-[64px] w-full flex-1 resize-none bg-transparent font-serif text-[13px] leading-snug text-muted-foreground outline-none placeholder:text-muted-foreground/40"
      />
      <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
        <span className="min-w-0 flex-1 truncate">{[pov, place].filter(Boolean).join(' · ')}</span>
        <Link to="/manuscript/$sceneId" params={{ sceneId: scene.id }} className="shrink-0 text-link hover:underline">
          Open
        </Link>
      </div>
    </article>
  );
}

/** The outline: an act's scenes as rows. */
function Outline({ part, scenes, noun, names, status, onAdd }: { part: Part; scenes: Scene[]; noun: string; names: Map<string, string>; status: Record<Scene['status'], string>; onAdd: () => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table aria-label={`${part.title || 'Act'} outline`} className="w-full text-left text-[13px]">
        <thead className="bg-muted/40 font-mono text-[10.5px] tracking-[0.06em] text-muted-foreground uppercase">
          <tr>
            <th className="w-10 px-3 py-2 font-normal">#</th>
            <th className="px-3 py-2 font-normal">{noun}</th>
            <th className="px-3 py-2 font-normal">POV</th>
            <th className="px-3 py-2 font-normal">Place</th>
            <th className="px-3 py-2 font-normal">Status</th>
            <th className="px-3 py-2 text-right font-normal">Words</th>
            <th className="w-[36%] px-3 py-2 font-normal">Note</th>
          </tr>
        </thead>
        <tbody>
          {scenes.map((scene, i) => (
            <tr key={scene.id} className="border-t align-top">
              <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-2">
                <Link to="/manuscript/$sceneId" params={{ sceneId: scene.id }} className="font-medium hover:underline">
                  {scene.title || `Untitled ${noun}`}
                </Link>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{(scene.povId && names.get(scene.povId)) || '–'}</td>
              <td className="px-3 py-2 text-muted-foreground">{(scene.placeId && names.get(scene.placeId)) || '–'}</td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <StatusLed status={scene.status} /> {status[scene.status]}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-mono text-[11.5px] tabular-nums">{scene.words ? formatWords(scene.words) : '–'}</td>
              <td className="px-3 py-2 font-serif text-muted-foreground">{scene.note}</td>
            </tr>
          ))}
          <tr className="border-t">
            <td colSpan={7} className="px-1.5 py-1">
              <Button variant="ghost" size="sm" onClick={onAdd} className="font-normal text-muted-foreground">
                <PlusIcon /> New {noun}
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}


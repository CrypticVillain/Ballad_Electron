import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronRightIcon, PinIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Label, Led, ProgressBar } from '@/components/shared/bits';
import { FIELD } from '@/components/shared/Field';
import { SelectField } from '@/components/shared/SelectField';
import { SIDEBAR_ROW, SIDEBAR_ROW_ON, Sidebar } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { createNote, createPart, createScene, moveScene, restore, shift, startBook, trash, trashPart, updateBook, updatePart, updateScene } from '@/lib/actions';
import { relativeTime } from '@/lib/dates';
import { useBooks, useLive, useRole, useSection } from '@/lib/hooks';
import { byOrder, NOTE_CATEGORIES, PART_NOUNS, SCENE_STATUSES, type Book, type NoteCategory, type Part, type Scene, type SceneStatus, type Section } from '@/lib/model';
import { JOURNAL, SECTION_INFO } from '@/lib/sections';
import { formatWords, roman } from '@/lib/text';
import { cn } from '@/lib/utils';
import { NOTE_INFO } from './notes';

/** A scene's status in a section's words (a script's Done is Locked, a session's Played). */
export const statusLabel = (status: SceneStatus, section: Section) => SECTION_INFO[section].status[status];

/** A scene's status as a light: done green, drafting orange, the rest off. */
export function StatusLed({ status }: { status: SceneStatus }) {
  return <Led tone={status === 'done' ? 'online' : status === 'draft' ? 'accent' : 'off'} />;
}

/**
 * Binder — the manuscript's sidebar (a script's, a session log's): the book
 * you're in (switch or start another), its acts and their scenes in order,
 * each with its status light and word count. Right-click an act or a scene to
 * rename, reorder, move or delete it. The card at the bottom is the book's
 * own: title, what its parts are called, and progress toward its word goal.
 */
export function Binder({ book, sceneId }: { book: Book; sceneId: string }) {
  const navigate = useNavigate();
  const section = useSection();
  const info = SECTION_INFO[section];
  const STATUS_LABEL = info.status;
  // A player's binder is their journal, apart from the DM's session log.
  const journal = useRole() === 'player';
  const newBook = journal ? 'New Journal' : section === 'writing' ? 'New Book' : `New ${info.book.title}`;
  const books = useBooks();
  const allParts = useLive('parts');
  const allScenes = useLive('scenes');
  const [renaming, setRenaming] = useState<string | null>(null);

  const parts = useMemo(() => allParts.filter((p) => p.bookId === book.id).sort(byOrder), [allParts, book.id]);
  const scenesOf = (partId: string) => allScenes.filter((s) => s.partId === partId).sort(byOrder);
  const words = allScenes.filter((s) => s.bookId === book.id).reduce((sum, s) => sum + s.words, 0);
  const current = allScenes.find((s) => s.id === sceneId);
  // D&D books keep notes beside the sessions: one tab each.
  const dnd = section === 'dnd';
  const [tab, setTab] = useState<'sessions' | 'notes'>(current?.kind === 'note' ? 'notes' : 'sessions');
  useEffect(() => {
    if (current) setTab(current.kind === 'note' ? 'notes' : 'sessions');
  }, [current?.id, current?.kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const notes = useMemo(() => allScenes.filter((s) => s.bookId === book.id && s.kind === 'note'), [allScenes, book.id]);
  const sessionCount = allScenes.filter((s) => s.bookId === book.id && s.kind !== 'note').length;

  const open = (scene: Scene) => void navigate({ to: '/manuscript/$sceneId', params: { sceneId: scene.id } });
  const addScene = (partId: string) => open(createScene(book.id, partId));
  const addNote = (category?: NoteCategory) => open(createNote(book.id, category ? { category } : {}));
  const addPart = () => {
    const part = createPart(book.id);
    setRenaming(part.id);
    open(createScene(book.id, part.id));
  };

  const deleteScene = (scene: Scene) => {
    const siblings = allScenes.filter((s) => s.bookId === book.id && s.id !== scene.id);
    trash('scenes', scene.id);
    if (scene.id === sceneId) {
      const next = siblings.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (next) open(next);
      else void navigate({ to: '/manuscript' });
    }
    toast(`${info.scene} Deleted`, { description: scene.title || `Untitled ${info.scene}`, action: { label: 'Undo', onClick: () => restore('scenes', scene.id) } });
  };

  const deletePart = (part: Part, number: number) => {
    const scenes = trashPart(part.id);
    if (current?.partId === part.id) void navigate({ to: '/manuscript' });
    toast(`${book.partNoun} Deleted`, {
      description: `${book.partNoun} ${roman(number)}${scenes.length ? ` and its ${scenes.length} ${scenes.length === 1 ? 'scene' : 'scenes'}` : ''}`,
      action: {
        label: 'Undo',
        onClick: () => {
          restore('parts', part.id);
          for (const id of scenes) restore('scenes', id);
        },
      },
    });
  };

  return (
    <Sidebar
      title={journal ? JOURNAL.title : info.binder}
      addLabel={dnd && tab === 'notes' ? 'New Note (Ctrl+N)' : `New ${info.scene} (Ctrl+N)`}
      onAdd={() => {
        if (dnd && tab === 'notes') return addNote();
        const partId = current?.partId || parts.at(-1)?.id;
        if (partId) addScene(partId);
      }}
      footer={<BookCard book={book} words={words} section={section} journal={journal} />}
    >
      <SelectField
        label="Book"
        value={book.id}
        onChange={(id) => {
          if (id === '__new') {
            open(startBook(book.worldId, journal ? { ...JOURNAL, characterId: book.characterId } : undefined));
            return;
          }
          const first = allParts.filter((p) => p.bookId === id).sort(byOrder).flatMap((p) => scenesOf(p.id))[0];
          if (first) open(first);
        }}
        options={[...books.map((b) => ({ value: b.id, label: b.title || 'Untitled Book' })), { value: '__new', label: `+ ${newBook}` }]}
        className="h-[34px] text-[13px]"
      />

      {dnd && (
        <div role="tablist" aria-label="Sessions or notes" className="-mt-1 flex rounded-lg border bg-background p-0.5">
          {(
            [
              ['sessions', `${info.scene}s`, sessionCount],
              ['notes', 'Notes', notes.length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-[12.5px] text-muted-foreground hover:text-foreground', tab === value && 'bg-muted font-medium text-foreground')}
            >
              {label} <span className="font-mono text-[10.5px] text-muted-foreground">{count}</span>
            </button>
          ))}
        </div>
      )}

      {dnd && tab === 'notes' ? (
        <NotesList notes={notes} sceneId={sceneId} onAdd={addNote} />
      ) : (
      <>
      <div className="flex flex-col gap-1">
        {parts.map((part, index) => {
          const scenes = scenesOf(part.id);
          const partWords = scenes.reduce((sum, s) => sum + s.words, 0);
          const heading = `${book.partNoun} ${roman(index + 1)}`;
          return (
            <Collapsible key={part.id} defaultOpen={scenes.some((s) => s.id === sceneId) || parts.length <= 3}>
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div className="group/part flex items-center">
                    {renaming === part.id ? (
                      <RenameInput
                        value={part.title}
                        placeholder={heading}
                        onDone={(title) => {
                          updatePart(part.id, { title });
                          setRenaming(null);
                        }}
                      />
                    ) : (
                      <CollapsibleTrigger className={cn(SIDEBAR_ROW, 'group/trigger gap-1.5 font-semibold')}>
                        <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/trigger:rotate-90" />
                        <span className="min-w-0 flex-1 truncate">
                          {heading}
                          {part.title && ` · ${part.title}`}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] font-normal text-muted-foreground">{formatWords(partWords, true)}</span>
                      </CollapsibleTrigger>
                    )}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onSelect={() => addScene(part.id)}>New {info.scene} Here</ContextMenuItem>
                  <ContextMenuItem onSelect={() => setRenaming(part.id)}>Rename</ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem disabled={index === 0} onSelect={() => shift('parts', part.id, -1)}>
                    Move Up
                  </ContextMenuItem>
                  <ContextMenuItem disabled={index === parts.length - 1} onSelect={() => shift('parts', part.id, 1)}>
                    Move Down
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem variant="destructive" onSelect={() => deletePart(part, index + 1)}>
                    Delete {book.partNoun}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
              <CollapsibleContent className="flex flex-col gap-0.5 pt-0.5">
                {scenes.map((scene, i) => (
                  <ContextMenu key={scene.id}>
                    <ContextMenuTrigger asChild>
                      <Link
                        to="/manuscript/$sceneId"
                        params={{ sceneId: scene.id }}
                        aria-current={scene.id === sceneId ? 'page' : undefined}
                        className={cn(SIDEBAR_ROW, 'pl-7', scene.id === sceneId && SIDEBAR_ROW_ON)}
                      >
                        <StatusLed status={scene.status} />
                        <span className="min-w-0 flex-1 truncate">
                          {section === 'dnd' ? scene.title || `Untitled ${info.scene}` : `${i + 1} · ${scene.title || `Untitled ${info.scene}`}`}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                          {scene.words ? formatWords(scene.words) : STATUS_LABEL[scene.status]}
                        </span>
                      </Link>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuSub>
                        <ContextMenuSubTrigger>Status</ContextMenuSubTrigger>
                        <ContextMenuSubContent>
                          {SCENE_STATUSES.map((status) => (
                            <ContextMenuItem key={status} onSelect={() => updateScene(scene.id, { status })}>
                              <StatusLed status={status} /> {STATUS_LABEL[status]}
                            </ContextMenuItem>
                          ))}
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                      <ContextMenuSeparator />
                      <ContextMenuItem disabled={i === 0} onSelect={() => shift('scenes', scene.id, -1)}>
                        Move Up
                      </ContextMenuItem>
                      <ContextMenuItem disabled={i === scenes.length - 1} onSelect={() => shift('scenes', scene.id, 1)}>
                        Move Down
                      </ContextMenuItem>
                      {parts.length > 1 && (
                        <ContextMenuSub>
                          <ContextMenuSubTrigger>Move To</ContextMenuSubTrigger>
                          <ContextMenuSubContent>
                            {parts.map((other, j) =>
                              other.id === part.id ? null : (
                                <ContextMenuItem key={other.id} onSelect={() => moveScene(scene.id, other.id)}>
                                  {book.partNoun} {roman(j + 1)}
                                  {other.title && ` · ${other.title}`}
                                </ContextMenuItem>
                              ),
                            )}
                          </ContextMenuSubContent>
                        </ContextMenuSub>
                      )}
                      <ContextMenuSeparator />
                      <ContextMenuItem variant="destructive" onSelect={() => deleteScene(scene)}>
                        Delete {info.scene}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
                <button type="button" onClick={() => addScene(part.id)} className={cn(SIDEBAR_ROW, 'pl-7 text-muted-foreground')}>
                  <PlusIcon className="size-3.5" /> New {info.scene}
                </button>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
        <Button variant="ghost" size="sm" onClick={addPart} className="justify-start px-2.5 font-normal text-muted-foreground">
          <PlusIcon /> New {book.partNoun}
        </Button>
      </div>

      <div className="flex flex-col gap-1.5 px-2.5">
        <Label>Status</Label>
        <span className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
          {(['done', 'draft', 'outline'] as const).map((status) => (
            <span key={status} className="flex items-center gap-1.5">
              <StatusLed status={status} />
              {status === 'outline' ? 'Planned' : STATUS_LABEL[status]}
            </span>
          ))}
        </span>
      </div>
      </>
      )}
    </Sidebar>
  );
}

function BookCard({ book, words, section, journal }: { book: Book; words: number; section: Section; journal: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-background p-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label>{section === 'writing' ? 'Book' : section === 'film' ? 'Script' : journal ? 'Journal' : 'Session Log'}</Label>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {formatWords(words)}
          {book.targetWords > 0 && ` / ${formatWords(book.targetWords)}`}
        </span>
      </div>
      <input
        aria-label="Book title"
        value={book.title}
        placeholder="Untitled Book"
        onChange={(e) => updateBook(book.id, { title: e.target.value })}
        className="w-full truncate bg-transparent text-[13.5px] font-semibold outline-none placeholder:text-muted-foreground/60"
      />
      {book.targetWords > 0 && <ProgressBar value={words / book.targetWords} />}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Parts are</span>
        <SelectField
          label="What parts are called"
          variant="chip"
          value={book.partNoun}
          onChange={(partNoun) => updateBook(book.id, { partNoun })}
          options={PART_NOUNS.map((noun) => ({ value: noun, label: `${noun}s` }))}
        />
      </div>
    </div>
  );
}

/** An inline rename field: Enter or leaving it saves, Esc cancels. */
function RenameInput({ value, placeholder, onDone }: { value: string; placeholder: string; onDone: (value: string) => void }): ReactNode {
  const [draft, setDraft] = useState(value);
  return (
    <Input
      autoFocus
      aria-label="Name"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onDone(draft.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDone(draft.trim());
        if (e.key === 'Escape') onDone(value);
      }}
      className={cn(FIELD, 'h-[30px] text-[13.5px]')}
    />
  );
}

/**
 * A D&D book's notes: filter by words or category; pinned ones first, then the
 * latest edited. Right-click one to pin it, change its category or delete it.
 */
function NotesList({ notes, sceneId, onAdd }: { notes: Scene[]; sceneId: string; onAdd: (category?: NoteCategory) => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<NoteCategory | null>(null);
  const used = NOTE_CATEGORIES.filter((c) => notes.some((n) => (n.category ?? 'general') === c));
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = notes
    .filter((n) => !category || (n.category ?? 'general') === category)
    .filter((n) => words.every((w) => `${n.title} ${n.text} ${n.note}`.toLowerCase().includes(w)))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt.localeCompare(a.updatedAt));

  const remove = (note: Scene) => {
    trash('scenes', note.id);
    if (note.id === sceneId) void navigate({ to: '/manuscript' });
    toast('Note Deleted', { description: note.title || 'Untitled Note', action: { label: 'Undo', onClick: () => restore('scenes', note.id) } });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-[32px] items-center gap-2 rounded-lg border bg-background px-2.5">
        <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <input aria-label="Filter notes" value={query} placeholder="Filter notes" onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
        {query && (
          <button type="button" aria-label="Clear filter" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
      {used.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {[null, ...used].map((c) => (
            <button
              key={c ?? 'all'}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cn('h-6 rounded-full border px-2 text-[11.5px] text-muted-foreground hover:text-foreground', category === c && 'border-primary bg-primary/10 text-foreground')}
            >
              {c ? NOTE_INFO[c].plural : 'All'}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        {shown.map((note) => {
          const info = NOTE_INFO[note.category ?? 'general'];
          const Icon = info.icon;
          return (
            <ContextMenu key={note.id}>
              <ContextMenuTrigger asChild>
                <Link to="/manuscript/$sceneId" params={{ sceneId: note.id }} aria-current={note.id === sceneId ? 'page' : undefined} className={cn(SIDEBAR_ROW, 'h-auto items-start py-1.5', note.id === sceneId && SIDEBAR_ROW_ON)}>
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1">
                      <span className="truncate">{note.title || `Untitled ${info.label}`}</span>
                      {note.pinned && <PinIcon className="size-3 shrink-0 fill-primary text-primary" />}
                    </span>
                    <span className="truncate text-[11.5px] text-muted-foreground">{note.text.slice(0, 80) || info.label}</span>
                  </span>
                  <span className="shrink-0 pt-0.5 font-mono text-[10px] text-muted-foreground">{relativeTime(note.updatedAt).replace(' ago', '')}</span>
                </Link>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => updateScene(note.id, { pinned: !note.pinned })}>{note.pinned ? 'Unpin' : 'Pin To Top'}</ContextMenuItem>
                <ContextMenuSub>
                  <ContextMenuSubTrigger>Category</ContextMenuSubTrigger>
                  <ContextMenuSubContent>
                    {NOTE_CATEGORIES.map((c) => {
                      const CategoryIcon = NOTE_INFO[c].icon;
                      return (
                        <ContextMenuItem key={c} onSelect={() => updateScene(note.id, { category: c })}>
                          <CategoryIcon /> {NOTE_INFO[c].label}
                        </ContextMenuItem>
                      );
                    })}
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" onSelect={() => remove(note)}>
                  Delete Note
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
        {!shown.length && <p className="px-2.5 py-1 text-[12.5px] text-muted-foreground">{notes.length ? 'No notes match.' : 'Quests, clues, people, loot: anything worth keeping apart from a session.'}</p>}
        <button type="button" onClick={() => onAdd(category ?? undefined)} className={cn(SIDEBAR_ROW, 'text-muted-foreground')}>
          <PlusIcon className="size-3.5" /> New {category ? NOTE_INFO[category].label : 'Note'}
        </button>
      </div>
    </div>
  );
}

import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronRightIcon, PlusIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
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
import { createPart, createScene, moveScene, restore, shift, startBook, trash, trashPart, updateBook, updatePart, updateScene } from '@/lib/actions';
import { useBooks, useLive } from '@/lib/hooks';
import { byOrder, PART_NOUNS, SCENE_STATUSES, type Book, type Part, type Scene, type SceneStatus } from '@/lib/model';
import { formatWords, roman } from '@/lib/text';
import { cn } from '@/lib/utils';

export const STATUS_LABEL: Record<SceneStatus, string> = { idea: 'Idea', outline: 'Outline', draft: 'Drafting', done: 'Done' };

/** A scene's status as a light: done green, drafting orange, the rest off. */
export function StatusLed({ status }: { status: SceneStatus }) {
  return <Led tone={status === 'done' ? 'online' : status === 'draft' ? 'accent' : 'off'} />;
}

/**
 * Binder — the manuscript's sidebar: the book you're in (switch or start
 * another), its acts and their scenes in order, each with its status light and
 * word count. Right-click an act or a scene to rename, reorder, move or
 * delete it. The card at the bottom is the book's own: title, what its parts
 * are called, and progress toward its word goal.
 */
export function Binder({ book, sceneId }: { book: Book; sceneId: string }) {
  const navigate = useNavigate();
  const books = useBooks();
  const allParts = useLive('parts');
  const allScenes = useLive('scenes');
  const [renaming, setRenaming] = useState<string | null>(null);

  const parts = useMemo(() => allParts.filter((p) => p.bookId === book.id).sort(byOrder), [allParts, book.id]);
  const scenesOf = (partId: string) => allScenes.filter((s) => s.partId === partId).sort(byOrder);
  const words = allScenes.filter((s) => s.bookId === book.id).reduce((sum, s) => sum + s.words, 0);
  const current = allScenes.find((s) => s.id === sceneId);

  const open = (scene: Scene) => void navigate({ to: '/manuscript/$sceneId', params: { sceneId: scene.id } });
  const addScene = (partId: string) => open(createScene(book.id, partId));
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
    toast('Scene Deleted', { description: scene.title || 'Untitled Scene', action: { label: 'Undo', onClick: () => restore('scenes', scene.id) } });
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
    <Sidebar title="Manuscript" addLabel="New Scene (Ctrl+N)" onAdd={() => current && addScene(current.partId)} footer={<BookCard book={book} words={words} />}>
      <SelectField
        label="Book"
        value={book.id}
        onChange={(id) => {
          if (id === '__new') {
            open(startBook(book.worldId));
            return;
          }
          const first = allParts.filter((p) => p.bookId === id).sort(byOrder).flatMap((p) => scenesOf(p.id))[0];
          if (first) open(first);
        }}
        options={[...books.map((b) => ({ value: b.id, label: b.title || 'Untitled Book' })), { value: '__new', label: '+ New Book' }]}
        className="h-[34px] text-[13px]"
      />

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
                  <ContextMenuItem onSelect={() => addScene(part.id)}>New Scene Here</ContextMenuItem>
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
                          {i + 1} · {scene.title || 'Untitled Scene'}
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
                        Delete Scene
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
                <button type="button" onClick={() => addScene(part.id)} className={cn(SIDEBAR_ROW, 'pl-7 text-muted-foreground')}>
                  <PlusIcon className="size-3.5" /> New Scene
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
    </Sidebar>
  );
}

function BookCard({ book, words }: { book: Book; words: number }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-background p-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Book</Label>
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

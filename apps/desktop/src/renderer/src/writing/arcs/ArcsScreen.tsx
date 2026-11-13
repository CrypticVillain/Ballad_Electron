import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { PlusIcon, SplineIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { confirmDelete } from '@/components/tabletop/Sharing';
import { Empty, Label } from '@/components/shared/bits';
import { FIELD } from '@/components/shared/Field';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useBooks, useLive, useWorldRecords } from '@/lib/hooks';
import { byOrder, STORY_COLORS, type Book, type Scene, type World } from '@/lib/model';
import { roman } from '@/lib/text';
import { cn } from '@/lib/utils';
import { WritingOnly } from '@/writing/common';
import { createArc, deleteArc, setBeat, updateArc } from './actions';
import { ARC_KINDS, type Arc, type ArcKind } from './model';
import { ARC_SHAPES, placeBeats } from './shapes';

/**
 * Writing → Arcs (/writing/arcs?book=…): a book's arcs as rows against its
 * scenes in manuscript order, act by act; each cell what happens to the arc
 * in that scene. Plot, a character's change, a relationship, a theme.
 */

const KIND_LABEL: Record<ArcKind, string> = { plot: 'Plot', character: 'Character', relationship: 'Relationship', theme: 'Theme' };
const COLUMN = 188;

export function ArcsScreen() {
  return <WritingOnly>{(world) => <Board world={world} />}</WritingOnly>;
}

function Board({ world }: { world: World }) {
  const navigate = useNavigate();
  const { book: bookId } = useSearch({ from: '/writing/arcs' });
  const books = useBooks().filter((b) => b.audience !== 'player').sort(byOrder);
  const book = books.find((b) => b.id === bookId) ?? books[0];
  const allArcs = useWorldRecords('arcs');
  const arcs = useMemo(() => allArcs.filter((a) => a.bookId === book?.id).sort(byOrder), [allArcs, book?.id]);
  const parts = useLive('parts');
  const allScenes = useLive('scenes');
  const acts = useMemo(
    () =>
      book
        ? parts
            .filter((p) => p.bookId === book.id)
            .sort(byOrder)
            .map((part) => ({ part, scenes: allScenes.filter((s) => s.partId === part.id && s.kind !== 'note').sort(byOrder) }))
        : [],
    [book, parts, allScenes],
  );
  const scenes = acts.flatMap((a) => a.scenes);
  const [making, setMaking] = useState(false);
  const pick = (id: string) => void navigate({ to: '/writing/arcs', search: { book: id }, replace: true });

  return (
    <>
      <Sidebar title="Arcs" addLabel="New Arc" onAdd={book ? () => setMaking(true) : undefined}>
        <SidebarSection title="Book">
          <div className="flex flex-col gap-0.5">
            {books.map((b) => (
              <button key={b.id} type="button" onClick={() => pick(b.id)} className={cn('flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13.5px] hover:bg-sidebar-accent', b.id === book?.id && 'bg-sidebar-accent font-medium')}>
                <span className="min-w-0 flex-1 truncate">{b.title || 'Untitled Book'}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{allArcs.filter((a) => a.bookId === b.id).length}</span>
              </button>
            ))}
          </div>
        </SidebarSection>
        <SidebarSection title={`Arcs · ${arcs.length}`}>
          <div className="flex flex-col gap-0.5">
            {arcs.map((arc) => (
              <span key={arc.id} className="flex items-center gap-2 px-2.5 py-1 text-[13px]">
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: `var(--story-${arc.color})` }} />
                <span className="min-w-0 flex-1 truncate">{arc.name || 'Untitled Arc'}</span>
                <span className="font-mono text-[10.5px] text-muted-foreground">{Object.keys(arc.beats).length}</span>
              </span>
            ))}
          </div>
        </SidebarSection>
        <p className="mt-auto px-2.5 text-xs text-muted-foreground">Each cell: what happens to the arc in that scene. Click a scene’s heading to open it.</p>
      </Sidebar>
      <main data-surface="page" className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Arcs', book?.title || 'Untitled Book']}>
          <Button size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" disabled={!book} onClick={() => setMaking(true)}>
            <PlusIcon /> New Arc
          </Button>
        </TopBar>
        {!book ? (
          <div className="flex flex-1 items-center justify-center">
            <Empty title="No Book Yet">Start a book in the Manuscript; its arcs live here.</Empty>
          </div>
        ) : !arcs.length ? (
          <div className="flex flex-1 items-center justify-center">
            <Empty title="No Arcs Yet" action={<Button onClick={() => setMaking(true)}>New Arc</Button>}>
              Chart how the plot turns, how a character changes, how a relationship grows or breaks, scene by scene.
            </Empty>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="inline-grid min-w-full" style={{ gridTemplateColumns: `220px repeat(${Math.max(1, scenes.length)}, ${COLUMN}px)` }}>
              {/* The acts, then their scenes. */}
              <div className="sticky top-0 left-0 z-30 row-span-2 border-r border-b bg-background" />
              {acts.map(({ part, scenes: own }, i) =>
                own.length ? (
                  <div key={part.id} className="sticky top-0 z-20 truncate border-b border-l bg-background px-3 py-1.5 font-mono text-[10.5px] tracking-[0.1em] text-link uppercase" style={{ gridColumn: `span ${own.length}` }}>
                    {book.partNoun} {roman(i + 1)}
                    {part.title ? ` · ${part.title}` : ''}
                  </div>
                ) : null,
              )}
              {scenes.map((scene, i) => (
                <Link key={scene.id} to="/manuscript/$sceneId" params={{ sceneId: scene.id }} className="sticky top-[29px] z-20 flex flex-col border-b border-l bg-background px-3 py-1.5 hover:bg-muted">
                  <span className="font-mono text-[10px] text-muted-foreground">Scene {i + 1}</span>
                  <span className="truncate text-[12.5px] font-medium">{scene.title || 'Untitled Scene'}</span>
                </Link>
              ))}
              {arcs.map((arc) => (
                <ArcRow key={arc.id} arc={arc} scenes={scenes} />
              ))}
            </div>
          </div>
        )}
      </main>
      {making && book && <NewArc world={world} book={book} scenes={scenes} onClose={() => setMaking(false)} />}
    </>
  );
}

function ArcRow({ arc, scenes }: { arc: Arc; scenes: Scene[] }) {
  const characters = useWorldRecords('entries').filter((e) => e.kind === 'character' && e.name);
  const remove = () => confirmDelete({ noun: 'Arc', name: arc.name || 'Untitled Arc', area: 'writing:arcs', extra: Object.keys(arc.beats).length ? `Its ${Object.keys(arc.beats).length} beats go with it.` : undefined, remove: () => deleteArc(arc.id) });
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="sticky left-0 z-10 flex flex-col gap-1 border-r border-b bg-background px-3 py-2" style={{ boxShadow: `inset 3px 0 0 var(--story-${arc.color})` }}>
            <input aria-label="Arc name" value={arc.name} placeholder="Untitled Arc" onChange={(e) => updateArc(arc.id, { name: e.target.value })} className="bg-transparent text-[14px] font-semibold outline-none" />
            <span className="flex items-center gap-1.5">
              <SelectField label="Kind of arc" variant="chip" value={arc.kind} onChange={(kind) => updateArc(arc.id, { kind })} options={ARC_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
              {(arc.kind === 'character' || arc.kind === 'relationship') && (
                <SelectField
                  label="Who it follows"
                  variant="chip"
                  value={arc.entryId}
                  onChange={(entryId) => updateArc(arc.id, { entryId })}
                  options={[{ value: null as string | null, label: 'Who?' }, ...characters.map((c) => ({ value: c.id as string | null, label: c.name }))]}
                  className="max-w-28"
                />
              )}
            </span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem disabled className="max-w-56 truncate font-medium opacity-100">
            {arc.name || 'Untitled Arc'}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <div className="flex gap-1.5 px-2 py-1.5">
            {STORY_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => updateArc(arc.id, { color: c })} className={cn('size-5 rounded-[4px]', arc.color === c && 'ring-2 ring-foreground')} style={{ background: `var(--story-${c})` }} />
            ))}
          </div>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={remove}>
            <Trash2Icon /> Delete Arc
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {scenes.map((scene) => (
        <Beat key={scene.id} arc={arc} sceneId={scene.id} />
      ))}
    </>
  );
}

/** One cell: what happens to the arc in a scene, typed straight in. */
function Beat({ arc, sceneId }: { arc: Arc; sceneId: string }) {
  const text = arc.beats[sceneId] ?? '';
  return (
    <div className={cn('group/beat relative border-b border-l', text && 'bg-[color-mix(in_oklab,var(--story-color)_10%,transparent)]')} style={{ ['--story-color' as string]: `var(--story-${arc.color})` }}>
      {text && <span className="absolute top-0 bottom-0 left-0 w-[3px]" style={{ background: `var(--story-${arc.color})` }} />}
      <textarea
        aria-label="What happens to the arc in this scene"
        value={text}
        placeholder="+"
        rows={3}
        onChange={(e) => setBeat(arc, sceneId, e.target.value)}
        className="size-full min-h-[76px] resize-none bg-transparent px-3 py-2 text-[12.5px] leading-snug outline-none placeholder:text-center placeholder:text-[16px] placeholder:text-transparent group-hover/beat:placeholder:text-muted-foreground/50 focus:bg-muted/40"
      />
    </div>
  );
}

/** A new arc: its name and kind, who it follows, and the shape it starts from. */
function NewArc({ world, book, scenes, onClose }: { world: World; book: Book; scenes: Scene[]; onClose: () => void }) {
  const characters = useWorldRecords('entries').filter((e) => e.kind === 'character' && e.name);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ArcKind>('plot');
  const [entryId, setEntryId] = useState<string | null>(null);
  const [shape, setShape] = useState('blank');
  const make = () => {
    const who = characters.find((c) => c.id === entryId);
    const chosen = ARC_SHAPES.find((s) => s.id === shape)!;
    createArc({ worldId: world.id, bookId: book.id, name: name.trim() || (who ? `${who.name.split(' ')[0]}’s Arc` : `${KIND_LABEL[kind]} Arc`), kind, entryId, beats: placeBeats(scenes.map((s) => s.id), chosen) });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-black uppercase">New Arc</DialogTitle>
          <DialogDescription>A row on the board, scene by scene, for {book.title || 'this book'}.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <Label>Name</Label>
            <Input autoFocus aria-label="Arc name" value={name} placeholder="The Lantern’s secret" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && make()} className={FIELD} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <Label>Kind</Label>
              <SelectField label="Kind" value={kind} onChange={setKind} options={ARC_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
            </label>
            <label className="flex flex-col gap-1">
              <Label>Follows</Label>
              <SelectField label="Who it follows" value={entryId} onChange={setEntryId} options={[{ value: null as string | null, label: 'Nobody in particular' }, ...characters.map((c) => ({ value: c.id as string | null, label: c.name }))]} />
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Start From</Label>
            {ARC_SHAPES.map((s) => (
              <button key={s.id} type="button" aria-pressed={shape === s.id} onClick={() => setShape(s.id)} className={cn('flex items-center gap-3 rounded-lg border px-3 py-2 text-left', shape === s.id && 'border-primary bg-primary/5')}>
                <SplineIcon className="size-4 text-muted-foreground" />
                <span className="flex flex-col">
                  <span className="text-[13.5px] font-medium">{s.label}</span>
                  <span className="text-[11.5px] text-muted-foreground">{s.note}{s.beats.length ? ` · ${s.beats.length} beats across ${scenes.length} scenes` : ''}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={make}>
            <PlusIcon /> Make Arc
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

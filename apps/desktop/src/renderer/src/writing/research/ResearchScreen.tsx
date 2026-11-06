import { Link, Navigate, useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import { ExternalLinkIcon, NotebookTextIcon, PinIcon, PinOffIcon, SearchIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { confirmDelete } from '@/components/tabletop/Sharing';
import { Empty, Label } from '@/components/shared/bits';
import { AREA, FIELD } from '@/components/shared/Field';
import { Hint } from '@/components/shared/Hint';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SidebarLink, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { relativeTime } from '@/lib/dates';
import { useWorldRecords } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { WritingOnly } from '@/writing/common';
import { cleanTag, createResearchNote, deleteResearchNote, updateResearchNote } from './actions';
import type { ResearchNote } from './model';

/**
 * Writing → Research (/writing/research): what you gather for the world.
 * Notes with a source, tags to find them again, and the entries they're
 * about; searched and filtered by tag in the sidebar, pinned ones first.
 */

const isLink = (source: string) => /^https?:\/\//i.test(source.trim());

function removeNote(note: ResearchNote, after?: () => void) {
  confirmDelete({ noun: 'Note', name: note.title || 'Untitled Note', area: 'writing:research', remove: () => deleteResearchNote(note.id), after });
}

/** /writing/research: the newest note, or how to start. */
export function ResearchIndex() {
  return <WritingOnly>{(world) => <IndexBody worldId={world.id} />}</WritingOnly>;
}

function IndexBody({ worldId }: { worldId: string }) {
  const notes = useWorldRecords('research');
  const navigate = useNavigate();
  const first = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))[0];
  if (first) return <Navigate to="/writing/research/$noteId" params={{ noteId: first.id }} replace />;
  return (
    <>
      <ResearchSidebar worldId={worldId} />
      <main className="flex min-w-0 flex-1 items-center justify-center bg-background">
        <Empty title="No Research Yet" action={<Button onClick={() => void navigate({ to: '/writing/research/$noteId', params: { noteId: createResearchNote(worldId).id } })}>New Note</Button>}>
          Notes, quotes, sources and links you gather for the world, tagged to find again.
        </Empty>
      </main>
    </>
  );
}

/** /writing/research/$noteId: one note. */
export function ResearchScreen() {
  const { noteId } = useParams({ from: '/writing/research/$noteId' });
  return (
    <WritingOnly>
      {(world) => <NoteBody worldId={world.id} noteId={noteId} />}
    </WritingOnly>
  );
}

function NoteBody({ worldId, noteId }: { worldId: string; noteId: string }) {
  const note = useWorldRecords('research').find((n) => n.id === noteId);
  if (!note) return <Navigate to="/writing/research" replace />;
  return (
    <>
      <ResearchSidebar worldId={worldId} />
      <NoteSheet key={note.id} note={note} />
    </>
  );
}

function ResearchSidebar({ worldId }: { worldId: string }) {
  const notes = useWorldRecords('research');
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [notes]);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = notes
    .filter((n) => !tag || n.tags.includes(tag))
    .filter((n) => words.every((w) => `${n.title} ${n.body} ${n.source} ${n.tags.join(' ')}`.toLowerCase().includes(w)))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  const add = () => void navigate({ to: '/writing/research/$noteId', params: { noteId: createResearchNote(worldId, tag ? { tags: [tag] } : {}).id } });
  return (
    <Sidebar title="Research" addLabel="New Note" onAdd={add}>
      <div className="flex h-8 items-center gap-2 rounded-lg border bg-background px-2.5 focus-within:border-primary">
        <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <input aria-label="Search research" value={query} placeholder="Search notes" onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
      {tags.length > 0 && (
        <SidebarSection title="Tags">
          <div className="flex flex-wrap gap-1 px-1">
            {tags.map(([t, n]) => (
              <button key={t} type="button" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)} className={cn('h-6 rounded-full border px-2 text-[11.5px] text-muted-foreground hover:text-foreground', tag === t && 'border-primary bg-primary/10 font-medium text-foreground')}>
                #{t} <span className="font-mono text-[10px]">{n}</span>
              </button>
            ))}
          </div>
        </SidebarSection>
      )}
      <SidebarSection title={`Notes · ${shown.length}`}>
        {shown.map((n) => (
          <ContextMenu key={n.id}>
            <ContextMenuTrigger className="block">
              <SidebarLink to={`/writing/research/${n.id}`} icon={n.pinned ? PinIcon : NotebookTextIcon} label={n.title || 'Untitled Note'} meta={n.tags[0] ? `#${n.tags[0]}` : undefined} />
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem disabled className="max-w-56 truncate font-medium opacity-100">
                {n.title || 'Untitled Note'}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => updateResearchNote(n.id, { pinned: !n.pinned })}>{n.pinned ? <PinOffIcon /> : <PinIcon />} {n.pinned ? 'Unpin' : 'Pin'}</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onSelect={() => removeNote(n, () => path === `/writing/research/${n.id}` && void navigate({ to: '/writing/research' }))}>
                <Trash2Icon /> Delete Note
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
        {!shown.length && <p className="px-2.5 text-[12.5px] text-muted-foreground">{notes.length ? 'Nothing matches.' : 'No notes yet.'}</p>}
      </SidebarSection>
    </Sidebar>
  );
}

function NoteSheet({ note }: { note: ResearchNote }) {
  const navigate = useNavigate();
  const entries = useWorldRecords('entries');
  const [tagDraft, setTagDraft] = useState('');
  const set = (changes: Partial<ResearchNote>) => updateResearchNote(note.id, changes);
  const linked = note.links.map((id) => entries.find((e) => e.id === id)).filter((e) => e !== undefined);
  const unlinked = entries.filter((e) => e.name && !note.links.includes(e.id)).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  const addTag = () => {
    const t = cleanTag(tagDraft);
    if (t && !note.tags.includes(t)) set({ tags: [...note.tags, t] });
    setTagDraft('');
  };
  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      <TopBar crumbs={['Research', note.title || 'Untitled Note']}>
        <Hint label={note.pinned ? 'Unpin' : 'Pin to the top'}>
          <Button variant="outline" size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => set({ pinned: !note.pinned })}>
            {note.pinned ? <PinOffIcon /> : <PinIcon />} {note.pinned ? 'Unpin' : 'Pin'}
          </Button>
        </Hint>
        <Hint label="Delete Note">
          <Button variant="outline" size="icon-sm" aria-label="Delete Note" className="rounded-full" onClick={() => removeNote(note, () => void navigate({ to: '/writing/research' }))}>
            <Trash2Icon />
          </Button>
        </Hint>
      </TopBar>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-8 pt-7 pb-16">
          <span className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">Edited {relativeTime(note.updatedAt)}</span>
          <textarea
            aria-label="Note title"
            rows={1}
            autoFocus={!note.title}
            value={note.title}
            placeholder="UNTITLED NOTE"
            onChange={(e) => set({ title: e.target.value.replace(/\n/g, ' ') })}
            className="field-sizing-content w-full resize-none bg-transparent font-display text-[34px] leading-[1.05] font-black uppercase outline-none placeholder:text-muted-foreground/40"
          />
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <label className="flex flex-col gap-1">
              <Label>Source</Label>
              <Input aria-label="Source" value={note.source} placeholder="A web page, a book and page, an interview…" onChange={(e) => set({ source: e.target.value })} className={FIELD} />
            </label>
            {isLink(note.source) && (
              <a href={note.source.trim()} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] hover:bg-muted">
                <ExternalLinkIcon className="size-3.5" /> Open
              </a>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {note.tags.map((t) => (
                <span key={t} className="flex h-7 items-center gap-1 rounded-full border border-primary/50 bg-primary/8 pr-1.5 pl-2.5 text-[12px] font-medium">
                  #{t}
                  <button type="button" aria-label={`Remove #${t}`} onClick={() => set({ tags: note.tags.filter((x) => x !== t) })} className="text-muted-foreground hover:text-foreground">
                    <XIcon className="size-3" />
                  </button>
                </span>
              ))}
              <input
                aria-label="Add a tag"
                value={tagDraft}
                placeholder="Add a tag, Enter"
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                onBlur={addTag}
                className="h-7 w-40 rounded-full border border-dashed bg-transparent px-2.5 text-[12px] outline-none focus:border-primary"
              />
            </div>
          </div>
          <Textarea aria-label="Note" rows={14} value={note.body} placeholder="What you found, in your words or theirs…" onChange={(e) => set({ body: e.target.value })} className={cn(AREA, 'min-h-[280px] resize-y text-[14.5px] leading-relaxed')} />
          <div className="flex flex-col gap-1.5">
            <Label>About</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {linked.map((e) => (
                <span key={e.id} className="flex h-7 items-center gap-1 rounded-full border pr-1.5 pl-2.5 text-[12px]">
                  <Link to="/bible/$kind/$entryId" params={{ kind: e.kind, entryId: e.id }} className="hover:underline">
                    {e.name}
                  </Link>
                  <button type="button" aria-label={`Unlink ${e.name}`} onClick={() => set({ links: note.links.filter((id) => id !== e.id) })} className="text-muted-foreground hover:text-foreground">
                    <XIcon className="size-3" />
                  </button>
                </span>
              ))}
              <SelectField
                label="Link an entry"
                variant="chip"
                value={null as string | null}
                onChange={(id) => id && set({ links: [...note.links, id] })}
                options={[{ value: null, label: '+ Character, place or lore' }, ...unlinked.map((e) => ({ value: e.id as string | null, label: e.name }))]}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

import { useNavigate } from '@tanstack/react-router';
import { ArrowRightIcon, NetworkIcon, PlusIcon, ShuffleIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { toast } from 'sonner';
import { confirmDelete } from '@/components/tabletop/Sharing';
import { Empty, Label } from '@/components/shared/bits';
import { FIELD } from '@/components/shared/Field';
import { Portrait } from '@/components/shared/Portrait';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { addRelationship, restore, trash, updateWorld } from '@/lib/actions';
import { useWorldRecords } from '@/lib/hooks';
import type { Entry, EntryKind, Relationship, World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { WritingOnly } from '@/writing/common';
import { FamilyTree } from './FamilyTree';
import { isFamily, layoutWeb, type Point } from './layout';

/**
 * Writing → Relationships (/writing/relationships): the world's people (and,
 * if you like, its places and lore) as a web, every relationship a line.
 * Drag an entry to put it where you want it (kept); Re-arrange lets the web
 * lay itself out again. Pick one to see and change its relationships. Family
 * Tree shows the characters' families in generations instead (FamilyTree).
 */

const KINDS: { kind: EntryKind; label: string }[] = [
  { kind: 'character', label: 'Characters' },
  { kind: 'place', label: 'Places' },
  { kind: 'lore', label: 'Lore' },
];

/** Quick labels for a new relationship. */
const QUICK = ['Mother of', 'Father of', 'Sibling', 'Married to', 'Friend', 'Rival', 'Mentor to', 'Serves', 'Loves', 'Fears'];

export function RelationshipsScreen() {
  return <WritingOnly>{(world) => <Web world={world} />}</WritingOnly>;
}

function Web({ world }: { world: World }) {
  const navigate = useNavigate();
  const entries = useWorldRecords('entries');
  const relationships = useWorldRecords('relationships');
  const [kinds, setKinds] = useState<EntryKind[]>(['character']);
  const [familyOnly, setFamilyOnly] = useState(false);
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'web' | 'tree'>('web');
  const characters = useMemo(() => entries.filter((e) => e.kind === 'character'), [entries]);
  const [dragging, setDragging] = useState<{ id: string; at: Point } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const drag = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) => e && setSize({ width: e.contentRect.width, height: e.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const shownEntries = useMemo(() => entries.filter((e) => kinds.includes(e.kind)), [entries, kinds]);
  const shownIds = useMemo(() => new Set(shownEntries.map((e) => e.id)), [shownEntries]);
  const links = useMemo(() => relationships.filter((r) => shownIds.has(r.fromId) && shownIds.has(r.toId) && (!familyOnly || isFamily(r.label))), [relationships, shownIds, familyOnly]);
  const linked = useMemo(() => new Set(links.flatMap((r) => [r.fromId, r.toId])), [links]);
  const nodes = useMemo(() => shownEntries.filter((e) => !(connectedOnly || familyOnly) || linked.has(e.id)), [shownEntries, connectedOnly, familyOnly, linked]);
  const pinned = useMemo(() => world.web ?? {}, [world.web]);
  const at = useMemo(() => layoutWeb(nodes.map((e) => ({ id: e.id })), links.map((r) => ({ from: r.fromId, to: r.toId })), pinned), [nodes, links, pinned]);
  const place = (id: string): Point => (dragging?.id === id ? dragging.at : (at[id] ?? { x: 0.5, y: 0.5 }));
  const px = (p: Point) => ({ x: p.x * size.width, y: p.y * size.height });
  const chosen = entries.find((e) => e.id === selected);
  const near = new Set(chosen ? links.filter((r) => r.fromId === chosen.id || r.toId === chosen.id).flatMap((r) => [r.fromId, r.toId]) : []);

  const down = (e: ReactPointerEvent, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { id, startX: e.clientX, startY: e.clientY, moved: false };
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    const rect = box.current?.getBoundingClientRect();
    if (!d || !rect) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 3) return;
    d.moved = true;
    setDragging({ id: d.id, at: { x: Math.min(0.97, Math.max(0.03, (e.clientX - rect.left) / rect.width)), y: Math.min(0.97, Math.max(0.03, (e.clientY - rect.top) / rect.height)) } });
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved && dragging) updateWorld(world.id, { web: { ...pinned, [d.id]: dragging.at } });
    else setSelected(d.id === selected ? null : d.id);
    setDragging(null);
  };
  const rearrange = () => {
    const before = world.web;
    updateWorld(world.id, { web: {} });
    toast('Re-Arranged', { description: 'Everyone’s back where the web puts them.', action: { label: 'Undo', onClick: () => updateWorld(world.id, { web: before }) } });
  };
  const toggleKind = (kind: EntryKind, on: boolean) => setKinds((k) => (on ? [...k, kind] : k.filter((x) => x !== kind)));

  return (
    <>
      <Sidebar title="Relationships">
        {view === 'tree' ? (
          <div className="flex flex-col gap-2 px-2.5 text-[12.5px] text-muted-foreground">
            <p>The characters' families, from their relationships: Mother of, Son of, Sister, Married to, Grandfather…</p>
            <span className="flex items-center gap-2"><span className="h-0.5 w-6 border-y border-amber-500" /> Married</span>
            <span className="flex items-center gap-2"><span className="h-3 w-6 border-x border-t border-muted-foreground/60" /> Parents and children</span>
            <span className="flex items-center gap-2"><span className="h-3 w-6 border-x border-t border-dashed border-muted-foreground/60" /> Siblings</span>
          </div>
        ) : (
          <>
        <SidebarSection title="Show">
          <div className="flex flex-col gap-2 px-2.5">
            {KINDS.map(({ kind, label }) => (
              <label key={kind} className="flex items-center gap-2 text-[13.5px]">
                <Checkbox checked={kinds.includes(kind)} onCheckedChange={(v) => toggleKind(kind, v === true)} />
                {label}
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">{entries.filter((e) => e.kind === kind).length}</span>
              </label>
            ))}
          </div>
        </SidebarSection>
        <SidebarSection title="Only">
          <div className="flex flex-col gap-2 px-2.5">
            <label className="flex items-center gap-2 text-[13.5px]">
              <Checkbox checked={familyOnly} onCheckedChange={(v) => setFamilyOnly(v === true)} />
              Family
              <span className="ml-auto size-2.5 rounded-full bg-amber-500" />
            </label>
            <label className="flex items-center gap-2 text-[13.5px]">
              <Checkbox checked={connectedOnly} onCheckedChange={(v) => setConnectedOnly(v === true)} />
              Those with relationships
            </label>
          </div>
        </SidebarSection>
          </>
        )}
        <p className="mt-auto px-2.5 text-xs text-muted-foreground">
          {view === 'web' ? 'Drag anyone to put them where you want; click to see their relationships; double-click to open them.' : 'Click anyone to see their relationships; double-click to open them.'}
        </p>
      </Sidebar>
      <main data-surface="page" className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Relationships', world.name]}>
          {/* The web's own controls come first, so the view switch stays at the far right whichever view is showing. */}
          {view === 'web' && (
            <>
              <span className="font-mono text-[11px] text-muted-foreground">
                {nodes.length} · {links.length} {links.length === 1 ? 'link' : 'links'}
              </span>
              <Button variant="outline" size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" disabled={!Object.keys(pinned).length} onClick={rearrange}>
                <ShuffleIcon /> Re-Arrange
              </Button>
            </>
          )}
          <div role="tablist" aria-label="View" className="flex rounded-full border p-0.5">
            {(
              [
                ['web', 'Web'],
                ['tree', 'Family Tree'],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={view === value} onClick={() => setView(value)} className={cn('rounded-full px-3 py-1 font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase', view === value && 'bg-primary text-primary-foreground')}>
                {label}
              </button>
            ))}
          </div>
        </TopBar>
        <div className="flex min-h-0 flex-1">
          {view === 'tree' ? (
            <div className="min-w-0 flex-1">
              <FamilyTree characters={characters} relationships={relationships} selected={selected} onSelect={setSelected} />
            </div>
          ) : (
          <div ref={box} onPointerMove={move} onPointerUp={up} onPointerDown={() => setSelected(null)} className="relative min-w-0 flex-1 touch-none overflow-hidden select-none">
            {nodes.length ? (
              <>
                <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
                  {links.map((r) => {
                    const a = px(place(r.fromId));
                    const b = px(place(r.toId));
                    const lit = chosen && (r.fromId === chosen.id || r.toId === chosen.id);
                    const family = isFamily(r.label);
                    return (
                      <g key={r.id} opacity={chosen && !lit ? 0.15 : 1}>
                        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={lit ? 2.5 : 1.5} className={lit ? 'stroke-primary' : family ? 'stroke-amber-500' : 'stroke-muted-foreground/50'} />
                        {(lit || !chosen) && r.label && (
                          <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 5} textAnchor="middle" className="fill-muted-foreground stroke-background text-[10.5px] [paint-order:stroke] [stroke-width:3px]">
                            {r.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
                {nodes.map((e) => {
                  const p = px(place(e.id));
                  const dim = chosen && chosen.id !== e.id && !near.has(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      aria-label={e.name || 'Untitled'}
                      onPointerDown={(ev) => down(ev, e.id)}
                      onDoubleClick={() => void navigate({ to: '/bible/$kind/$entryId', params: { kind: e.kind, entryId: e.id } })}
                      className={cn('absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center gap-1 active:cursor-grabbing', dim && 'opacity-25')}
                      style={{ left: p.x, top: p.y }}
                    >
                      <Portrait image={e.image} name={e.name} className={cn('size-10 rounded-full border-2 border-background shadow-md', selected === e.id && 'ring-2 ring-primary', e.kind !== 'character' && 'rounded-lg')} text="text-[12px]" />
                      <span className="max-w-28 truncate rounded-full bg-background/90 px-2 text-[11.5px] font-medium">{e.name || 'Untitled'}</span>
                    </button>
                  );
                })}
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <Empty title="Nobody Here Yet">{familyOnly || connectedOnly ? 'Nobody fits these filters yet.' : 'Add characters (and places or lore, if you show them) to see their relationships.'}</Empty>
              </div>
            )}
          </div>
          )}
          <aside className="flex w-[300px] shrink-0 flex-col gap-4 overflow-y-auto border-l px-5 py-4">
            {chosen ? <Links key={chosen.id} world={world} entry={chosen} entries={entries} relationships={relationships} /> : <Legend />}
          </aside>
        </div>
      </main>
    </>
  );
}

function Legend() {
  return (
    <div className="flex flex-col gap-3 text-[13px] text-muted-foreground">
      <span className="flex items-center gap-2 text-foreground">
        <NetworkIcon className="size-4" /> Pick someone to see their relationships, and add or remove them.
      </span>
      <span className="flex items-center gap-2">
        <span className="h-0.5 w-6 bg-amber-500" /> Family
      </span>
      <span className="flex items-center gap-2">
        <span className="h-0.5 w-6 bg-muted-foreground/50" /> Everything else
      </span>
    </div>
  );
}

/** One entry's relationships: each way they run, to remove; and a new one to add. */
function Links({ world, entry, entries, relationships }: { world: World; entry: Entry; entries: Entry[]; relationships: Relationship[] }) {
  const navigate = useNavigate();
  const mine = relationships.filter((r) => r.fromId === entry.id || r.toId === entry.id);
  const [to, setTo] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const others = entries.filter((e) => e.id !== entry.id && e.name).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  const nameOf = (id: string) => entries.find((e) => e.id === id)?.name || 'Untitled';
  const add = () => {
    if (!to) return;
    addRelationship(world.id, entry.id, to, label.trim());
    setLabel('');
    setTo(null);
  };
  const remove = (r: Relationship) =>
    confirmDelete({
      noun: 'Relationship',
      verb: 'Remove',
      name: `${nameOf(r.fromId)} → ${nameOf(r.toId)}${r.label ? ` (${r.label})` : ''}`,
      area: 'writing:bible',
      remove: () => {
        trash('relationships', r.id);
        return () => restore('relationships', r.id);
      },
    });
  return (
    <>
      <div className="flex items-center gap-3">
        <Portrait image={entry.image} name={entry.name} className="size-11 rounded-full" text="text-[13px]" />
        <div className="flex min-w-0 flex-col">
          <button type="button" onClick={() => void navigate({ to: '/bible/$kind/$entryId', params: { kind: entry.kind, entryId: entry.id } })} className="truncate text-left text-[16px] font-semibold hover:underline">
            {entry.name || 'Untitled'}
          </button>
          {entry.tagline && <span className="truncate text-[12px] text-muted-foreground">{entry.tagline}</span>}
        </div>
      </div>
      <section className="flex flex-col gap-1.5">
        <Label>Relationships · {mine.length}</Label>
        {mine.length ? (
          mine.map((r) => (
            <div key={r.id} className="group/rel flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-muted">
              <span className={cn('size-2 shrink-0 rounded-full', isFamily(r.label) ? 'bg-amber-500' : 'bg-muted-foreground/50')} />
              <span className="min-w-0 flex-1 truncate">
                {r.fromId === entry.id ? (
                  <>
                    <span className="text-muted-foreground">{r.label || 'Linked'}</span> <ArrowRightIcon className="inline size-3" /> {nameOf(r.toId)}
                  </>
                ) : (
                  <>
                    {nameOf(r.fromId)} <ArrowRightIcon className="inline size-3" /> <span className="text-muted-foreground">{r.label || 'Linked'}</span>
                  </>
                )}
              </span>
              <button type="button" aria-label="Remove relationship" onClick={() => remove(r)} className="text-muted-foreground opacity-0 group-hover/rel:opacity-100 hover:text-foreground focus-visible:opacity-100">
                <XIcon className="size-3.5" />
              </button>
            </div>
          ))
        ) : (
          <p className="text-[12.5px] text-muted-foreground">None yet.</p>
        )}
      </section>
      <section className="flex flex-col gap-2 border-t pt-3">
        <Label>New Relationship</Label>
        <SelectField label="With" value={to} onChange={setTo} options={[{ value: null as string | null, label: 'With…' }, ...others.map((e) => ({ value: e.id as string | null, label: e.name }))]} />
        <Input aria-label="How" value={label} placeholder={`How ${entry.name.split(' ')[0] || 'they'} relates (Mother of, Rival…)`} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} className={FIELD} />
        <div className="flex flex-wrap gap-1">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => setLabel(q)} className={cn('h-6 rounded-full border px-2 text-[11px] text-muted-foreground hover:text-foreground', label === q && 'border-primary text-foreground')}>
              {q}
            </button>
          ))}
        </div>
        <Button size="sm" className="self-start" disabled={!to} onClick={add}>
          <PlusIcon /> Add
        </Button>
      </section>
    </>
  );
}

import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, ListChecksIcon, SearchIcon, Trash2Icon, XIcon } from 'lucide-react';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { confirmDelete } from '@/components/tabletop/Sharing';
import { Empty, Label, ProgressBar } from '@/components/shared/bits';
import { FIELD } from '@/components/shared/Field';
import { PillTabs } from '@/components/shared/bits';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SIDEBAR_ROW, SIDEBAR_ROW_ON, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBooks, useWorldRecords } from '@/lib/hooks';
import type { World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { FilmOnly, PILL } from '@/film/common';
import { roleOf } from '@/film/script/cast';
import { useProductionScript, type ProductionScene } from '@/film/script/hooks';
import { eighthsLabel } from '@/film/script/layout';
import { deleteItem, findMentions, tagScene, untagScene, updateItem } from './actions';
import { BREAKDOWN_CATEGORIES, categoryInfo, type BreakdownCategory, type BreakdownItem } from './model';
import { breakdownHtml } from './pdf';

/**
 * /film/breakdown?scene=… — the script broken down: for each scene, its
 * cast (from the script) and everything else it needs, by category. Tag
 * from the scene's own text (select words, pick a category) or type them
 * in. "All Elements" lists every element with the scenes that need it.
 */
export function BreakdownScreen() {
  return <FilmOnly>{(world) => <Breakdown world={world} />}</FilmOnly>;
}

function Breakdown({ world }: { world: World }) {
  const navigate = useNavigate();
  const { scene: sceneId } = useSearch({ from: '/film/breakdown' });
  const script = useProductionScript();
  const items = useWorldRecords('breakdown');
  const books = [...useBooks()].sort((a, b) => a.order - b.order);
  const current = sceneId ? script.byId.get(sceneId) : undefined;
  const pick = (id?: string) => void navigate({ to: '/film/breakdown', search: id ? { scene: id } : {}, replace: true });
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) for (const s of i.sceneIds) m.set(s, (m.get(s) ?? 0) + 1);
    return m;
  }, [items]);
  const done = script.scenes.filter((s) => counts.get(s.scene.id)).length;
  const at = current ? script.scenes.indexOf(current) : -1;

  const exportSheets = async () => {
    const path = await window.api.files.savePdf({ defaultName: `${world.name || 'Production'} Breakdown.pdf`, html: breakdownHtml(world.name, script, items), pageSize: 'Letter' });
    if (path) toast('Breakdown Sheets Exported', { description: `A sheet for each of ${script.scenes.length} scenes. Saved to ${path}` });
  };

  return (
    <>
      <Sidebar title="Breakdown">
        <div className="flex flex-col gap-2 rounded-xl border bg-background p-3">
          <div className="flex items-baseline justify-between">
            <Label>Broken Down</Label>
            <span className="font-mono text-[11px] text-muted-foreground">
              {done} / {script.scenes.length}
            </span>
          </div>
          <ProgressBar value={script.scenes.length ? done / script.scenes.length : 0} />
          <span className="font-mono text-[11px] text-muted-foreground">{items.length} Elements</span>
        </div>
        <button type="button" onClick={() => pick()} className={cn(SIDEBAR_ROW, !current && SIDEBAR_ROW_ON)}>
          <ListChecksIcon className="size-4 shrink-0" strokeWidth={1.75} />
          <span className="flex-1">All Elements</span>
          <span className="font-mono text-[11px] text-muted-foreground">{items.length}</span>
        </button>
        {/* A section per script when the production has more than one (each numbers its own scenes once locked). */}
        {(books.length > 1 ? books : [null]).map((book) => (
          <SidebarSection key={book?.id ?? 'all'} title={book ? book.title || 'Untitled Script' : 'Scenes'}>
            {script.scenes
              .filter((s) => !book || s.bookId === book.id)
              .map((s) => (
                <button key={s.scene.id} type="button" onClick={() => pick(s.scene.id)} className={cn(SIDEBAR_ROW, current?.scene.id === s.scene.id && SIDEBAR_ROW_ON)}>
                  <span className="w-8 shrink-0 font-mono text-[11px] text-muted-foreground">{s.number}</span>
                  <span className="min-w-0 flex-1 truncate">{s.scene.title || s.heading.place || 'Untitled Scene'}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{counts.get(s.scene.id) || ''}</span>
                </button>
              ))}
          </SidebarSection>
        ))}
      </Sidebar>
      <main data-surface="page" className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Breakdown', current ? `Scene ${current.number}` : 'All Elements']}>
          {current && (
            <>
              <Button variant="outline" size="icon-sm" aria-label="Previous scene" disabled={at <= 0} onClick={() => pick(script.scenes[at - 1]!.scene.id)}>
                <ChevronLeftIcon />
              </Button>
              <Button variant="outline" size="icon-sm" aria-label="Next scene" disabled={at >= script.scenes.length - 1} onClick={() => pick(script.scenes[at + 1]!.scene.id)}>
                <ChevronRightIcon />
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" className={PILL} disabled={!script.scenes.length} onClick={() => void exportSheets()}>
            <DownloadIcon /> Breakdown Sheets
          </Button>
        </TopBar>
        {!script.scenes.length ? (
          <div className="flex flex-1 items-center justify-center">
            <Empty title="No Scenes Yet">Write the script first: each scene gets a breakdown sheet here.</Empty>
          </div>
        ) : current ? (
          <SceneSheet key={current.scene.id} world={world} scene={current} items={items} castNumber={script.castNumber} cast={script.cast} />
        ) : (
          <AllElements items={items} script={script} onScene={pick} />
        )}
      </main>
    </>
  );
}

// ── A scene's sheet ──

function SceneSheet({ world, scene, items, cast, castNumber }: { world: World; scene: ProductionScene; items: BreakdownItem[]; cast: ReturnType<typeof useProductionScript>['cast']; castNumber: Map<string, number> }) {
  const [selection, setSelection] = useState('');
  const mine = items.filter((i) => i.sceneIds.includes(scene.scene.id));
  const place = useWorldRecords('entries').find((e) => e.id === scene.scene.placeId);
  const tag = (category: BreakdownCategory, name: string) => {
    const item = tagScene(world.id, scene.scene.id, category, name);
    if (item) toast(`Tagged: ${item.name}`, { description: categoryInfo(category).label });
  };
  const highlights = mine.map((i) => ({ name: i.name, hex: categoryInfo(i.category).hex }));
  return (
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1 overflow-y-auto px-7 pt-5 pb-10">
        <div className="flex max-w-[860px] flex-col gap-4">
          <header className="flex flex-col gap-1">
            <span className="font-mono text-[11px] tracking-[0.08em] text-link uppercase">
              Scene {scene.number} · {eighthsLabel(scene.eighths)} {scene.eighths > 8 ? 'Pages' : 'Page'}
              {scene.heading.ie && ` · ${scene.heading.ie}`}
              {scene.heading.time && ` · ${scene.heading.time}`}
            </span>
            <h2 className="font-display text-[26px] leading-tight font-black uppercase">{scene.heading.place || scene.scene.title || 'Untitled Scene'}</h2>
            <span className="text-[13px] text-muted-foreground">
              {place ? `Shot at ${place.name}` : 'No location set'}
              {scene.scene.note && ` · ${scene.scene.note}`}
            </span>
          </header>
          <section className="flex flex-col gap-2 rounded-2xl border px-4 py-3">
            <Label>Cast</Label>
            <div className="flex flex-wrap gap-1.5">
              {scene.cast.map((id) => {
                const c = cast.find((x) => x.id === id);
                return c ? (
                  <Link key={id} to="/bible/$kind/$entryId" params={{ kind: 'character', entryId: id }} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-red-600/30 bg-red-600/10 px-2.5 text-[12.5px] text-red-700 dark:text-red-300">
                    <span className="font-mono text-[10.5px]">{castNumber.get(id)}</span>
                    {roleOf(c)}
                    {roleOf(c) !== c.name && <span className="text-muted-foreground">· {c.name}</span>}
                  </Link>
                ) : null;
              })}
              {scene.unmatched.map((name) => (
                <span key={name} title="Speaks in this scene, but no one in Cast plays them yet" className="inline-flex h-7 items-center rounded-full border border-dashed px-2.5 text-[12.5px] text-muted-foreground">
                  {name}
                </span>
              ))}
              {!scene.cast.length && !scene.unmatched.length && <span className="text-[13px] text-muted-foreground">No one speaks or is named in this scene.</span>}
            </div>
          </section>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {BREAKDOWN_CATEGORIES.map((c) => (
              <CategoryCard key={c.id} category={c.id} sceneId={scene.scene.id} items={mine.filter((i) => i.category === c.id)} all={items.filter((i) => i.category === c.id)} onTag={(name) => tag(c.id, name)} />
            ))}
          </div>
        </div>
      </div>
      <aside aria-label="The scene’s text" className="flex w-[380px] shrink-0 flex-col border-l bg-sidebar/40">
        <div className="flex flex-col gap-2 border-b px-4 py-3">
          <Label>{selection ? `Tag “${selection.length > 28 ? `${selection.slice(0, 28)}…` : selection}” As` : 'Select words below to tag them'}</Label>
          <div className="flex flex-wrap gap-1">
            {BREAKDOWN_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={!selection}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  tag(c.id, selection);
                  setSelection('');
                  window.getSelection()?.removeAllRanges();
                }}
                className={cn('inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] disabled:opacity-40', c.chip)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div
          data-selectable
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4 font-mono text-[12px] leading-[1.55]"
          onMouseUp={() => setSelection((window.getSelection()?.toString() ?? '').trim().replace(/\s+/g, ' ').slice(0, 80))}
        >
          {scene.elements.map((e, i) => (
            <p
              key={i}
              className={cn(
                'whitespace-pre-wrap',
                e.type === 'sceneHeading' && 'mt-3 font-bold uppercase first:mt-0',
                e.type === 'action' && 'mt-3',
                e.type === 'character' && 'mt-3 pl-[38%] uppercase',
                e.type === 'parenthetical' && 'pl-[28%] text-muted-foreground',
                e.type === 'dialogue' && 'pr-[12%] pl-[18%]',
                e.type === 'transition' && 'mt-3 text-right uppercase',
              )}
            >
              <Highlighted text={e.text} marks={highlights} />
            </p>
          ))}
          {!scene.elements.length && <p className="text-muted-foreground">This scene has no text yet.</p>}
        </div>
      </aside>
    </div>
  );
}

function Highlighted({ text, marks }: { text: string; marks: { name: string; hex: string }[] }) {
  const found = findMentions(text, marks);
  if (!found.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let at = 0;
  found.forEach((m, i) => {
    out.push(<Fragment key={`t${i}`}>{text.slice(at, m.start)}</Fragment>);
    out.push(
      <mark key={`m${i}`} className="rounded-sm px-0.5 text-inherit" style={{ background: `${m.hex}2e`, boxShadow: `inset 0 -2px 0 ${m.hex}` }}>
        {text.slice(m.start, m.end)}
      </mark>,
    );
    at = m.end;
  });
  out.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return <>{out}</>;
}

function CategoryCard({ category, sceneId, items, all, onTag }: { category: BreakdownCategory; sceneId: string; items: BreakdownItem[]; all: BreakdownItem[]; onTag: (name: string) => void }) {
  const info = categoryInfo(category);
  const [draft, setDraft] = useState('');
  const listId = `bd-${category}`;
  const add = () => {
    if (!draft.trim()) return;
    onTag(draft);
    setDraft('');
  };
  return (
    <section className="flex flex-col gap-2 rounded-2xl border px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={cn('size-2.5 rounded-full', info.dot)} />
        <span className="text-[13.5px] font-semibold">{info.label}</span>
        <span className="truncate text-[11.5px] text-muted-foreground">{info.note}</span>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {items.map((item) => (
            <span key={item.id} className={cn('inline-flex h-7 items-center gap-1 rounded-full border pr-1 pl-2.5 text-[12.5px]', info.chip)}>
              {item.qty > 1 && <span className="font-mono text-[10.5px]">{item.qty}×</span>}
              {item.name}
              <button type="button" aria-label={`Take ${item.name} off this scene`} onClick={() => untagScene(item, sceneId)} className="rounded-full p-0.5 opacity-60 hover:opacity-100">
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        aria-label={`Add to ${info.label}`}
        list={listId}
        value={draft}
        placeholder={`Add ${info.label.toLowerCase()}…`}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
        className={cn(FIELD, 'h-8 text-[13px]')}
      />
      <datalist id={listId}>
        {all.filter((i) => !items.includes(i)).map((i) => (
          <option key={i.id} value={i.name} />
        ))}
      </datalist>
    </section>
  );
}

// ── Every element ──

function AllElements({ items, script, onScene }: { items: BreakdownItem[]; script: ReturnType<typeof useProductionScript>; onScene: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<BreakdownCategory | 'all'>('all');
  const q = query.trim().toLowerCase();
  const shown = items.filter((i) => (category === 'all' || i.category === category) && (!q || i.name.toLowerCase().includes(q) || i.notes.toLowerCase().includes(q)));
  const order = new Map(script.scenes.map((s, i) => [s.scene.id, i]));
  const remove = (item: BreakdownItem) => confirmDelete({ noun: 'Element', name: item.name || 'this element', area: 'film:breakdown', remove: () => deleteItem(item.id) });
  const used = BREAKDOWN_CATEGORIES.filter((c) => items.some((i) => i.category === c.id));
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-5 pb-10">
      <div className="flex max-w-[1080px] flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-[260px]">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search elements" value={query} placeholder="Search elements…" onChange={(e) => setQuery(e.target.value)} className={cn(FIELD, 'pl-8')} />
          </div>
          <PillTabs label="Category" value={category} onChange={setCategory} options={[{ value: 'all' as const, label: 'All' }, ...used.map((c) => ({ value: c.id, label: c.label }))]} />
        </div>
        {!items.length ? (
          <Empty title="Nothing Broken Down Yet">Pick a scene and tag what it needs: the props, wardrobe, vehicles and effects. Each element lists every scene that needs it here.</Empty>
        ) : (
          BREAKDOWN_CATEGORIES.filter((c) => shown.some((i) => i.category === c.id)).map((c) => (
            <section key={c.id} className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2">
                <span className={cn('size-2.5 rounded-full', c.dot)} />
                <Label>{c.label}</Label>
              </span>
              <div className="overflow-hidden rounded-2xl border">
                {shown
                  .filter((i) => i.category === c.id)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((item) => (
                    <div key={item.id} className="group/el grid grid-cols-[minmax(160px,1fr)_70px_minmax(0,1.3fr)_minmax(0,1fr)_32px] items-center gap-2 border-b px-3 py-1.5 last:border-b-0">
                      <input aria-label="Element" value={item.name} onChange={(e) => updateItem(item.id, { name: e.target.value })} className="min-w-0 bg-transparent text-[13.5px] font-medium outline-none" />
                      <label className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                        ×
                        <input aria-label="How many" type="number" min={1} value={item.qty} onChange={(e) => updateItem(item.id, { qty: Math.max(1, Number(e.target.value) || 1) })} className="w-10 bg-transparent text-foreground outline-none" />
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {[...item.sceneIds]
                          .filter((id) => order.has(id))
                          .sort((a, b) => order.get(a)! - order.get(b)!)
                          .map((id) => (
                            <button key={id} type="button" onClick={() => onScene(id)} className="rounded-full border px-1.5 font-mono text-[10.5px] hover:border-primary">
                              {script.byId.get(id)?.number}
                            </button>
                          ))}
                        {!item.sceneIds.some((id) => order.has(id)) && <span className="text-[12px] text-muted-foreground">No scenes</span>}
                      </div>
                      <input aria-label="Notes" value={item.notes} placeholder="Notes…" onChange={(e) => updateItem(item.id, { notes: e.target.value })} className="min-w-0 bg-transparent text-[12.5px] text-muted-foreground outline-none placeholder:text-muted-foreground/50" />
                      <button type="button" aria-label={`Delete ${item.name}`} onClick={() => remove(item)} className="rounded p-1 text-muted-foreground opacity-0 group-hover/el:opacity-100 hover:text-destructive focus-visible:opacity-100">
                        <Trash2Icon className="size-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

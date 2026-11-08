import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Empty, Label } from '@/components/shared/bits';
import { AREA, FIELD, Field } from '@/components/shared/Field';
import { Hint } from '@/components/shared/Hint';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SidebarSection } from '@/components/shell/Sidebar';
import { Spaces } from '@/components/shell/Spaces';
import { confirmDelete } from '@/components/tabletop/Sharing';
// A Writing world's own calendar (writing/calendar): an event's month and day.
import { EventDateField } from '@/writing/calendar/EventDateField';
import { useStorylineLayout } from '@/components/shell/layouts';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createEvent, createStoryline, restore, trash, updateEvent, updateStoryline, updateWorld } from '@/lib/actions';
import type { DeleteArea } from '@/stores/preferences';
import { useBooks, useSection, useWorld, useWorldRecords } from '@/lib/hooks';
import { itemsIn } from '@/lib/layout';
import { newId, STORY_COLORS, type Era, type Storyline, type TimelineEvent, type World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { kindInfo } from '@/lib/sections';
import { PillTabs } from '@/components/shared/bits';
import { eraEnd, eraYears } from '@/writing/timeline/days';
import { StoryDays } from '@/writing/timeline/StoryDays';

/** Settings → Deleting: a Writing world's timeline, or a campaign's. */
const timelineArea = (section: string): DeleteArea => (section === 'writing' ? 'writing:timeline' : 'tabletop:timeline');

const LANE_LABEL = 150;
const CARD = 148;
const ROW = 44;

/**
 * /timeline?event=… — the world's history in lanes, one per storyline, laid
 * out by year. The orange line is the world's "now" (its era, on World Home).
 * Pick an event to edit it below; untick a storyline to hide its lane.
 * Storylines sit in spaces and folders in the sidebar, like NPCs and maps
 * (components/shell/Spaces); the lanes run in the same order. Eras (named
 * spans of years) shade the lanes behind them. A Writing world's timeline
 * also has Story Days: a book's scenes by the day of the story.
 */
export function TimelineScreen() {
  const world = useWorld();
  const section = useSection();
  const navigate = useNavigate();
  const { event: selectedId, view, book: bookId, scene: sceneId } = useSearch({ from: '/timeline' });
  const books = useBooks();
  const days = section === 'writing' && view === 'days';
  const [eraId, setEraId] = useState<string | null>(null);
  const eras = world?.eras ?? [];
  const era = eras.find((e) => e.id === eraId);
  const { layout, save, editable, storylines } = useStorylineLayout();
  const events = useWorldRecords('events');
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  // The lanes, in the sidebar's order.
  const lines = useMemo(() => {
    const byId = new Map(storylines.map((s) => [s.id, s]));
    return layout.spaces.flatMap(itemsIn).map((id) => byId.get(id)).filter((s): s is Storyline => Boolean(s));
  }, [layout, storylines]);
  const linesById = useMemo(() => new Map(storylines.map((s) => [s.id, s])), [storylines]);
  /** Deletes a storyline and its events, asked first; Undo brings them all back. */
  const removeLine = (id: string) => {
    const line = linesById.get(id);
    if (!line) return;
    const own = events.filter((e) => e.storylineId === id);
    confirmDelete({
      noun: 'Storyline',
      name: line.name || 'Untitled Storyline',
      area: timelineArea(section),
      extra: own.length ? `Its ${own.length} ${own.length === 1 ? 'event goes' : 'events go'} with it.` : undefined,
      remove: () => {
        for (const e of own) trash('events', e.id);
        trash('storylines', id);
        return () => {
          restore('storylines', id);
          for (const e of own) restore('events', e.id);
        };
      },
      after: () => selected && own.some((e) => e.id === selected.id) && select(undefined),
    });
  };
  const shown = lines.filter((l) => !hidden.has(l.id));
  const selected = events.find((e) => e.id === selectedId);
  const nowYear = Number.parseInt(world?.era ?? '', 10);

  const select = (id: string | undefined) => {
    setEraId(null);
    void navigate({ to: '/timeline', search: id ? { event: id } : {}, replace: true });
  };
  const daysOf = (changes: { book?: string; scene?: string }) => void navigate({ to: '/timeline', search: { view: 'days', book: bookId, scene: sceneId, ...changes }, replace: true });
  const addEra = () => {
    if (!world) return;
    const years = events.map((e) => e.year);
    const from = eras.length ? Math.max(...eras.map((e) => eraEnd(e, e.from))) + 1 : years.length ? Math.min(...years) : Number.isFinite(nowYear) ? nowYear : 1;
    const made: Era = { id: newId(), name: 'New Era', from, to: from + 50, color: STORY_COLORS[eras.length % STORY_COLORS.length]! };
    updateWorld(world.id, { eras: [...eras, made] });
    select(undefined);
    setEraId(made.id);
  };
  const addEvent = () => {
    if (!world) return;
    const line = shown[0] ?? lines[0] ?? createStoryline(world.id, { name: 'Main Story' });
    const latest = events.length ? Math.max(...events.map((e) => e.year)) : Number.isFinite(nowYear) ? nowYear : 1;
    select(createEvent(world.id, line.id, { year: latest }).id);
  };

  /** The years shown: every event, plus "now", with a little room either side; even numbers for the ruler. */
  const [from, to] = useMemo(() => {
    const years = [...events.map((e) => e.year), ...(Number.isFinite(nowYear) ? [nowYear] : []), ...eras.flatMap((e) => (e.to === null ? [e.from] : [e.from, e.to]))];
    if (!years.length) return [0, 10];
    const lo = Math.min(...years) - 1;
    const hi = Math.max(...years) + 3;
    return [lo - (((lo % 2) + 2) % 2), Math.max(hi, lo + 10)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, nowYear, world?.eras]);

  return (
    <>
      <Sidebar title="Timeline" addLabel="New Event" onAdd={addEvent}>
        <SidebarSection
          title="Storylines"
          action={
            world && (
              <Hint label="New Storyline">
                <Button variant="ghost" size="icon-xs" aria-label="New Storyline" onClick={() => createStoryline(world.id)}>
                  <PlusIcon />
                </Button>
              </Hint>
            )
          }
        >
          {world && lines.length > 0 && (
            <Spaces
              scope={`${world.id}:storylines`}
              layout={layout}
              items={linesById}
              nameOf={(line) => line.name}
              editable={editable}
              noun="storyline"
              onChange={save}
              onDelete={removeLine}
              render={(line) => (
                <StorylineRow
                  key={line.id}
                  line={line}
                  count={events.filter((e) => e.storylineId === line.id).length}
                  visible={!hidden.has(line.id)}
                  onToggle={(visible) =>
                    setHidden((h) => {
                      const next = new Set(h);
                      if (visible) next.delete(line.id);
                      else next.add(line.id);
                      return next;
                    })
                  }
                />
              )}
            />
          )}
          {!lines.length && <p className="px-2.5 text-[13px] text-muted-foreground">A storyline is a lane: one character’s journey, a faction, a place’s history.</p>}
        </SidebarSection>
        {world && (
          <SidebarSection
            title="Eras"
            action={
              <Hint label="New Era">
                <Button variant="ghost" size="icon-xs" aria-label="New Era" onClick={addEra}>
                  <PlusIcon />
                </Button>
              </Hint>
            }
          >
            {eras.length ? (
              <ul className="flex flex-col gap-0.5">
                {eras
                  .slice()
                  .sort((a, b) => a.from - b.from)
                  .map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => {
                          select(undefined);
                          setEraId(e.id);
                        }}
                        className={cn('flex min-h-[30px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13.5px] hover:bg-sidebar-accent', e.id === eraId && 'bg-sidebar-accent')}
                      >
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: `var(--story-${e.color})` }} />
                        <span className="min-w-0 flex-1 truncate">{e.name || 'Untitled Era'}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{eraYears(e)}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="px-2.5 text-[13px] text-muted-foreground">An era is a span of years with a name: an age, a reign, a war.</p>
            )}
          </SidebarSection>
        )}
        {world?.era && (
          <div className="mt-auto flex flex-col gap-1.5 rounded-xl border bg-background p-3">
            <Label>Now</Label>
            <span className="text-[13px]">{world.era}</span>
            <span className="text-xs text-muted-foreground">The orange line. Change it on World Home.</span>
          </div>
        )}
      </Sidebar>

      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Timeline', world?.name ?? '', ...(days ? ['Story Days'] : [])]}>
          {section === 'writing' && (
            <PillTabs
              label="Timeline view"
              value={days ? 'days' : 'history'}
              options={[
                { value: 'history', label: 'History' },
                { value: 'days', label: 'Story Days' },
              ]}
              onChange={(v) => (v === 'days' ? daysOf({}) : select(undefined))}
            />
          )}
          {!days && (
            <>
              <span className="font-mono text-[11px] text-muted-foreground">
                {from}–{to}
              </span>
              <Button size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={addEvent}>
                <PlusIcon /> New Event
              </Button>
            </>
          )}
        </TopBar>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-7 pt-5 pb-8">
          {days ? (
            <StoryDays book={books.find((b) => b.id === bookId) ?? books[0]} books={books} onBook={(book) => daysOf({ book, scene: undefined })} selectedId={sceneId} onSelect={(scene) => daysOf({ scene })} />
          ) : (
            <>
              {events.length || lines.length || eras.length ? (
                <Lanes lines={shown} events={events} eras={eras} from={from} to={to} now={Number.isFinite(nowYear) ? nowYear : null} selectedId={selected?.id} eraId={eraId} onSelect={select} onEra={(id) => (select(undefined), setEraId(id))} />
              ) : (
                <Empty title="No Events Yet" action={<Button onClick={addEvent}>New Event</Button>}>
                  Put the world’s history in order: births, wars, betrayals, and the day the story starts.
                </Empty>
              )}
              {selected && <EventEditor key={selected.id} event={selected} lines={lines} onClose={() => select(undefined)} />}
              {era && world && <EraEditor key={era.id} world={world} era={era} onClose={() => setEraId(null)} />}
            </>
          )}
        </div>
      </main>
    </>
  );
}

function StorylineRow({ line, count, visible, onToggle }: { line: Storyline; count: number; visible: boolean; onToggle: (visible: boolean) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="group/line flex min-h-[30px] items-center gap-2.5 rounded-md px-2.5 text-[13.5px] hover:bg-sidebar-accent">
      <Checkbox checked={visible} onCheckedChange={(v) => onToggle(v === true)} aria-label={`Show ${line.name}`} />
      <Hint label="Change Color">
        <button
          type="button"
          aria-label={`Change ${line.name}'s color`}
          onClick={() => updateStoryline(line.id, { color: STORY_COLORS[line.color % STORY_COLORS.length]! })}
          className="size-2.5 shrink-0 rounded-[3px]"
          style={{ background: `var(--story-${line.color})` }}
        />
      </Hint>
      {editing ? (
        <input
          autoFocus
          aria-label="Storyline name"
          defaultValue={line.name}
          onBlur={(e) => {
            updateStoryline(line.id, { name: e.target.value.trim() || line.name });
            setEditing(false);
          }}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && (e.target as HTMLInputElement).blur()}
          className="min-w-0 flex-1 bg-transparent outline-none"
        />
      ) : (
        <button type="button" onDoubleClick={() => setEditing(true)} className="min-w-0 flex-1 truncate text-left" title="Double-click to rename">
          {line.name}
        </button>
      )}
      <span className="font-mono text-[11px] text-muted-foreground">{count || ''}</span>
    </div>
  );
}

/** The lanes: a year ruler, one row of event cards per storyline (stacked when they'd overlap), and the "now" line. */
function Lanes({
  lines,
  events,
  eras,
  from,
  to,
  now,
  selectedId,
  eraId,
  onSelect,
  onEra,
}: {
  lines: Storyline[];
  events: TimelineEvent[];
  eras: Era[];
  from: number;
  to: number;
  now: number | null;
  selectedId: string | undefined;
  eraId: string | null;
  onSelect: (id: string) => void;
  onEra: (id: string) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(el.clientWidth - LANE_LABEL, 300)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const perYear = width / (to - from);
  const x = (year: number) => (year - from) * perYear;
  const step = Math.max(1, Math.ceil(70 / perYear / 2) * 2);
  const ticks = Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
  /** An era's span on the track, clipped to what's shown. */
  const span = (era: Era) => {
    const left = Math.max(0, x(era.from));
    return { left, width: Math.max(4, Math.min(width, x(eraEnd(era, to) + 1)) - left) };
  };

  /** Each lane's cards, given rows so none overlap. */
  const layout = useMemo(
    () =>
      lines.map((line) => {
        const ends: number[] = [];
        const placed = events
          .filter((e) => e.storylineId === line.id)
          .sort((a, b) => a.year - b.year)
          .map((event) => {
            const left = Math.min(x(event.year), width - CARD);
            let row = ends.findIndex((end) => end <= left);
            if (row < 0) row = ends.length;
            ends[row] = left + CARD + 6;
            return { event, left, row };
          });
        return { line, placed, rows: Math.max(1, ends.length) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, events, width, from, to],
  );

  return (
    <div ref={track} className="overflow-hidden rounded-2xl border">
      <div className="flex border-b bg-muted/40">
        <div style={{ width: LANE_LABEL }} className="flex shrink-0 items-center px-3">
          <Label>Year</Label>
        </div>
        <div className="relative h-8 flex-1">
          {ticks.map((year) => (
            <span key={year} className={cn('absolute top-2 pl-1.5 font-mono text-[10.5px] text-muted-foreground', year === now && 'text-link')} style={{ left: x(year) }}>
              {year}
            </span>
          ))}
        </div>
      </div>
      {eras.length > 0 && (
        <div className="flex border-b">
          <div style={{ width: LANE_LABEL }} className="flex shrink-0 items-center px-3">
            <Label>Eras</Label>
          </div>
          <div className="relative h-7 flex-1">
            {eras.map((era) => (
              <button
                key={era.id}
                type="button"
                onClick={() => onEra(era.id)}
                title={`${era.name} · ${eraYears(era)}`}
                style={{ ...span(era), background: `color-mix(in oklab, var(--story-${era.color}) 28%, transparent)` }}
                className={cn('absolute top-1 bottom-1 truncate rounded-md px-2 text-left text-[11.5px] font-medium', era.id === eraId && 'ring-2 ring-primary')}
              >
                {era.name || 'Untitled Era'}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="relative">
        {eras.map((era) => (
          <div key={era.id} aria-hidden className="pointer-events-none absolute top-0 bottom-0" style={{ left: LANE_LABEL + span(era).left, width: span(era).width, background: `color-mix(in oklab, var(--story-${era.color}) 7%, transparent)` }} />
        ))}
        {now !== null && (
          <div aria-hidden className="pointer-events-none absolute top-0 bottom-0 border-l-2 border-primary" style={{ left: LANE_LABEL + x(now) }} />
        )}
        {layout.map(({ line, placed, rows }) => (
          <div key={line.id} className="flex border-t first:border-t-0">
            <div style={{ width: LANE_LABEL }} className="flex shrink-0 items-center gap-2 px-3 text-[13px] font-semibold">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: `var(--story-${line.color})` }} />
              <span className="truncate">{line.name}</span>
            </div>
            <div className="relative flex-1" style={{ height: rows * ROW + 12 }}>
              {ticks.map((year) => (
                <span key={year} aria-hidden className="absolute top-0 bottom-0 border-l border-border/50" style={{ left: x(year) }} />
              ))}
              {placed.map(({ event, left, row }) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onSelect(event.id)}
                  style={{ left, top: 6 + row * ROW, width: CARD }}
                  className={cn(
                    'absolute flex flex-col gap-px rounded-[9px] border bg-background px-2.5 py-1.5 text-left hover:border-foreground/30',
                    event.id === selectedId && 'border-2 border-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_14%,transparent)]',
                  )}
                >
                  <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                    <span className="size-[7px] rounded-[2px]" style={{ background: `var(--story-${line.color})` }} />
                    {event.year}
                    {event.when && ` · ${event.when}`}
                  </span>
                  <span className="truncate text-[12.5px] leading-tight font-medium">{event.title || 'Untitled Event'}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The selected event, edited in place: title, year, when, storyline, what happened, and who or what it involves. */
function EventEditor({ event, lines, onClose }: { event: TimelineEvent; lines: Storyline[]; onClose: () => void }) {
  const section = useSection();
  const calendar = useWorld()?.calendar;
  const entries = useWorldRecords('entries');
  const linked = event.links.map((id) => entries.find((e) => e.id === id)).filter((e) => e !== undefined);
  const unlinked = entries.filter((e) => e.name && !event.links.includes(e.id)).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  const code = `EVT-${event.id.slice(0, 4).toUpperCase()}`;

  const remove = () =>
    confirmDelete({
      noun: 'Event',
      name: event.title || 'Untitled Event',
      area: timelineArea(section),
      remove: () => {
        trash('events', event.id);
        return () => restore('events', event.id);
      },
      after: onClose,
    });

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">
          {code} · {event.year}
          {event.when && ` · ${event.when}`}
        </span>
        <span className="flex-1" />
        <Hint label="Delete Event">
          <Button variant="ghost" size="icon-sm" aria-label="Delete Event" onClick={remove}>
            <Trash2Icon />
          </Button>
        </Hint>
        <Hint label="Close">
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <XIcon />
          </Button>
        </Hint>
      </div>
      <input
        aria-label="Event title"
        value={event.title}
        placeholder="What happened?"
        onChange={(e) => updateEvent(event.id, { title: e.target.value })}
        className="bg-transparent text-[22px] font-semibold outline-none placeholder:text-muted-foreground/50"
      />
      <div className="flex flex-wrap gap-4">
        <div className="flex min-w-[320px] flex-[2] flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Year">
              <Input type="number" value={event.year} onChange={(e) => updateEvent(event.id, { year: Number(e.target.value) || 0 })} className={FIELD} />
            </Field>
            {section === 'writing' && calendar ? (
              <Field label="Day">
                <EventDateField event={event} calendar={calendar} />
              </Field>
            ) : (
              <Field label="When">
                <Input value={event.when} placeholder="9th Tide" onChange={(e) => updateEvent(event.id, { when: e.target.value })} className={FIELD} />
              </Field>
            )}
            <Field label="Storyline">
              <SelectField label="Storyline" value={event.storylineId} onChange={(storylineId) => updateEvent(event.id, { storylineId })} options={lines.map((l) => ({ value: l.id, label: l.name }))} />
            </Field>
          </div>
          <Field label="What Happened">
            <Textarea rows={4} value={event.summary} onChange={(e) => updateEvent(event.id, { summary: e.target.value })} className={cn(AREA, 'resize-y text-[14px] leading-relaxed')} />
          </Field>
        </div>
        <div className="flex min-w-[260px] flex-1 flex-col gap-2">
          <Label>Involves</Label>
          <div className="flex flex-wrap gap-1.5">
            {linked.map((entry) => (
              <Chip key={entry.id} onRemove={() => updateEvent(event.id, { links: event.links.filter((id) => id !== entry.id) })} label={entry.name}>
                <Link to="/bible/$kind/$entryId" params={{ kind: entry.kind, entryId: entry.id }} className="hover:underline">
                  {entry.name}
                </Link>
              </Chip>
            ))}
          </div>
          <SelectField
            label="Add someone or something"
            value={null as string | null}
            onChange={(id) => id && updateEvent(event.id, { links: [...event.links, id] })}
            options={[{ value: null, label: 'Add…' }, ...unlinked.map((e) => ({ value: e.id as string | null, label: `${e.name} · ${kindInfo(e.kind, section).singular}` }))]}
          />
        </div>
      </div>
    </section>
  );
}

/** The picked era, edited in place: its name, years and color. */
function EraEditor({ world, era, onClose }: { world: World; era: Era; onClose: () => void }) {
  const section = useSection();
  const set = (changes: Partial<Era>) => updateWorld(world.id, { eras: (world.eras ?? []).map((e) => (e.id === era.id ? { ...e, ...changes } : e)) });
  const remove = () =>
    confirmDelete({
      noun: 'Era',
      name: era.name || 'Untitled Era',
      area: timelineArea(section),
      remove: () => {
        const before = world.eras ?? [];
        updateWorld(world.id, { eras: before.filter((e) => e.id !== era.id) });
        return () => updateWorld(world.id, { eras: before });
      },
      after: onClose,
    });
  return (
    <section aria-label="Era" className="flex flex-col gap-4 rounded-2xl border bg-card px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">Era · {eraYears(era)}</span>
        <span className="flex-1" />
        <Hint label="Delete Era">
          <Button variant="ghost" size="icon-sm" aria-label="Delete Era" onClick={remove}>
            <Trash2Icon />
          </Button>
        </Hint>
        <Hint label="Close">
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <XIcon />
          </Button>
        </Hint>
      </div>
      <input aria-label="Era name" value={era.name} placeholder="The Long Dark" onChange={(e) => set({ name: e.target.value })} className="bg-transparent text-[22px] font-semibold outline-none placeholder:text-muted-foreground/50" />
      <div className="grid max-w-[560px] grid-cols-3 gap-3">
        <Field label="From">
          <Input type="number" value={era.from} onChange={(e) => set({ from: Number(e.target.value) || 0 })} className={FIELD} />
        </Field>
        <Field label="To">
          <Input type="number" value={era.to ?? ''} placeholder="Still going" onChange={(e) => set({ to: e.target.value === '' ? null : Number(e.target.value) || 0 })} className={FIELD} />
        </Field>
        <Field label="Color">
          <div className="flex h-9 items-center gap-1.5">
            {STORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={era.color === c}
                onClick={() => set({ color: c })}
                className={cn('size-5 rounded-full', era.color === c && 'ring-2 ring-foreground ring-offset-2 ring-offset-card')}
                style={{ background: `var(--story-${c})` }}
              />
            ))}
          </div>
        </Field>
      </div>
    </section>
  );
}

function Chip({ children, label, onRemove }: { children: ReactNode; label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-[30px] items-center gap-1.5 rounded-full border bg-background pr-1.5 pl-3 text-[12.5px]">
      {children}
      <button type="button" aria-label={`Remove ${label}`} onClick={onRemove} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground">
        <XIcon className="size-3" />
      </button>
    </span>
  );
}

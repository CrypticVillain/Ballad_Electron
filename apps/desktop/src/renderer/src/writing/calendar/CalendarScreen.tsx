import { useNavigate } from '@tanstack/react-router';
import { ArrowDownIcon, ArrowUpIcon, CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Empty, Label } from '@/components/shared/bits';
import { FIELD } from '@/components/shared/Field';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createEvent, createStoryline, updateWorld } from '@/lib/actions';
import { useWorldRecords } from '@/lib/hooks';
import { byOrder, type World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { WritingOnly } from '@/writing/common';
import { CALENDAR_PRESETS, formatDate, monthGrid, stepMonth, yearLength } from './calendar';
import type { WorldCalendar } from './model';

/**
 * Writing → Calendar (/writing/calendar): the world's own calendar. Month by
 * month, with the timeline's events on their days (pick a day for an event
 * on the Timeline, or click an empty day here to make one); and Set Up: its
 * months, the days of its week, its era.
 */
export function CalendarScreen() {
  return <WritingOnly>{(world) => <CalendarBody world={world} />}</WritingOnly>;
}

/** The year to open on: the world's "now" ("402 A.F." → 402), else 1. */
const nowYear = (world: World) => {
  const n = Number.parseInt(world.era, 10);
  return Number.isFinite(n) ? n : 1;
};

function CalendarBody({ world }: { world: World }) {
  const cal = world.calendar;
  const [tab, setTab] = useState<'month' | 'setup'>(cal ? 'month' : 'setup');
  const save = (next: WorldCalendar) => updateWorld(world.id, { calendar: next });
  const start = (make: () => WorldCalendar) => {
    save(make());
    setTab('setup');
  };
  return (
    <>
      <Sidebar title="Calendar">
        <SidebarSection title="View">
          <div className="flex flex-col gap-0.5">
            {(
              [
                ['month', 'Months'],
                ['setup', 'Set Up'],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" disabled={!cal} onClick={() => setTab(value)} className={cn('rounded-md px-2.5 py-1.5 text-left text-[13.5px] hover:bg-sidebar-accent disabled:opacity-50', tab === value && cal && 'bg-sidebar-accent font-medium')}>
                {label}
              </button>
            ))}
          </div>
        </SidebarSection>
        {cal && (
          <div className="mt-auto flex flex-col gap-1 rounded-xl border bg-background p-3 text-[12.5px]">
            <Label>This Calendar</Label>
            <span>
              {cal.months.length} months · {yearLength(cal)} days a year · {cal.weekdays.length}-day weeks
            </span>
            {cal.era && <span className="text-muted-foreground">Years end “{cal.era}”</span>}
          </div>
        )}
      </Sidebar>
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Calendar', world.name]} />
        {!cal ? (
          <div className="flex flex-1 items-center justify-center">
            <Empty
              title="No Calendar Yet"
              action={
                <span className="flex flex-wrap justify-center gap-2">
                  {CALENDAR_PRESETS.map((p) => (
                    <Button key={p.id} variant={p.id === 'familiar' ? 'default' : 'outline'} onClick={() => start(p.make)}>
                      {p.label}
                    </Button>
                  ))}
                  <Button variant="outline" onClick={() => start(() => ({ months: [{ name: 'First Month', days: 30 }], weekdays: ['First Day'], era: '' }))}>
                    From Scratch
                  </Button>
                </span>
              }
            >
              Give the world its own months, weeks and era, then put the Timeline’s events on their days.
            </Empty>
          </div>
        ) : tab === 'setup' ? (
          <SetUp cal={cal} onChange={save} />
        ) : (
          <MonthView world={world} cal={cal} />
        )}
      </main>
    </>
  );
}

// ── Month by month ───────────────────────────────────────────────────────

function MonthView({ world, cal }: { world: World; cal: WorldCalendar }) {
  const navigate = useNavigate();
  const events = useWorldRecords('events');
  const storylines = useWorldRecords('storylines');
  const [at, setAt] = useState({ year: nowYear(world), month: 1 });
  const weeks = monthGrid(cal, at.year, at.month);
  const month = cal.months[at.month - 1];
  const thisMonth = useMemo(() => events.filter((e) => e.year === at.year && e.month === at.month), [events, at]);
  const undated = useMemo(() => events.filter((e) => e.year === at.year && !e.month), [events, at.year]);
  const color = (storylineId: string) => storylines.find((s) => s.id === storylineId)?.color ?? 1;
  const open = (id: string) => void navigate({ to: '/timeline', search: { event: id } });
  /** An empty day: a new event on it. */
  const make = (day: number) => {
    const line = [...storylines].sort(byOrder)[0] ?? createStoryline(world.id, { name: 'Main Story' });
    const date = { year: at.year, month: at.month, day };
    const event = createEvent(world.id, line.id, { year: at.year, month: at.month, day, when: formatDate(cal, date) });
    toast('Event Added', { description: formatDate(cal, date), action: { label: 'Open', onClick: () => open(event.id) } });
  };
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 px-7 pt-6 pb-10">
        <header className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="icon-sm" aria-label="Month before" onClick={() => setAt(stepMonth(cal, at.year, at.month, -1))}>
            <ChevronLeftIcon />
          </Button>
          <h1 className="font-display text-[30px] leading-none font-black uppercase">{month?.name || `Month ${at.month}`}</h1>
          <Button variant="outline" size="icon-sm" aria-label="Month after" onClick={() => setAt(stepMonth(cal, at.year, at.month, 1))}>
            <ChevronRightIcon />
          </Button>
          <span className="flex items-center gap-1.5">
            <Label>Year</Label>
            <Input type="number" aria-label="Year" value={at.year} onChange={(e) => setAt({ ...at, year: Number(e.target.value) || 0 })} className="h-8 w-24" />
            {cal.era && <span className="text-[13px] text-muted-foreground">{cal.era}</span>}
          </span>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            {thisMonth.length} {thisMonth.length === 1 ? 'event' : 'events'} this month
          </span>
        </header>
        <div className="overflow-hidden rounded-2xl border">
          <div className="grid border-b bg-muted/40" style={{ gridTemplateColumns: `repeat(${Math.max(1, cal.weekdays.length)}, minmax(0, 1fr))` }}>
            {cal.weekdays.map((d, i) => (
              <span key={i} className="truncate px-2 py-1.5 text-center font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                {d}
              </span>
            ))}
          </div>
          {weeks.map((week, w) => (
            <div key={w} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: `repeat(${Math.max(1, cal.weekdays.length)}, minmax(0, 1fr))` }}>
              {week.map((day, i) => {
                const here = day ? thisMonth.filter((e) => e.day === day) : [];
                return (
                  <div key={i} className={cn('group/day flex min-h-[92px] flex-col gap-1 border-l p-1.5 first:border-l-0', !day && 'bg-muted/25')}>
                    {day && (
                      <>
                        <span className="flex items-center justify-between">
                          <span className="font-mono text-[11px] text-muted-foreground">{day}</span>
                          <button type="button" aria-label={`New event on ${day} ${month?.name}`} onClick={() => make(day)} className="text-muted-foreground opacity-0 group-hover/day:opacity-100 hover:text-foreground focus-visible:opacity-100">
                            <PlusIcon className="size-3.5" />
                          </button>
                        </span>
                        {here.map((e) => (
                          <button key={e.id} type="button" onClick={() => open(e.id)} className="truncate rounded-md px-1.5 py-0.5 text-left text-[11.5px] font-medium hover:brightness-95" style={{ background: `color-mix(in oklab, var(--story-${color(e.storylineId)}) 18%, transparent)`, boxShadow: `inset 2px 0 0 var(--story-${color(e.storylineId)})` }}>
                            {e.title || 'Untitled Event'}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {undated.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <Label>In {at.year}, no day set</Label>
            <div className="flex flex-wrap gap-1.5">
              {undated.map((e) => (
                <button key={e.id} type="button" onClick={() => open(e.id)} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] hover:bg-muted">
                  <CalendarDaysIcon className="size-3.5 text-muted-foreground" /> {e.title || 'Untitled Event'}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-muted-foreground">Open one and pick its month and day on the Timeline.</p>
          </section>
        )}
      </div>
    </div>
  );
}

// ── Set up: months, weekdays, era ────────────────────────────────────────

function SetUp({ cal, onChange }: { cal: WorldCalendar; onChange: (next: WorldCalendar) => void }) {
  const months = cal.months;
  const setMonth = (i: number, changes: Partial<WorldCalendar['months'][number]>) => onChange({ ...cal, months: months.map((m, j) => (j === i ? { ...m, ...changes } : m)) });
  const moveMonth = (i: number, by: -1 | 1) => {
    const next = [...months];
    [next[i], next[i + by]] = [next[i + by]!, next[i]!];
    onChange({ ...cal, months: next });
  };
  const removeMonth = (i: number) => {
    const before = cal;
    onChange({ ...cal, months: months.filter((_, j) => j !== i) });
    toast('Month Removed', { description: months[i]?.name, action: { label: 'Undo', onClick: () => onChange(before) } });
  };
  const setWeekday = (i: number, name: string) => onChange({ ...cal, weekdays: cal.weekdays.map((d, j) => (j === i ? name : d)) });
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-7 pt-6 pb-10">
        <p className="text-[13.5px] text-muted-foreground">
          {yearLength(cal)} days a year. Every year is the same length; day 1 of year 1 is the first day of the week. Changes here move events already given a day (they keep their month and day number).
        </p>
        <section className="flex flex-col gap-2">
          <Label>Era</Label>
          <Input aria-label="Era" value={cal.era} placeholder="A.F., Year of the Lamp…" onChange={(e) => onChange({ ...cal, era: e.target.value })} className={cn(FIELD, 'max-w-xs')} />
        </section>
        <section className="flex flex-col gap-2">
          <Label>Months · {months.length}</Label>
          <ol className="flex flex-col rounded-xl border">
            {months.map((m, i) => (
              <li key={i} className="flex items-center gap-2 border-t px-3 py-1.5 first:border-t-0">
                <span className="w-6 font-mono text-[11px] text-muted-foreground">{i + 1}</span>
                <input aria-label={`Month ${i + 1} name`} value={m.name} placeholder={`Month ${i + 1}`} onChange={(e) => setMonth(i, { name: e.target.value })} className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-[14px] font-medium outline-none hover:border-input focus:border-primary" />
                <input type="number" aria-label={`Days in ${m.name || `month ${i + 1}`}`} min={1} max={99} value={m.days} onChange={(e) => setMonth(i, { days: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })} className="h-8 w-16 rounded-md border bg-background px-2 text-[13px]" />
                <span className="w-8 text-[12px] text-muted-foreground">days</span>
                <Button variant="ghost" size="icon-xs" aria-label="Move up" disabled={i === 0} onClick={() => moveMonth(i, -1)}>
                  <ArrowUpIcon />
                </Button>
                <Button variant="ghost" size="icon-xs" aria-label="Move down" disabled={i === months.length - 1} onClick={() => moveMonth(i, 1)}>
                  <ArrowDownIcon />
                </Button>
                <Button variant="ghost" size="icon-xs" aria-label={`Remove ${m.name || 'month'}`} disabled={months.length < 2} onClick={() => removeMonth(i)} className="text-muted-foreground hover:text-destructive">
                  <XIcon />
                </Button>
              </li>
            ))}
          </ol>
          <Button variant="outline" size="sm" className="self-start" onClick={() => onChange({ ...cal, months: [...months, { name: '', days: months.at(-1)?.days ?? 30 }] })}>
            <PlusIcon /> Add Month
          </Button>
        </section>
        <section className="flex flex-col gap-2">
          <Label>Days Of The Week · {cal.weekdays.length}</Label>
          <div className="flex flex-wrap gap-1.5">
            {cal.weekdays.map((d, i) => (
              <span key={i} className="flex items-center gap-1 rounded-lg border pl-2">
                <input aria-label={`Weekday ${i + 1}`} value={d} placeholder={`Day ${i + 1}`} onChange={(e) => setWeekday(i, e.target.value)} className="h-8 w-28 bg-transparent text-[13px] outline-none" />
                <Button variant="ghost" size="icon-xs" aria-label={`Remove ${d || 'weekday'}`} disabled={cal.weekdays.length < 2} onClick={() => onChange({ ...cal, weekdays: cal.weekdays.filter((_, j) => j !== i) })}>
                  <XIcon />
                </Button>
              </span>
            ))}
            <Button variant="outline" size="sm" onClick={() => onChange({ ...cal, weekdays: [...cal.weekdays, ''] })}>
              <PlusIcon /> Add Day
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

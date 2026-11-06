import { CalendarDaysIcon, CalendarPlusIcon, ClockIcon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Label } from '@/components/shared/bits';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { updateTabletop, updateRecord } from '@/lib/actions';
import { daysBetween, dayKey, longDate, parseDay, shortDate, today, weekdayShort } from '@/lib/dates';
import { useCharacter, useLive, useRole } from '@/lib/hooks';
import { newId, type ScheduledSession, type World } from '@/lib/model';
import { tabletopDefaults } from '@/lib/sections';
import { cn } from '@/lib/utils';
import { TimeField, useFormatTime } from '@/components/shared/TimeField';

/**
 * SessionButton — the top bar's next session, on every Tabletop screen: its day
 * and start time ("Sat, Nov 7 · 7:00 PM"). Open it for the calendar, with
 * every upcoming session lit and the ones played marked, and the list of
 * what's coming. Click a day to put a session on it (a start time and a
 * title): the GM's go on the campaign's calendar, for everyone; a player's on
 * their own, for them alone ("Personal"; the campaign's are "Campaign"). Sessions also come from the session
 * log (the planned ones with a date) and the campaign's Next Session.
 */

export type Upcoming = {
  key: string;
  date: string;
  /** "19:00", or '' for the table's usual. */
  time: string;
  title: string;
  /** Where it's from: the session log, the Next Session, the campaign's calendar, or yours. */
  from: 'log' | 'next' | 'campaign' | 'mine';
  /** For the calendar's own entries, to take them off. */
  id?: string;
  number?: number;
};


/** The campaign's sessions (and, in Player view, your own): upcoming ones in order, and the days already played. */
export function useCampaignSessions(world: World, mine: ScheduledSession[] = []): { upcoming: Upcoming[]; played: string[] } {
  const books = useLive('books');
  const parts = useLive('parts');
  const scenes = useLive('scenes');
  const next = world.tabletop?.nextSession ?? '';
  const schedule = world.tabletop?.schedule;
  return useMemo(() => {
    // The GM's session log (a player's journal is their own record, not the table's schedule).
    const log = new Set(books.filter((b) => b.worldId === world.id && b.audience !== 'player').map((b) => b.id));
    const order = new Map(parts.map((p) => [p.id, p.order]));
    const sessions = scenes
      .filter((s) => log.has(s.bookId) && s.kind !== 'note')
      .sort((a, b) => (order.get(a.partId) ?? 0) - (order.get(b.partId) ?? 0) || a.order - b.order)
      .map((s, i) => ({ scene: s, number: i + 1 }));
    const isDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
    const now = today();
    const upcoming: Upcoming[] = sessions
      .filter(({ scene }) => scene.status !== 'done' && isDay(scene.when) && scene.when >= now)
      .map(({ scene, number }) => ({ key: scene.id, date: scene.when, time: '', title: scene.title, from: 'log', number }));
    const has = (date: string) => upcoming.some((u) => u.date === date && u.from !== 'mine');
    for (const s of schedule ?? []) if (s.date >= now && !has(s.date)) upcoming.push({ key: s.id, id: s.id, date: s.date, time: s.time ?? '', title: s.title ?? '', from: 'campaign' });
    if (next && next >= now && !has(next)) upcoming.push({ key: 'next', date: next, time: '', title: '', from: 'next', number: sessions.filter(({ scene }) => scene.status === 'done').length + 1 });
    for (const s of mine) if (s.date >= now) upcoming.push({ key: s.id, id: s.id, date: s.date, time: s.time ?? '', title: s.title ?? '', from: 'mine' });
    const played = sessions.filter(({ scene }) => scene.status === 'done' && isDay(scene.when)).map(({ scene }) => scene.when);
    return { upcoming: upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)), played };
  }, [books, parts, scenes, world.id, next, schedule, mine]);
}

export function SessionButton({ world }: { world: World }) {
  const gm = useRole() !== 'player';
  const pc = useCharacter();
  const tabletop = { ...tabletopDefaults(), ...world.tabletop };
  const mine = useMemo(() => (gm ? [] : (pc?.schedule ?? [])), [gm, pc?.schedule]);
  const { upcoming, played } = useCampaignSessions(world, mine);
  const next = upcoming[0];
  const usual = tabletop.sessionTime ?? '';
  const format = useFormatTime();
  const timeOf = (u: Upcoming) => format(u.time || usual);
  const [month, setMonth] = useState<Date>(() => parseDay(next?.date ?? today()));
  const [adding, setAdding] = useState<{ date: string; time: string; title: string } | null>(null);
  const when = (date: string) => (date === today() ? 'Today' : `In ${daysBetween(today(), date)} ${daysBetween(today(), date) === 1 ? 'Day' : 'Days'}`);
  const long = (date: string) => parseDay(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  /** Puts a session on the calendar: the campaign's (GM, and the Next Session if it's sooner) or yours. */
  const add = () => {
    if (!adding) return;
    const entry: ScheduledSession = { id: newId(), date: adding.date, time: adding.time || undefined, title: adding.title.trim() || undefined };
    if (gm) {
      const sooner = !tabletop.nextSession || tabletop.nextSession < today() || adding.date < tabletop.nextSession;
      updateTabletop(world.id, { schedule: [...(tabletop.schedule ?? []), entry], ...(sooner ? { nextSession: adding.date } : {}) });
    } else if (pc) {
      updateRecord('pcs', pc.id, { schedule: [...(pc.schedule ?? []), entry] });
    }
    setAdding(null);
  };
  const remove = (u: Upcoming) => {
    if (u.from === 'mine' && pc) updateRecord('pcs', pc.id, { schedule: (pc.schedule ?? []).filter((s) => s.id !== u.id) });
    if (u.from === 'campaign') updateTabletop(world.id, { schedule: (tabletop.schedule ?? []).filter((s) => s.id !== u.id) });
    if (u.from === 'next') updateTabletop(world.id, { nextSession: '' });
  };
  const removable = (u: Upcoming) => u.from === 'mine' || (gm && (u.from === 'campaign' || u.from === 'next'));
  const label = (u: Upcoming) => (u.title && (gm || u.from !== 'log') ? u.title : u.number ? `Session ${u.number}` : 'Session');

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) setMonth(parseDay(next?.date ?? today()));
        else setAdding(null);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={next ? `Sessions: next on ${longDate(next.date)}${timeOf(next) ? ` at ${timeOf(next)}` : ''}` : 'Sessions: none scheduled'}
          className={cn(
            'flex h-[34px] shrink-0 items-center gap-1.5 rounded-full border bg-background px-3 font-mono text-[11px] tracking-[0.06em] whitespace-nowrap uppercase transition-colors hover:border-foreground/30 data-[state=open]:border-primary',
            next ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          <CalendarDaysIcon className={cn('size-4', next && 'text-primary')} />
          {next ? (
            <>
              <span>
                {weekdayShort(next.date)}, {shortDate(next.date)}
              </span>
              {timeOf(next) && <span className="hidden text-muted-foreground @5xl/topbar:inline">· {timeOf(next)}</span>}
            </>
          ) : (
            <span className="hidden @4xl/topbar:inline">No Session Set</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex max-h-[calc(100vh-80px)] w-[320px] flex-col gap-3 overflow-y-auto p-0">
        <header className="flex flex-col gap-1 border-b px-4 pt-3.5 pb-3">
          <Label>Next Session</Label>
          {next ? (
            <>
              <span className="text-[17px] font-semibold">{long(next.date)}</span>
              <span className="flex items-center gap-2 font-mono text-[11.5px] text-muted-foreground uppercase">
                {timeOf(next) && (
                  <span className="flex items-center gap-1">
                    <ClockIcon className="size-3.5" /> {timeOf(next)}
                  </span>
                )}
                <span className={cn(next.date === today() && 'text-primary')}>{when(next.date)}</span>
                {next.from === 'mine' && <span>· Personal</span>}
              </span>
            </>
          ) : (
            <span className="text-[13.5px] text-muted-foreground">Nothing scheduled yet. Click a day below to add one.</span>
          )}
        </header>

        <Calendar
          mode="single"
          month={month}
          onMonthChange={setMonth}
          weekStartsOn={1}
          selected={adding ? parseDay(adding.date) : next ? parseDay(next.date) : undefined}
          onSelect={(date) => date && setAdding({ date: dayKey(date), time: usual, title: '' })}
          disabled={{ before: parseDay(today()) }}
          modifiers={{ upcoming: upcoming.filter((u) => u.from !== 'mine').map((u) => parseDay(u.date)), mine: mine.map((s) => parseDay(s.date)), played: played.map(parseDay) }}
          modifiersClassNames={{
            upcoming: '[&>button]:bg-primary/15 [&>button]:font-semibold [&>button]:text-primary',
            mine: '[&>button]:ring-2 [&>button]:ring-primary/50 [&>button]:ring-inset',
            played: '[&>button]:underline [&>button]:decoration-online [&>button]:decoration-2 [&>button]:underline-offset-4',
          }}
          className="mx-auto px-3 py-0"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 font-mono text-[10.5px] text-muted-foreground uppercase">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary/40" /> Campaign
          </span>
          {!gm && (
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm ring-2 ring-primary/50 ring-inset" /> Personal
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded bg-online" /> Played
          </span>
        </div>

        {adding && (
          <form
            className="mx-4 flex flex-col gap-2 rounded-xl border border-primary/50 bg-primary/5 px-3 py-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold">
              <CalendarPlusIcon className="size-4 text-primary" /> {long(adding.date)}
            </span>
            <div className="flex items-center gap-2">
              <TimeField label="Start time" value={adding.time} none="No Time" onChange={(time) => setAdding({ ...adding, time })} />
              <input
                autoFocus
                aria-label="Title"
                value={adding.title}
                placeholder={gm ? 'Session 4 · The Crypt' : 'A note (optional)'}
                onChange={(e) => setAdding({ ...adding, title: e.target.value })}
                className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-[12.5px] outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] text-muted-foreground">{gm ? 'On the campaign’s calendar: your players see it.' : 'On your calendar only.'}</span>
              <span className="flex gap-1">
                <Button type="button" size="xs" variant="ghost" onClick={() => setAdding(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="xs">
                  Add
                </Button>
              </span>
            </div>
          </form>
        )}

        <section className="flex flex-col gap-1 border-t px-4 py-3">
          <Label>{`Upcoming · ${upcoming.length}`}</Label>
          {upcoming.length ? (
            <ul className="flex flex-col">
              {upcoming.map((u) => (
                <li key={u.key} className="group/row flex items-center gap-2 py-1 text-[13px]">
                  <span className="w-[86px] shrink-0 font-mono text-[11px] text-muted-foreground uppercase">
                    {weekdayShort(u.date)} {shortDate(u.date)}
                  </span>
                  {/* Players see the number, not the GM's log title (it can give the plot away). */}
                  <span className="min-w-0 flex-1 truncate">
                    {label(u)}
                    {u.from === 'mine' && <span className="ml-1.5 font-mono text-[10px] text-primary uppercase">Personal</span>}
                  </span>
                  {timeOf(u) && <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{timeOf(u)}</span>}
                  {removable(u) && (
                    <button type="button" aria-label={`Take ${label(u)} off the calendar`} onClick={() => remove(u)} className="shrink-0 rounded text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:text-foreground focus-visible:opacity-100">
                      <XIcon className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">Nothing on the calendar.</p>
          )}
        </section>

        {gm && (
          <footer className="flex items-center gap-2 border-t px-4 py-3 text-[12.5px] text-muted-foreground">
            <ClockIcon className="size-3.5" /> Usual start
            <TimeField label="Usual start time" value={usual} none="None" onChange={(sessionTime) => updateTabletop(world.id, { sessionTime: sessionTime || undefined })} className="text-foreground" />
          </footer>
        )}
      </PopoverContent>
    </Popover>
  );
}

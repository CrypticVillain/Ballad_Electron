import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { CalendarDaysIcon, ClipboardListIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { Empty, Label, Led } from '@/components/shared/bits';
import { DateField } from '@/components/shared/DateField';
import { AREA } from '@/components/shared/Field';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { createShootDay, restore, trash, updateRecord } from '@/lib/actions';
import { confirmDelete } from '@/components/dnd/Sharing';
import { addDays, daysBetween, longDate, relativeDay, shortDate, today } from '@/lib/dates';
import { duration } from '@/lib/film';
import { useWorld, useWorldRecords } from '@/lib/hooks';
import type { ShootDay } from '@/lib/model';
import { cn } from '@/lib/utils';
import { PILL } from '@/film/common';
import { useProductionScript } from '@/film/script/hooks';
import { eighthsLabel } from '@/film/script/layout';
import { DayOutOfDays } from '@/film/stripboard/DayOutOfDays';
import { StripboardView } from '@/film/stripboard/StripboardView';
import { useScriptScenes } from '@/film/shots/ShotsScreen';
import { TimeField } from '@/components/shared/TimeField';

/**
 * /schedule?view=… — the shoot, day by day: each shoot day's date, call
 * time, location and the script scenes it covers (with their pages and
 * length), and notes. Tick a day off when it's in the can. Upcoming days
 * come first. The same days as a stripboard (strips: film/stripboard) or a
 * Day Out Of Days (dood); each day's call sheet is a click away.
 */
export function ScheduleScreen() {
  const world = useWorld();
  const navigate = useNavigate();
  const { view = 'days' } = useSearch({ from: '/schedule' });
  const days = useWorldRecords('shootDays');
  const places = useWorldRecords('entries').filter((e) => e.kind === 'place');
  const script = useProductionScript();
  const scenes = useScriptScenes();
  if (!world) return null;
  const setView = (next: 'days' | 'strips' | 'dood') => void navigate({ to: '/schedule', search: next === 'days' ? {} : { view: next }, replace: true });
  const tabs = (
    <div role="tablist" aria-label="View" className="flex rounded-full border p-0.5">
      {(
        [
          ['days', 'Days'],
          ['strips', 'Stripboard'],
          ['dood', 'Day Out Of Days'],
        ] as const
      ).map(([value, label]) => (
        <button key={value} type="button" role="tab" aria-selected={view === value} onClick={() => setView(value)} className={cn('rounded-full px-3 py-1 font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase', view === value && 'bg-primary text-primary-foreground')}>
          {label}
        </button>
      ))}
    </div>
  );

  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date) || a.call.localeCompare(b.call));
  const upcoming = sorted.filter((d) => !d.done);
  const done = sorted.filter((d) => d.done);
  const scheduled = new Set(days.flatMap((d) => d.sceneIds));
  const unscheduled = scenes.filter((s) => !scheduled.has(s.scene.id));
  const add = () => createShootDay(world.id, { date: upcoming.at(-1) ? addDays(upcoming.at(-1)!.date, 1) : today() });

  if (view !== 'days') {
    return (
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Schedule', view === 'strips' ? 'Stripboard' : 'Day Out Of Days']}>
          <Button variant="outline" size="sm" className={PILL} asChild>
            <Link to="/film/callsheets">
              <ClipboardListIcon /> Call Sheets
            </Link>
          </Button>
          {/* Last, so it stays put whichever view is showing. */}
          {tabs}
        </TopBar>
        {view === 'strips' ? <StripboardView world={world} days={sorted} script={script} places={places} /> : <DayOutOfDays world={world} days={sorted} script={script} />}
      </main>
    );
  }

  return (
    <>
      <Sidebar title="Schedule" addLabel="New Shoot Day" onAdd={add}>
        <div className="flex flex-col gap-1.5 rounded-xl border bg-background p-3">
          <Label>Shoot</Label>
          <span className="font-display text-[28px] leading-none font-black">
            {done.length}/{days.length}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">Days Done</span>
          {upcoming[0] && <span className="text-[13px]">Next: {relativeDay(upcoming[0].date)}</span>}
        </div>
        <SidebarSection title={`Not Scheduled · ${unscheduled.length}`}>
          {unscheduled.length ? (
            unscheduled.map(({ scene, number }) => (
              <span key={scene.id} className="flex min-h-[28px] items-center gap-2 px-2.5 text-[13px] text-muted-foreground">
                <span className="font-mono text-[11px]">{number}</span>
                <span className="truncate">{scene.title || 'Untitled Scene'}</span>
              </span>
            ))
          ) : (
            <p className="px-2.5 text-[13px] text-muted-foreground">Every scene has a shoot day.</p>
          )}
        </SidebarSection>
      </Sidebar>
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Schedule', world.name]}>
          <Button size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={add}>
            <PlusIcon /> New Shoot Day
          </Button>
          <Button variant="outline" size="sm" className={PILL} asChild>
            <Link to="/film/callsheets">
              <ClipboardListIcon /> Call Sheets
            </Link>
          </Button>
          {tabs}
        </TopBar>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-5 pb-10">
          {days.length ? (
            <div className="flex max-w-[1000px] flex-col gap-3">
              {upcoming.map((day, i) => (
                <DayCard key={day.id} day={day} index={sorted.indexOf(day) + 1} first={i === 0} places={places} scenes={scenes} />
              ))}
              {done.length > 0 && <Label className="pt-3">In The Can</Label>}
              {done.map((day) => (
                <DayCard key={day.id} day={day} index={sorted.indexOf(day) + 1} places={places} scenes={scenes} />
              ))}
            </div>
          ) : (
            <Empty title="No Shoot Days Yet" action={<Button onClick={add}>New Shoot Day</Button>}>
              Plan the shoot day by day: where, when, and which scenes.
            </Empty>
          )}
        </div>
      </main>
    </>
  );
}

function DayCard({
  day,
  index,
  first,
  places,
  scenes,
}: {
  day: ShootDay;
  index: number;
  first?: boolean;
  places: { id: string; name: string }[];
  scenes: ReturnType<typeof useScriptScenes>;
}) {
  const covered = day.sceneIds.map((id) => scenes.find((s) => s.scene.id === id)).filter((s) => s !== undefined);
  const eighths = covered.reduce((sum, s) => sum + s.eighths, 0);
  const remove = () =>
    confirmDelete({
      noun: 'Shoot Day',
      name: `the shoot day on ${shortDate(day.date)}`,
      area: 'film:schedule',
      remove: () => {
        trash('shootDays', day.id);
        return () => restore('shootDays', day.id);
      },
    });
  const until = daysBetween(today(), day.date);
  return (
    <section className={cn('flex flex-col gap-3 rounded-2xl border px-5 py-4', first && 'border-primary', day.done && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-3">
        <Checkbox checked={day.done} onCheckedChange={(v) => updateRecord('shootDays', day.id, { done: v === true })} aria-label="Shot" />
        <span className="font-mono text-[11px] text-link">DAY {index}</span>
        <DateField label="Shoot date" variant="bare" clearable={false} value={day.date} onChange={(date) => date && updateRecord('shootDays', day.id, { date })} className="text-[13px] font-semibold" />
        <span className="font-mono text-[11px] text-muted-foreground">{day.done ? 'Done' : until === 0 ? 'Today' : until > 0 ? `In ${until} Days` : `${-until} Days Ago`}</span>
        <span className="flex-1" />
        <span className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-muted-foreground">Call</span>
          <TimeField label="Call time" variant="inline" value={day.call} from="05:00" to="21:00" step={30} onChange={(call) => updateRecord('shootDays', day.id, { call })} />
        </span>
        <span className="flex items-center gap-1.5 text-[13px]">
          <Led tone={day.placeId ? 'accent' : 'off'} />
          <SelectField
            label="Location"
            variant="inline"
            value={day.placeId}
            onChange={(placeId) => updateRecord('shootDays', day.id, { placeId })}
            options={[{ value: null, label: 'No Location' }, ...places.map((p) => ({ value: p.id as string | null, label: p.name || 'Untitled' }))]}
          />
        </span>
        <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
          <Link to="/film/callsheets" search={{ day: day.id }}>
            <ClipboardListIcon /> Call Sheet
          </Link>
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Delete shoot day" onClick={remove}>
          <Trash2Icon />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {covered.map(({ scene, number }) => (
          <span key={scene.id} className="inline-flex h-[28px] items-center gap-1.5 rounded-full border bg-background pr-1.5 pl-3 text-[12.5px]">
            <span className="font-mono text-[10.5px] text-muted-foreground">{number}</span>
            {scene.title || 'Untitled Scene'}
            <button type="button" aria-label={`Remove scene ${number}`} onClick={() => updateRecord('shootDays', day.id, { sceneIds: day.sceneIds.filter((id) => id !== scene.id) })} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground">
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <SelectField
          label="Add a scene"
          variant="chip"
          value={null as string | null}
          onChange={(id) => id && updateRecord('shootDays', day.id, { sceneIds: [...day.sceneIds, id] })}
          options={[{ value: null, label: '+ Scene' }, ...scenes.filter((s) => !day.sceneIds.includes(s.scene.id)).map((s) => ({ value: s.scene.id as string | null, label: `${s.number} · ${s.scene.title || 'Untitled Scene'}` }))]}
        />
        {covered.length > 0 && (
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <CalendarDaysIcon className="size-3.5" />
            {eighthsLabel(eighths)} Pages · ≈ {duration(eighths * 7.5)}
          </span>
        )}
      </div>
      <Textarea
        aria-label="Notes"
        rows={2}
        value={day.notes}
        placeholder={`Notes for ${longDate(day.date)}: kit, catering, permits, who's needed…`}
        onChange={(e) => updateRecord('shootDays', day.id, { notes: e.target.value })}
        className={cn(AREA, 'resize-y text-[13px]')}
      />
    </section>
  );
}

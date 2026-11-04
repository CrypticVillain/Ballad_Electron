import { Link } from '@tanstack/react-router';
import { GripVerticalIcon, PlusIcon } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { Label } from '@/components/shared/bits';
import { Button } from '@/components/ui/button';
import { createShootDay, updateRecord } from '@/lib/actions';
import { addDays, shortDate, today, weekdayShort } from '@/lib/dates';
import type { Entry, ShootDay, World } from '@/lib/model';
import { cn } from '@/lib/utils';
import type { ProductionScene, ProductionScript } from '@/film/script/hooks';
import { eighthsLabel } from '@/film/script/layout';
import { moveStrip, stripTone, type StripTone } from './strips';

/**
 * Filmmaking → Stripboard: every scene as a strip, colored by interior or
 * exterior and day or night, under the shoot day it's scheduled for. Drag
 * strips between days (or back to the unscheduled pile) to plan the shoot.
 */

const TONE: Record<StripTone, string> = {
  intDay: 'bg-background',
  extDay: 'bg-yellow-100 dark:bg-yellow-400/15',
  intNight: 'bg-blue-100 dark:bg-blue-400/15',
  extNight: 'bg-green-100 dark:bg-green-400/15',
};
const TONE_LABEL: Record<StripTone, string> = { intDay: 'Int · Day', extDay: 'Ext · Day', intNight: 'Int · Night', extNight: 'Ext · Night' };

type Drop = { day: string | null; index: number };

export function StripboardView({ world, days, script, places }: { world: World; days: ShootDay[]; script: ProductionScript; places: Entry[] }) {
  const [drop, setDrop] = useState<Drop | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const scheduled = new Set(days.flatMap((d) => d.sceneIds));
  const unscheduled = script.scenes.filter((s) => !scheduled.has(s.scene.id));

  const onDrop = (target: Drop) => (e: DragEvent) => {
    e.preventDefault();
    const sceneId = e.dataTransfer.getData('text/x-ballad-strip');
    setDrop(null);
    setDragging(null);
    if (!sceneId) return;
    const changed = moveStrip(days, sceneId, target.day, target.index);
    for (const [dayId, sceneIds] of Object.entries(changed)) updateRecord('shootDays', dayId, { sceneIds });
  };
  /** Over a strip: the drop goes above it or below it, by which half the pointer is in. */
  const over = (day: string | null, index: number) => (e: DragEvent<HTMLElement>) => {
    if (!dragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const r = e.currentTarget.getBoundingClientRect();
    const at = e.clientY > r.top + r.height / 2 ? index + 1 : index;
    if (drop?.day !== day || drop.index !== at) setDrop({ day, index: at });
  };

  const strip = (s: ProductionScene, day: string | null, index: number) => (
    <div key={s.scene.id} className="relative">
      {drop?.day === day && drop.index === index && <Insert />}
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/x-ballad-strip', s.scene.id);
          e.dataTransfer.effectAllowed = 'move';
          setDragging(s.scene.id);
        }}
        onDragEnd={() => {
          setDragging(null);
          setDrop(null);
        }}
        onDragOver={over(day, index)}
        onDrop={onDrop(drop ?? { day, index })}
        className={cn(
          'grid cursor-grab items-center gap-2 border-b px-2 py-1.5 text-[12.5px] active:cursor-grabbing',
          // The unscheduled pile is narrow: number, int/ext, set, day/night, pages.
          day ? 'grid-cols-[14px_44px_44px_minmax(0,1.6fr)_52px_52px_minmax(0,1fr)_minmax(0,1fr)]' : 'grid-cols-[14px_40px_36px_minmax(0,1fr)_18px_40px]',
          TONE[stripTone(s.heading)],
          dragging === s.scene.id && 'opacity-40',
        )}
        title={TONE_LABEL[stripTone(s.heading)]}
      >
        <GripVerticalIcon className="size-3.5 text-muted-foreground" />
        <span className="font-mono text-[12px] font-bold">{s.number}</span>
        <span className="font-mono text-[10.5px] text-muted-foreground">{s.heading.ie || '—'}</span>
        <span className="truncate font-mono text-[11.5px] uppercase">{s.heading.place || s.scene.title || 'Untitled'}</span>
        <span className="font-mono text-[10.5px] text-muted-foreground">{s.heading.time ? (stripTone(s.heading).endsWith('Night') ? 'N' : 'D') : '—'}</span>
        <span className="font-mono text-[11px] tabular-nums">{eighthsLabel(s.eighths)}</span>
        {day && (
          <>
            <span className="truncate font-mono text-[11px] text-muted-foreground" title="Cast numbers">
              {s.cast.map((id) => script.castNumber.get(id)).join(', ')}
            </span>
            <span className="truncate text-[12px] text-muted-foreground">{places.find((p) => p.id === s.scene.placeId)?.name ?? s.scene.title}</span>
          </>
        )}
      </div>
    </div>
  );

  const end = (day: string | null, count: number) => (
    <div className={cn('relative min-h-8 flex-1', !count && 'flex items-center justify-center rounded-b-xl text-[12px] text-muted-foreground')} onDragOver={(e) => {
        if (!dragging) return;
        e.preventDefault();
        if (drop?.day !== day || drop.index !== count) setDrop({ day, index: count });
      }} onDrop={onDrop({ day, index: count })}>
      {drop?.day === day && drop.index === count && <Insert />}
      {!count && (day ? 'Drag scenes here' : 'Every scene is scheduled')}
    </div>
  );

  const addDay = () => createShootDay(world.id, { date: days.at(-1) ? addDays(days.at(-1)!.date, 1) : today() });

  return (
    <div className="flex min-h-0 flex-1 gap-5 px-7 pt-5 pb-10">
      <section className="flex w-[360px] shrink-0 flex-col overflow-hidden rounded-2xl border" onDragLeave={(e) => e.currentTarget === e.target && setDrop(null)}>
        <header className="flex items-baseline gap-2 border-b bg-muted/40 px-3 py-2">
          <Label>Not Scheduled</Label>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            {unscheduled.length} · {eighthsLabel(unscheduled.reduce((n, s) => n + s.eighths, 0))} pg
          </span>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {unscheduled.map((s, i) => strip(s, null, i))}
          {end(null, unscheduled.length)}
        </div>
      </section>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
        <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-muted-foreground">
          {(Object.keys(TONE) as StripTone[]).map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className={cn('size-3 rounded-sm border', TONE[t])} /> {TONE_LABEL[t]}
            </span>
          ))}
          <span className="ml-auto">Cast numbers: 1 is in the most scenes.</span>
        </div>
        {days.map((day, i) => {
          const scenes = day.sceneIds.map((id) => script.byId.get(id)).filter((s) => s !== undefined);
          const pages = scenes.reduce((n, s) => n + s.eighths, 0);
          const cast = new Set(scenes.flatMap((s) => s.cast));
          return (
            <section key={day.id} className={cn('flex flex-col overflow-hidden rounded-2xl border', day.done && 'opacity-70')}>
              <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b bg-foreground px-3 py-2 text-background">
                <span className="font-mono text-[11px] font-bold">DAY {i + 1}</span>
                <span className="text-[13px] font-semibold">
                  {weekdayShort(day.date)} {shortDate(day.date)}
                </span>
                <span className="text-[12.5px] opacity-80">{places.find((p) => p.id === day.placeId)?.name ?? 'No location'}</span>
                <span className="ml-auto font-mono text-[11px] opacity-80">
                  {scenes.length} sc · {eighthsLabel(pages)} pg · {cast.size} cast
                </span>
                <Link to="/film/callsheets" search={{ day: day.id }} className="font-mono text-[11px] underline-offset-2 opacity-80 hover:underline hover:opacity-100">
                  Call Sheet
                </Link>
              </header>
              <div className="flex flex-col">
                {scenes.map((s, k) => strip(s, day.id, k))}
                {end(day.id, scenes.length)}
              </div>
            </section>
          );
        })}
        <Button variant="outline" className="self-start" onClick={addDay}>
          <PlusIcon /> Add A Shoot Day
        </Button>
      </div>
    </div>
  );
}

const Insert = () => <div className="pointer-events-none absolute inset-x-0 -top-px z-10 h-0.5 bg-primary" />;

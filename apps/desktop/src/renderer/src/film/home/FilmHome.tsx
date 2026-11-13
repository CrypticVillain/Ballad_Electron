import { Link, useNavigate } from '@tanstack/react-router';
import { CameraIcon, CheckIcon, ContactIcon, MapPinIcon, PlusIcon, ScrollTextIcon, UsersIcon, WalletIcon, XIcon, type LucideIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { DotMeter, Label, Led, ProgressBar } from '@/components/shared/bits';
import { DateField } from '@/components/shared/DateField';
import { AREA, Field, FIELD } from '@/components/shared/Field';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { updateFilm, updateWorld } from '@/lib/actions';
import { daysBetween, relativeDay, shortDate, today } from '@/lib/dates';
import { budgetTotals, duration, money, scriptLength, shotTotals } from '@/lib/film';
import { useBooks, useLive, useWorldRecords } from '@/lib/hooks';
import { FILM_FORMATS, FILM_STAGES, type World } from '@/lib/model';
import { filmDefaults, STAGE_LABEL } from '@/lib/sections';
import { cn } from '@/lib/utils';
import { Faceplate, PlateInput, WorldsSidebar } from '@/screens/home/HomeScreen';
import { useFormatTime } from '@/components/shared/TimeField';

const TARGETS = [0, 1, 3, 5, 8, 10, 12, 15, 20, 30, 45, 60, 90, 120];

/**
 * Production Home (/, Filmmaking) — a production at a glance, run like a
 * business: its faceplate (name, logline, format), the stage it's at, the
 * script's length against the runtime you're aiming for, the shoot (shots
 * done, the next shoot day), the money (costs, income, what's left), the
 * release (date, title, description, tags) and the deliverables to tick off.
 */
export function FilmHome({ world }: { world: World }) {
  const format = useFormatTime();
  const navigate = useNavigate();
  const film = { ...filmDefaults(), ...world.film };
  const books = useBooks();
  const scenes = useLive('scenes');
  const shots = useWorldRecords('shots');
  const days = useWorldRecords('shootDays');
  const budget = useWorldRecords('budget');
  const entries = useWorldRecords('entries');

  const script = useMemo(() => {
    const ids = new Set(books.map((b) => b.id));
    return scenes.filter((s) => ids.has(s.bookId));
  }, [books, scenes]);
  const words = script.reduce((sum, s) => sum + s.words, 0);
  const length = scriptLength(words);
  const minutes = film.format.startsWith('YouTube') ? length.spokenMinutes : length.screenMinutes;
  const shot = shotTotals(shots);
  const money_ = budgetTotals(budget);
  const upcoming = days.filter((d) => !d.done && d.date >= today()).sort((a, b) => a.date.localeCompare(b.date));
  const next = upcoming[0];
  const nextPlace = entries.find((e) => e.id === next?.placeId);
  const lastScene = [...script].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const stageIndex = FILM_STAGES.indexOf(film.stage);
  const doneCount = film.checklist.filter((c) => c.done).length;
  const count = (kind: string) => entries.filter((e) => e.kind === kind).length;

  return (
    <>
      <WorldsSidebar />
      <main data-surface="page" className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Productions', world.name || 'Untitled Production']}>
          {lastScene && (
            <Button size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => void navigate({ to: '/manuscript/$sceneId', params: { sceneId: lastScene.id } })}>
              <ScrollTextIcon /> Open Script
            </Button>
          )}
        </TopBar>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex w-full max-w-[1120px] flex-col gap-5 px-7 pt-6 pb-10">
            <Faceplate
              world={world}
              lit={film.stage === 'production'}
              left={
                <>
                  <SelectField
                    label="Format"
                    variant="inline"
                    value={film.format}
                    onChange={(format) => updateFilm(world.id, { format })}
                    options={FILM_FORMATS.map((f) => ({ value: f as string, label: f.toUpperCase() }))}
                    className="text-[10px] tracking-[0.18em] text-background/80 hover:text-background"
                  />
                  ·
                  <PlateInput label="Genre" value={world.genre} placeholder="GENRE" onChange={(genre) => updateWorld(world.id, { genre })} />
                </>
              }
              right={<>{STAGE_LABEL[film.stage]}</>}
            />

            {/* The stage pipeline: click a stage to move the production there. */}
            <section aria-label="Stage" className="grid grid-cols-5 gap-1.5">
              {FILM_STAGES.map((stage, i) => (
                <button
                  key={stage}
                  type="button"
                  aria-pressed={stage === film.stage}
                  onClick={() => updateFilm(world.id, { stage })}
                  className={cn(
                    'flex flex-col items-start gap-1.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors hover:border-foreground/30',
                    i < stageIndex && 'bg-muted/60',
                    stage === film.stage && 'border-primary bg-primary/10',
                  )}
                >
                  <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                    <Led tone={stage === film.stage ? 'accent' : i < stageIndex ? 'online' : 'off'} />
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[13.5px] font-semibold">{STAGE_LABEL[stage]}</span>
                </button>
              ))}
            </section>

            <div className="grid grid-cols-3 gap-4">
              <Card title="Script" to={lastScene ? `/manuscript/${lastScene.id}` : '/manuscript'} icon={ScrollTextIcon}>
                <Big>{length.pages.toFixed(1)}</Big>
                <span className="label">Pages · {script.length} Scenes</span>
                <dl className="flex flex-col gap-1.5 pt-1">
                  <Row label={film.format.startsWith('YouTube') ? 'Read Aloud' : 'On Screen'}>≈ {duration(minutes * 60)}</Row>
                  <Row label="Target">
                    <SelectField
                      label="Target runtime"
                      variant="inline"
                      align="end"
                      value={film.targetMinutes}
                      onChange={(targetMinutes) => updateFilm(world.id, { targetMinutes })}
                      options={TARGETS.map((m) => ({ value: m, label: m ? `${m} min` : 'None' }))}
                    />
                  </Row>
                  <Row label="Locked">
                    {script.filter((s) => s.status === 'done').length} / {script.length}
                  </Row>
                </dl>
                {film.targetMinutes > 0 && <DotMeter value={minutes / film.targetMinutes} total={20} />}
              </Card>

              <Card title="Shoot" to="/schedule" icon={CameraIcon}>
                <Big>
                  {shot.done}/{shot.count}
                </Big>
                <span className="label">Shots Done · {duration(shot.seconds)} Planned</span>
                {shot.count > 0 && <ProgressBar value={shot.done / shot.count} />}
                <div className="flex flex-col gap-0.5 border-t pt-2.5">
                  <span className="label">Next Shoot Day</span>
                  {next ? (
                    <span className="text-[13.5px]">
                      <b className="font-semibold">{relativeDay(next.date)}</b> · Call {format(next.call)}
                      {nextPlace && ` · ${nextPlace.name}`}
                    </span>
                  ) : (
                    <span className="text-[13px] text-muted-foreground">None scheduled</span>
                  )}
                  <span className="font-mono text-[11px] text-muted-foreground">{upcoming.length} Days Left To Shoot</span>
                </div>
              </Card>

              <Card title="Money" to="/budget" icon={WalletIcon}>
                <Big className={money_.net.estimate < 0 ? 'text-destructive' : undefined}>{money(money_.net.estimate)}</Big>
                <span className="label">Estimated Net</span>
                <dl className="flex flex-col gap-1.5 pt-1">
                  <Row label="Costs">
                    {money(money_.cost.actual)} / {money(money_.cost.estimate)}
                  </Row>
                  <Row label="Income">
                    {money(money_.income.actual)} / {money(money_.income.estimate)}
                  </Row>
                  <Row label="Net So Far">{money(money_.net.actual)}</Row>
                </dl>
                {money_.cost.estimate > 0 && <DotMeter value={money_.cost.actual / money_.cost.estimate} total={20} />}
              </Card>
            </div>

            <div className="flex flex-wrap gap-4">
              <section className="flex min-w-[420px] flex-[3] flex-col gap-3 rounded-2xl border px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <Label>Release</Label>
                  {film.releaseDate && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {film.releaseDate >= today() ? `In ${daysBetween(today(), film.releaseDate)} Days` : `Released ${shortDate(film.releaseDate)}`}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={film.format.startsWith('YouTube') ? 'Publish Date' : 'Release Date'}>
                    <DateField label="Release date" value={film.releaseDate || null} onChange={(d) => updateFilm(world.id, { releaseDate: d ?? '' })} />
                  </Field>
                  <Field label="Tags">
                    <Input value={film.tags} placeholder="glass, documentary, how it's made" onChange={(e) => updateFilm(world.id, { tags: e.target.value })} className={FIELD} />
                  </Field>
                </div>
                <Field label="Title">
                  <Input value={film.releaseTitle} placeholder={world.name || 'The title as it will be published'} maxLength={100} onChange={(e) => updateFilm(world.id, { releaseTitle: e.target.value })} className={FIELD} />
                </Field>
                <Field label="Description">
                  <Textarea rows={4} value={film.releaseDescription} placeholder="What viewers read under the video: a hook, chapters, credits, sponsor links…" onChange={(e) => updateFilm(world.id, { releaseDescription: e.target.value })} className={cn(AREA, 'resize-y text-[13.5px] leading-relaxed')} />
                </Field>
                {film.releaseTitle.length > 0 && <span className="self-end font-mono text-[11px] text-muted-foreground">{film.releaseTitle.length} / 100 Characters</span>}
              </section>

              <Checklist world={world} done={doneCount} />
            </div>

            <section className="grid grid-cols-3 gap-3">
              <Tile to="/bible/character" icon={UsersIcon} count={count('character')} label="Cast" />
              <Tile to="/bible/crew" icon={ContactIcon} count={count('crew')} label="Crew" />
              <Tile to="/bible/place" icon={MapPinIcon} count={count('place')} label="Locations" />
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

/** The deliverables on the way to release: tick, add, remove. */
function Checklist({ world, done }: { world: World; done: number }) {
  const film = { ...filmDefaults(), ...world.film };
  const [draft, setDraft] = useState('');
  const set = (checklist: typeof film.checklist) => updateFilm(world.id, { checklist });
  const add = () => {
    if (!draft.trim()) return;
    set([...film.checklist, { label: draft.trim(), done: false }]);
    setDraft('');
  };
  return (
    <section className="flex min-w-[300px] flex-[2] flex-col gap-3 rounded-2xl border px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <Label>Deliverables</Label>
        <span className="font-mono text-[11px] text-muted-foreground">
          {done} / {film.checklist.length}
        </span>
      </div>
      {film.checklist.length > 0 && <ProgressBar value={done / film.checklist.length} />}
      <ul className="flex flex-col">
        {film.checklist.map((item, i) => (
          <li key={i} className="group/item flex items-center gap-2.5 border-t border-border/60 py-1.5 first:border-t-0">
            <Checkbox id={`deliverable-${i}`} checked={item.done} onCheckedChange={(v) => set(film.checklist.map((c, j) => (j === i ? { ...c, done: v === true } : c)))} />
            <label htmlFor={`deliverable-${i}`} className={cn('flex-1 text-[13.5px]', item.done && 'text-muted-foreground line-through')}>
              {item.label}
            </label>
            {item.done && <CheckIcon className="size-3.5 text-online" aria-hidden />}
            <button
              type="button"
              aria-label={`Remove ${item.label}`}
              onClick={() => set(film.checklist.filter((_, j) => j !== i))}
              className="rounded text-muted-foreground opacity-0 group-hover/item:opacity-100 hover:text-foreground focus-visible:opacity-100"
            >
              <XIcon className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input value={draft} placeholder="Add a deliverable" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} className={cn(FIELD, 'h-8 text-[13px]')} />
        <Button variant="outline" size="sm" onClick={add} disabled={!draft.trim()} aria-label="Add deliverable">
          <PlusIcon />
        </Button>
      </div>
    </section>
  );
}

function Card({ title, to, icon: Icon, children }: { title: string; to: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <Label>{title}</Label>
        <Link to={to} aria-label={`Open ${title}`} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Icon className="size-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function Big({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-display text-[34px] leading-none font-black tabular-nums', className)}>{children}</span>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 font-mono text-xs">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <span aria-hidden className="min-w-3 flex-1 border-b border-dotted border-muted-foreground/50" />
      <dd className="flex min-w-0 justify-end tabular-nums">{children}</dd>
    </div>
  );
}

function Tile({ to, icon: Icon, count, label }: { to: string; icon: LucideIcon; count: number; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border px-4 py-3 hover:border-foreground/30">
      <span className="flex size-[34px] items-center justify-center rounded-lg border bg-muted">
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <span className="flex-1 font-semibold">{label}</span>
      <span className="font-display text-[26px] leading-none font-black">{count}</span>
    </Link>
  );
}

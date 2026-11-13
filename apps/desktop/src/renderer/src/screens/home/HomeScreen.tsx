import { Link, useNavigate } from '@tanstack/react-router';
import { BookOpenIcon, CircleUserIcon, MapPinIcon, PenLineIcon, PlusIcon, WaypointsIcon, type LucideIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Empty, Label, Led, ProgressBar } from '@/components/shared/bits';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SIDEBAR_ROW, SIDEBAR_ROW_ON, SidebarLink, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { openWorld, startBook, updateWorld } from '@/lib/actions';
import { addDays, parseDay, relativeTime, today } from '@/lib/dates';
import { useBooks, useLive, useRole, useSection, useSectionInfo, useSectionWorlds, useWorld, useWorldRecords } from '@/lib/hooks';
import { byOrder, type Scene, type World, type Section } from '@/lib/model';
import { SECTION_INFO } from '@/lib/sections';
import { CampaignHome } from '@/screens/tabletop/CampaignHome';
import { PlayerSheet } from '@/screens/tabletop/PlayerSheet';
import { FilmHome } from '@/film/home/FilmHome';
import { seedCampaign, seedProduction } from '@/lib/seedSections';
import { formatWords, roman } from '@/lib/text';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import { PlayHome } from '@/play/home/PlayHome';
import { useUi } from '@/stores/ui';
import { useVault } from '@/stores/vault';

/** Home (/): the open section's home (World Home, Production Home, Campaign Home, Play's Home, or in Player view your character's sheet). */
export function HomeScreen() {
  const section = useSection();
  // Play's Home is Play's own (play/home).
  if (section === 'play') return <PlayHome />;
  return <SectionHome section={section} />;
}

function SectionHome({ section }: { section: Section }) {
  const world = useWorld();
  const info = SECTION_INFO[section];
  const player = useRole() === 'player';
  // Player view needs no campaign: your character's sheet is home.
  if (player) return <PlayerSheet tab="actions" />;
  if (!world) {
    return (
      <>
        <WorldsSidebar />
        <main data-surface="page" className="flex min-w-0 flex-1 items-center justify-center bg-background">
          <Empty
            title={`No ${info.container} Yet`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => useUi.getState().openWorldDialog({ kind: 'create' })}>New {info.container}</Button>
                {section !== 'writing' && (
                  <Button variant="outline" onClick={() => openWorld((section === 'tabletop' ? seedCampaign() : seedProduction()).id)}>
                    Open The Sample {info.container}
                  </Button>
                )}
              </div>
            }
          >
            {section === 'writing'
              ? 'A world holds your books, characters, places, lore and timeline.'
              : section === 'film'
                ? 'A production holds a script, its shots, shoot days, budget, cast, crew and locations: a YouTube video, a short or a feature.'
                : 'A campaign holds your session log, the party’s character sheets, encounters, a bestiary, NPCs, places and lore. Playing, not running a game? Switch to Player view (Ctrl+Shift+D): your characters don’t need a campaign.'}
          </Empty>
        </main>
      </>
    );
  }
  if (section === 'tabletop') return <CampaignHome world={world} />;
  return section === 'film' ? <FilmHome world={world} /> : <WritingHome world={world} />;
}

/**
 * A world's faceplate: its code, name and summary on the dot band, all
 * editable. `left` and `right` are the mono lines above the name (Writing: the
 * genre and "now").
 */
export function Faceplate({ world, left, right, lit }: { world: World; left: ReactNode; right: ReactNode; lit?: boolean }) {
  const info = SECTION_INFO[world.section];
  /** "PRD-001": its place among its section's worlds. */
  const number = useSectionWorlds().findIndex((w) => w.id === world.id) + 1;
  return (
    <section className="cover-dots flex flex-col gap-4 rounded-2xl px-6 py-5 text-background">
      <div className="flex flex-wrap justify-between gap-3 font-mono text-[10px] tracking-[0.18em] uppercase opacity-80">
        <span className="flex items-center gap-2">
          {info.code}-{String(number).padStart(3, '0')} ·{left}
        </span>
        <span className="flex items-center gap-2">
          <Led tone={lit ? 'accent' : 'off'} />
          {right}
        </span>
      </div>
      <input
        aria-label={`${info.container} name`}
        value={world.name}
        placeholder={`UNTITLED ${info.container.toUpperCase()}`}
        onChange={(e) => updateWorld(world.id, { name: e.target.value })}
        className="w-full bg-transparent font-display text-[52px] leading-none font-black uppercase outline-none placeholder:text-background/40"
      />
      <textarea
        aria-label="Summary"
        rows={2}
        value={world.summary}
        placeholder={world.section === 'film' ? 'The logline: who wants what, and what stands in the way.' : world.section === 'tabletop' ? 'The campaign’s pitch, as you’d tell it at the table.' : 'What is this world? A line or two.'}
        onChange={(e) => updateWorld(world.id, { summary: e.target.value })}
        className="max-w-[64ch] resize-none bg-transparent text-sm leading-relaxed opacity-85 outline-none placeholder:text-background/50"
      />
    </section>
  );
}

/** A mono field on the faceplate's top line ("GENRE", "NOW"). */
export function PlateInput({ label, value, placeholder, onChange, width = 'w-32' }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; width?: string }) {
  return <input aria-label={label} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cn(width, 'bg-transparent uppercase outline-none placeholder:text-background/50')} />;
}

/**
 * World Home — the open world at a glance: its faceplate (name, genre, "now",
 * a summary, all editable), the scene to pick up, this week's words, the
 * world bible's counts and the books.
 */
function WritingHome({ world }: { world: World }) {
  const navigate = useNavigate();
  const books = useBooks();
  const scenes = useLive('scenes');
  const entries = useWorldRecords('entries');
  const events = useWorldRecords('events');

  const bookScenes = useMemo(() => {
    const ids = new Set(books.map((b) => b.id));
    return scenes.filter((s) => ids.has(s.bookId));
  }, [books, scenes]);
  const last = useMemo(() => [...bookScenes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0], [bookScenes]);

  /** A book opens at the scene you last worked on in it. */
  const openBook = (bookId: string) => {
    const scene = bookScenes.filter((s) => s.bookId === bookId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (scene) void navigate({ to: '/manuscript/$sceneId', params: { sceneId: scene.id } });
  };

  const count = (kind: string) => entries.filter((e) => e.kind === kind).length;

  return (
    <>
      <WorldsSidebar />
      <main data-surface="page" className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Worlds', world.name || 'Untitled World']}>
          {last && (
            <Button size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => void navigate({ to: '/manuscript/$sceneId', params: { sceneId: last.id } })}>
              <PenLineIcon /> Keep Writing
            </Button>
          )}
        </TopBar>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex w-full max-w-[1120px] flex-col gap-5 px-7 pt-6 pb-10">
            <Faceplate
              world={world}
              lit={Boolean(last)}
              left={<PlateInput label="Genre" value={world.genre} placeholder="GENRE" onChange={(genre) => updateWorld(world.id, { genre })} />}
              right={
                <>
                  Now ·
                  <PlateInput label="Now, in the world's calendar" value={world.era} placeholder="YEAR" onChange={(era) => updateWorld(world.id, { era })} width="w-24" />
                </>
              }
            />

            <div className="flex flex-wrap gap-4">
              <PickUp scene={last} />
              <ThisWeek />
            </div>

            <section className="flex flex-col gap-2.5">
              <Label>The World Bible</Label>
              <div className="grid grid-cols-4 gap-3">
                <Tile to="/bible/character" icon={CircleUserIcon} count={count('character')} label="Characters" />
                <Tile to="/bible/place" icon={MapPinIcon} count={count('place')} label="Places" />
                <Tile to="/bible/lore" icon={BookOpenIcon} count={count('lore')} label="Lore" />
                <Tile to="/timeline" icon={WaypointsIcon} count={events.length} label="Timeline Events" />
              </div>
            </section>

            <section className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <Label>Books</Label>
                <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => void navigate({ to: '/manuscript/$sceneId', params: { sceneId: startBook(world.id).id } })}>
                  <PlusIcon /> New Book
                </Button>
              </div>
              <div className="flex flex-col rounded-2xl border">
                {books.map((book, i) => {
                  const own = bookScenes.filter((s) => s.bookId === book.id);
                  const words = own.reduce((sum, s) => sum + s.words, 0);
                  const done = own.filter((s) => s.status === 'done').length;
                  return (
                    <button key={book.id} type="button" onClick={() => openBook(book.id)} className="text-left flex flex-wrap items-center gap-x-6 gap-y-2 border-t px-5 py-3.5 first:border-t-0 hover:bg-muted/50">
                      <span className="font-mono text-[11px] text-muted-foreground">Book {i + 1}</span>
                      <span className="min-w-[200px] flex-1 font-semibold">{book.title || 'Untitled Book'}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {done} / {own.length} Scenes Done
                      </span>
                      <span className="w-[220px]">{book.targetWords > 0 ? <ProgressBar value={words / book.targetWords} /> : <span className="font-mono text-[11px]">{formatWords(words)} Words</span>}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

/** The scene you last worked on: where it is, its last lines, and its goal. */
function PickUp({ scene }: { scene: Scene | undefined }) {
  const navigate = useNavigate();
  const parts = useLive('parts');
  const book = useBooks().find((b) => b.id === scene?.bookId);
  if (!scene || !book) {
    return (
      <section className="flex min-w-[420px] flex-[3] flex-col justify-center gap-2 rounded-2xl border px-5 py-4">
        <Label>Pick Up Where You Left Off</Label>
        <p className="text-sm text-muted-foreground">No scenes yet. Start a book below.</p>
      </section>
    );
  }
  const part = parts.filter((p) => p.bookId === book.id).sort(byOrder);
  const partNumber = part.findIndex((p) => p.id === scene.partId) + 1;
  const tail = scene.text.length > 260 ? `…${scene.text.slice(-260).replace(/^\S*\s/, '')}` : scene.text;
  return (
    <section className="flex min-w-[420px] flex-[3] flex-col gap-3 rounded-2xl border px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <Label>Pick Up Where You Left Off</Label>
        <span className="font-mono text-[11px] text-muted-foreground">Edited {relativeTime(scene.updatedAt)}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[11.5px] tracking-[0.06em] text-link uppercase">
          {book.title} · {book.partNoun} {roman(partNumber)}
        </span>
        <h2 className="text-[22px] font-semibold">{scene.title || 'Untitled Scene'}</h2>
      </div>
      {tail ? (
        <p className="line-clamp-4 max-w-[62ch] font-[Literata,Georgia,serif] text-[15px] leading-relaxed text-foreground/85" data-selectable>
          {tail}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{scene.note || 'An empty page.'}</p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-3">
        <Button className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => void navigate({ to: '/manuscript/$sceneId', params: { sceneId: scene.id } })}>
          Keep Writing
        </Button>
        <span className="font-mono text-[11.5px] text-muted-foreground">
          {formatWords(scene.words)}
          {scene.targetWords > 0 && ` / ${formatWords(scene.targetWords)}`} words in this scene
        </span>
      </div>
    </section>
  );
}

const DOT = 250;
const DOTS = 8;

/** The last seven days as dot columns (one dot per 250 words, today in orange), the week's total, the streak and goal days. */
export function ThisWeek() {
  const days = useVault((s) => s.vault.days);
  const goal = usePreferences((s) => s.dailyGoal);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
  const words = (day: string) => {
    const record = days[day];
    return record && !record.deletedAt ? record.words : 0;
  };
  const total = week.reduce((sum, d) => sum + words(d), 0);
  const goalDays = goal > 0 ? week.filter((d) => words(d) >= goal).length : 0;
  let streak = 0;
  for (let day = words(today()) ? today() : addDays(today(), -1); words(day) > 0; day = addDays(day, -1)) streak++;

  return (
    <section className="flex min-w-[300px] flex-[2] flex-col gap-3.5 rounded-2xl border px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <Label>This Week</Label>
        <span className="font-mono text-[11px] text-muted-foreground">1 Dot = {DOT} Words</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        {week.map((day) => {
          const lit = Math.min(DOTS, Math.round(words(day) / DOT));
          return (
            <div key={day} className="flex flex-col items-center gap-1.5" title={`${formatWords(words(day))} words`}>
              <div className="flex flex-col-reverse gap-[3px]">
                {Array.from({ length: DOTS }, (_, i) => (
                  <span key={i} className={cn('size-[9px] rounded-full', i < lit ? (day === today() ? 'led-unread bg-unread' : 'bg-foreground') : 'bg-input')} />
                ))}
              </div>
              <span className={cn('font-mono text-[10.5px] text-muted-foreground', day === today() && 'text-foreground')}>{'SMTWTFS'[parseDay(day).getDay()]}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-5">
        <Stat value={formatWords(total)} label="Words" />
        <Stat value={String(streak)} label="Day Streak" />
        {goal > 0 && <Stat value={`${goalDays}/7`} label="Goal Days" accent />}
      </div>
    </section>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn('font-display text-[26px] leading-none font-black', accent && 'text-link')}>{value}</span>
      <span className="label">{label}</span>
    </div>
  );
}

function Tile({ to, icon: Icon, count, label }: { to: string; icon: LucideIcon; count: number; label: string }) {
  return (
    <Link to={to} className="flex flex-col gap-2.5 rounded-2xl border p-4 hover:border-foreground/30">
      <div className="flex items-center justify-between">
        <span className="flex size-[34px] items-center justify-center rounded-lg border bg-muted">
          <Icon className="size-[18px]" strokeWidth={1.75} />
        </span>
        <span className="font-display text-[30px] leading-none font-black">{count}</span>
      </div>
      <span className="font-semibold">{label}</span>
    </Link>
  );
}

/** The open section's world switcher, the open world's books (scripts, session logs) and its pinned entries. */
export function WorldsSidebar({ children }: { children?: ReactNode }) {
  const navigate = useNavigate();
  const info = useSectionInfo();
  const sorted = useSectionWorlds();
  const world = useWorld();
  const books = useBooks();
  const scenes = useLive('scenes');
  const entries = useWorldRecords('entries');
  const pinned = entries.filter((e) => e.pinned);

  return (
    <Sidebar title={info.containers} addLabel={`New ${info.container}`} onAdd={() => useUi.getState().openWorldDialog({ kind: 'create' })}>
      <div className="flex flex-col gap-0.5">
        {sorted.map((w) => (
          <button key={w.id} type="button" onClick={() => openWorld(w.id)} className={cn(SIDEBAR_ROW, w.id === world?.id && SIDEBAR_ROW_ON)} aria-current={w.id === world?.id ? 'true' : undefined}>
            <Led tone={w.id === world?.id ? 'accent' : 'off'} />
            <span className="min-w-0 flex-1 truncate">{w.name || `Untitled ${info.container}`}</span>
          </button>
        ))}
      </div>
      {children}
      {books.length > 0 && (
        <SidebarSection title={world?.section === 'writing' ? 'Books In This World' : world?.section === 'film' ? 'Scripts' : 'Session Logs'}>
          {books.map((book) => {
            const words = scenes.filter((s) => s.bookId === book.id).reduce((sum, s) => sum + s.words, 0);
            const lastScene = scenes.filter((s) => s.bookId === book.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
            return (
              <button key={book.id} type="button" disabled={!lastScene} onClick={() => lastScene && void navigate({ to: '/manuscript/$sceneId', params: { sceneId: lastScene.id } })} className={SIDEBAR_ROW}>
                <PenLineIcon className="size-4 shrink-0" strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate">{book.title || 'Untitled Book'}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatWords(words, true)}</span>
              </button>
            );
          })}
        </SidebarSection>
      )}
      {pinned.length > 0 && (
        <SidebarSection title="Pinned">
          {pinned.map((entry) => (
            <SidebarLink key={entry.id} to={`/bible/${entry.kind}/${entry.id}`} icon={entry.kind === 'character' ? CircleUserIcon : entry.kind === 'place' ? MapPinIcon : BookOpenIcon} label={entry.name || 'Untitled'} />
          ))}
        </SidebarSection>
      )}
    </Sidebar>
  );
}


import { useNavigate } from '@tanstack/react-router';
import {
  BookOpenIcon,
  CalendarDaysIcon,
  ClapperboardIcon,
  ContactIcon,
  FileSignatureIcon,
  GlobeIcon,
  ListChecksIcon,
  MapIcon,
  MapPinIcon,
  MusicIcon,
  NotebookPenIcon,
  PackageIcon,
  PenLineIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
  WaypointsIcon,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { PillTabs } from '@/components/shared/bits';
import { Heading, ItemPicker, NavRow, Toggle } from '@/components/shared/CopyPicker';
import { Field, FIELD } from '@/components/shared/Field';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useRecord } from '@/lib/hooks';
import { SECTION_INFO } from '@/lib/sections';
import { cn } from '@/lib/utils';
import { useVault } from '@/stores/vault';
import { createSequelNow } from './actions';
import { everything, nothing, sequel, sequelContents, sequelName, type SequelContents, type SequelPlan, type SequelSection } from './sequel';

/**
 * Writing → Copy World, and Filmmaking → Create A Sequel: a new world (or
 * production) from the open one. The first tab names it, says what comes with the world
 * itself (its sidebars' spaces and folders; Writing's calendar; whether a
 * production starts over), and starts you from everything (a world's
 * copy), the sequel (the world without the story), or nothing; each section after it is
 * ticked whole or thing by thing, with its own options. Copy Campaign's
 * dialog for the other sections (the pieces are components/shared/CopyPicker).
 */

type OptionKey = 'shots' | 'unpackGear' | 'resetActuals' | 'resetReleases' | 'resetSchedule';
type Info = { label: string; noun: string; icon: LucideIcon; note?: string; options?: { key: OptionKey; label: string; hint: string }[] };

const SECTIONS: Record<SequelSection, Info> = {
  manuscript: { label: 'Manuscript', noun: 'scenes', icon: PenLineIcon, note: 'Each scene with its book and act. Leave them all behind and the sequel starts a new book of its own.' },
  characters: { label: 'Characters', noun: 'characters', icon: UsersIcon, note: 'Relationships come along when both ends are copied.' },
  places: { label: 'Places', noun: 'places', icon: MapPinIcon },
  lore: { label: 'Lore', noun: 'lore entries', icon: BookOpenIcon },
  timeline: { label: 'Timeline', noun: 'storylines', icon: WaypointsIcon, note: 'Each storyline with its events.' },
  arcs: { label: 'Arcs', noun: 'arcs', icon: TrendingUpIcon, note: 'An arc keeps its beats in the scenes you copy. One whose book stays behind follows the sequel’s first book.' },
  research: { label: 'Research', noun: 'notes', icon: NotebookPenIcon },
  maps: { label: 'Maps', noun: 'maps', icon: MapIcon, note: 'Pins keep their places and closer maps when those come along.' },
  script: {
    label: 'Script',
    noun: 'scenes',
    icon: ClapperboardIcon,
    note: 'Each scene with its sequence. Leave them all behind and the sequel starts a new script. A copied script starts unlocked.',
    options: [{ key: 'shots', label: 'With their shots', hint: 'Each scene’s shot list and storyboard frames.' }],
  },
  cast: { label: 'Cast', noun: 'cast members', icon: UsersIcon, note: 'Relationships come along when both ends are copied.' },
  crew: { label: 'Crew', noun: 'crew members', icon: ContactIcon },
  locations: { label: 'Locations', noun: 'locations', icon: MapPinIcon },
  gear: { label: 'Gear', noun: 'gear', icon: PackageIcon, options: [{ key: 'unpackGear', label: 'Nothing packed yet', hint: 'Every item unticked on the packing list.' }] },
  budget: { label: 'Budget', noun: 'budget lines', icon: WalletIcon, options: [{ key: 'resetActuals', label: 'Estimates only', hint: 'Every line’s actual back to 0.' }] },
  releases: { label: 'Releases', noun: 'releases', icon: FileSignatureIcon, options: [{ key: 'resetReleases', label: 'Back to Needed', hint: 'Unsigned, without the day they were signed or their scans.' }] },
  schedule: { label: 'Schedule', noun: 'shoot days', icon: CalendarDaysIcon, note: 'A day keeps the scenes and people you copy.', options: [{ key: 'resetSchedule', label: 'None shot yet', hint: 'Every day back to not done.' }] },
  breakdown: { label: 'Breakdown', noun: 'breakdown items', icon: ListChecksIcon, note: 'An item keeps the scenes you copy.' },
  vfx: { label: 'VFX Shots', noun: 'VFX shots', icon: SparklesIcon },
  cues: { label: 'Music Cues', noun: 'music cues', icon: MusicIcon },
};

type Preset = 'sequel' | 'everything' | 'nothing';
const PRESETS: { value: Preset; label: string }[] = [
  { value: 'sequel', label: 'Sequel' },
  { value: 'everything', label: 'Everything' },
  { value: 'nothing', label: 'Nothing' },
];
/** Writing copies a world: everything first, and the sequel's pick as one way to start. */
const WORLD_PRESETS: { value: Preset; label: string }[] = [
  { value: 'everything', label: 'Everything' },
  { value: 'sequel', label: 'For A Sequel' },
  { value: 'nothing', label: 'Nothing' },
];
/** What the dialog says, by section: Writing copies a world, Filmmaking makes a sequel. */
const WORDS = {
  writing: { title: 'Copy World', button: 'Copy World', done: 'World Copied', presets: WORLD_PRESETS },
  film: { title: 'Create A Sequel', button: 'Create Sequel', done: 'Sequel Created', presets: PRESETS },
};
const PLANS = { sequel, everything, nothing };

const FLAGS = ['layouts', 'calendar', 'restartProduction', 'shots', 'unpackGear', 'resetActuals', 'resetReleases', 'resetSchedule'] as const;
const same = (contents: SequelContents, a: SequelPlan, b: SequelPlan) => {
  const ids = (p: SequelPlan, s: SequelSection) => p.pick[s] ?? [];
  // Options for a section that doesn't apply (the calendar of a production) don't tell presets apart.
  const flags = FLAGS.filter((k) => (contents.kind === 'writing' ? k === 'layouts' || k === 'calendar' : k !== 'calendar'));
  return contents.sections.every((s) => ids(a, s).length === ids(b, s).length && ids(a, s).every((id) => ids(b, s).includes(id))) && flags.every((k) => a[k] === b[k]);
};

export function SequelDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const world = useRecord('worlds', id);
  const [tab, setTab] = useState<'world' | SequelSection>('world');
  const [contents, setContents] = useState<SequelContents | null>(null);
  const [plan, setPlan] = useState<SequelPlan | null>(null);

  // What the world has, read once as the dialog opens (the sequel is of the world as it was then).
  useEffect(() => {
    if (!id || !world) return;
    const read = sequelContents(useVault.getState().vault, id);
    setContents(read);
    setPlan(read.kind === 'film' ? sequel(read, sequelName(world.name, 'Untitled Production')) : everything(read, `${world.name.trim() || 'Untitled World'} (Copy)`));
    setTab('world');
    // Only when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const open = Boolean(id && world && contents && plan);
  const container = contents?.kind === 'film' ? SECTION_INFO.film.container : SECTION_INFO.writing.container;
  const set = (changes: Partial<SequelPlan>) => setPlan((p) => (p ? { ...p, ...changes } : p));
  const pick = (section: SequelSection, ids: string[]) => setPlan((p) => (p ? { ...p, pick: { ...p.pick, [section]: ids } } : p));
  const words = WORDS[contents?.kind ?? 'writing'];
  const preset = contents && plan ? words.presets.find((p) => same(contents, PLANS[p.value](contents, plan.name), plan))?.value : undefined;
  const total = plan && contents ? contents.sections.reduce((n, s) => n + (plan.pick[s]?.length ?? 0), 0) : 0;

  const create = () => {
    if (!id || !plan) return;
    const { world: made, copied, undo } = createSequelNow(id, plan);
    onClose();
    void navigate({ to: '/' });
    toast(words.done, {
      description: `${made.name} · ${copied === 1 ? '1 thing' : `${copied} things`} carried over`,
      action: { label: 'Undo', onClick: undo },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="flex h-[min(640px,calc(100vh-64px))] gap-0 overflow-hidden p-0 sm:max-w-[860px]">
        {contents && plan && world && (
          <>
            <nav aria-label="What to carry over" className="flex w-[220px] shrink-0 flex-col border-r bg-sidebar p-3">
              <DialogTitle className="px-2.5 pt-1.5 pb-3 font-display text-xl leading-tight font-black uppercase">{words.title}</DialogTitle>
              <DialogDescription className="sr-only">
                Make a new {container.toLowerCase()} from {world.name}, with only what you pick.
              </DialogDescription>
              <div className="flex">
                <NavRow active={tab === 'world'} onClick={() => setTab('world')} icon={contents.kind === 'film' ? ClapperboardIcon : GlobeIcon} label={container} />
              </div>
              <div className="mx-2.5 my-2 border-t" />
              <ul className="flex flex-col gap-0.5 overflow-y-auto">
                {contents.sections.map((s) => {
                  const all = contents.items[s]?.length ?? 0;
                  const chosen = plan.pick[s]?.length ?? 0;
                  return (
                    <li key={s} className="flex items-center gap-1">
                      <Checkbox
                        aria-label={`Carry over ${SECTIONS[s].label}`}
                        disabled={!all}
                        checked={!all || !chosen ? false : chosen === all ? true : 'indeterminate'}
                        onCheckedChange={() => pick(s, chosen === all ? [] : (contents.items[s] ?? []).map((i) => i.id))}
                        className="ml-2.5"
                      />
                      <NavRow active={tab === s} onClick={() => setTab(s)} icon={SECTIONS[s].icon} label={SECTIONS[s].label} count={all ? `${chosen}/${all}` : '–'} dim={!chosen} />
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                {tab === 'world' ? (
                  <Overview contents={contents} plan={plan} preset={preset} container={container} hasCalendar={Boolean(world.calendar)} set={set} onPreset={(p) => setPlan(PLANS[p](contents, plan.name))} onSection={setTab} />
                ) : (
                  <ItemPicker
                    key={tab}
                    title={SECTIONS[tab].label}
                    note={SECTIONS[tab].note}
                    empty={`This ${container.toLowerCase()} has no ${SECTIONS[tab].noun} yet.`}
                    noun={SECTIONS[tab].noun}
                    items={contents.items[tab] ?? []}
                    chosen={plan.pick[tab] ?? []}
                    onPick={(ids) => pick(tab, ids)}
                    options={SECTIONS[tab].options?.map((o) => <Toggle key={o.key} checked={plan[o.key]} onChange={(v) => set({ [o.key]: v })} label={o.label} hint={o.hint} />)}
                  />
                )}
              </div>
              <footer className="flex items-center gap-3 border-t px-6 py-3">
                <span className="mr-auto font-mono text-[11px] text-muted-foreground">{total === 1 ? '1 thing' : `${total} things`} to carry over</span>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={create}>{words.button}</Button>
              </footer>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Overview({
  contents,
  plan,
  preset,
  container,
  hasCalendar,
  set,
  onPreset,
  onSection,
}: {
  contents: SequelContents;
  plan: SequelPlan;
  preset: Preset | undefined;
  container: string;
  hasCalendar: boolean;
  set: (changes: Partial<SequelPlan>) => void;
  onPreset: (preset: Preset) => void;
  onSection: (section: SequelSection) => void;
}) {
  const film = contents.kind === 'film';
  const about: Record<Preset, string> = film
    ? {
        sequel: 'The cast, crew, locations, gear and budget, for a new script: the production starts over.',
        everything: 'All of it, as it is now.',
        nothing: 'An empty production with this one’s name, genre and format.',
      }
    : {
        sequel: 'The world (its characters, places, lore, timeline, research, maps and calendar) for a new book, as a sequel would.',
        everything: 'All of it, the manuscript too, as it is now.',
        nothing: 'An empty world with this one’s name, genre and era.',
      };
  const toggles: ReactNode[] = [
    <Toggle key="layouts" checked={plan.layouts} onChange={(layouts) => set({ layouts })} label="How the sidebars are arranged" hint="The spaces and folders of each list." />,
  ];
  if (!film && hasCalendar) toggles.push(<Toggle key="calendar" checked={plan.calendar} onChange={(calendar) => set({ calendar })} label="Its calendar" hint="The world’s own months, weeks and holidays." />);
  if (film)
    toggles.push(
      <Toggle
        key="restart"
        checked={plan.restartProduction}
        onChange={(restartProduction) => set({ restartProduction })}
        label="Start the production over"
        hint="Back to Idea, with no release date, title or description, and the release checklist unticked. The format, runtime and tags stay."
      />,
    );
  return (
    <section className="flex flex-col gap-5">
      <Heading title={`The New ${container}`}>Its genre and summary come from this one. Pick what else carries over here, or section by section on the left.</Heading>
      <Field label="Name">
        <Input autoFocus value={plan.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} className={FIELD} />
      </Field>
      <div className="flex flex-col gap-2">
        <span className="label">Start From</span>
        <div className="flex flex-wrap items-center gap-3">
          <PillTabs label="Start from" value={preset ?? ('custom' as Preset)} options={film ? PRESETS : WORLD_PRESETS} onChange={onPreset} />
          <span className="text-[12px] text-muted-foreground">{preset ? about[preset] : 'Your own pick.'}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="label">With The {container}</span>
        <div className="-mx-3 flex flex-col">{toggles}</div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="label">Sections</span>
        <ul className="grid grid-cols-2 gap-2">
          {contents.sections.map((s) => {
            const Icon = SECTIONS[s].icon;
            const all = contents.items[s]?.length ?? 0;
            const chosen = plan.pick[s]?.length ?? 0;
            return (
              <li key={s}>
                <button type="button" onClick={() => onSection(s)} className="flex w-full items-center gap-2.5 rounded-lg border bg-background px-3 py-2 text-left hover:bg-muted/50">
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{SECTIONS[s].label}</span>
                  <span className={cn('font-mono text-[11px]', chosen ? 'text-foreground' : 'text-muted-foreground')}>{!all ? 'None' : chosen === all ? 'All' : chosen ? `${chosen} of ${all}` : 'Left Out'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-[12px] text-muted-foreground">
        Never carried over: revisions and comments{film ? ', the script’s lock and revision rounds, and cuts' : ''}. Pictures are shared between the two, not duplicated.
      </p>
    </section>
  );
}

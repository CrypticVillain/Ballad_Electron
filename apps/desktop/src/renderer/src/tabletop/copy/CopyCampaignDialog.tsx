import { useNavigate } from '@tanstack/react-router';
import {
  BookOpenIcon,
  CastleIcon,
  MapIcon,
  MapPinIcon,
  NotebookPenIcon,
  ScrollTextIcon,
  SearchIcon,
  ShieldIcon,
  SkullIcon,
  SwordsIcon,
  UsersIcon,
  WaypointsIcon,
  Grid3x3Icon,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { PillTabs } from '@/components/shared/bits';
import { Field, FIELD } from '@/components/shared/Field';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useRecord } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { useVault } from '@/stores/vault';
import { copyCampaignNow } from './actions';
import { campaignContents, COPY_SECTIONS, everything, newTable, type CampaignContents, type CopyItem, type CopyPlan, type CopySection } from './copy';

/**
 * Tabletop → Copy Campaign: a new campaign from the open one, with as much or as
 * little of it as you like. The first tab names it and sets what comes along
 * with the campaign itself (its calendar, its sidebars' spaces and folders),
 * and starts you from everything, a fresh run for a new table, or nothing;
 * each section after it (Sessions, NPCs, Maps…) is ticked whole or thing by
 * thing, with its own options (untick the checklists, reset the encounters).
 */

type Option = { key: 'untickChecklists' | 'unplaySessions' | 'resetEncounters' | 'restParty' | 'dropGmPins'; label: string; hint: string };

const UNTICK: Option = { key: 'untickChecklists', label: 'Untick every checklist', hint: 'The secrets, clues and to-dos start unticked, to run them again.' };

const SECTIONS: Record<CopySection, { label: string; noun: string; icon: LucideIcon; note?: string; options?: Option[] }> = {
  sessions: {
    label: 'Sessions',
    noun: 'sessions',
    icon: ScrollTextIcon,
    note: 'A session keeps its links to the NPCs, places and encounters you copy. Mentions of anything left out become plain text.',
    options: [{ key: 'unplaySessions', label: 'None played yet', hint: 'Played sessions go back to Prepped, without the day they were played.' }, UNTICK],
  },
  play: { label: 'Play', noun: 'scenes', icon: Grid3x3Icon, note: 'Each scene with its picture, grid and measuring.' },
  notes: { label: 'Notes', noun: 'notes', icon: NotebookPenIcon, note: 'The quests, clues and reminders beside the sessions.', options: [UNTICK] },
  encounters: {
    label: 'Encounters',
    noun: 'encounters',
    icon: SwordsIcon,
    note: 'Creatures you don’t copy stay in their fights by their stats. Party members you don’t copy leave them.',
    options: [{ key: 'resetEncounters', label: 'Reset to not started', hint: 'No initiative, round 0, everyone at full hit points with no conditions (tokens on Play’s scenes too).' }],
  },
  bestiary: { label: 'Bestiary', noun: 'creatures', icon: SkullIcon },
  party: {
    label: 'Party',
    noun: 'characters',
    icon: ShieldIcon,
    note: 'Copies are the GM’s sheets for the new campaign. A character you play yourself stays yours, in this campaign.',
    options: [{ key: 'restParty', label: 'After a long rest', hint: 'Full hit points, spell slots and uses back, no conditions.' }],
  },
  npcs: { label: 'NPCs', noun: 'NPCs', icon: UsersIcon, note: 'Relationships come along when both ends are copied.' },
  places: { label: 'Places', noun: 'places', icon: MapPinIcon },
  lore: { label: 'Lore', noun: 'lore entries', icon: BookOpenIcon },
  maps: { label: 'Maps', noun: 'maps', icon: MapIcon, options: [{ key: 'dropGmPins', label: 'Leave out GM-only pins', hint: 'Only the pins the players can see come along.' }] },
  timeline: { label: 'Timeline', noun: 'storylines', icon: WaypointsIcon, note: 'Each storyline with its events.' },
};

type Preset = 'everything' | 'newTable' | 'nothing';
const PRESETS: { value: Preset; label: string }[] = [
  { value: 'everything', label: 'Everything' },
  { value: 'newTable', label: 'New Table' },
  { value: 'nothing', label: 'Nothing' },
];

function planFor(preset: Preset, contents: CampaignContents, name: string): CopyPlan {
  if (preset === 'newTable') return newTable(contents, name);
  const all = everything(contents, name);
  if (preset === 'everything') return all;
  return { ...all, pick: Object.fromEntries(COPY_SECTIONS.map((s) => [s, []])) as unknown as CopyPlan['pick'], schedule: false, layouts: false };
}

const same = (a: CopyPlan, b: CopyPlan) =>
  COPY_SECTIONS.every((s) => a.pick[s].length === b.pick[s].length && a.pick[s].every((id) => b.pick[s].includes(id))) &&
  (['schedule', 'layouts', 'untickChecklists', 'unplaySessions', 'resetEncounters', 'restParty', 'dropGmPins'] as const).every((k) => a[k] === b[k]);

export function CopyCampaignDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const world = useRecord('worlds', id);
  const [tab, setTab] = useState<'campaign' | CopySection>('campaign');
  const [contents, setContents] = useState<CampaignContents | null>(null);
  const [plan, setPlan] = useState<CopyPlan | null>(null);

  // What the campaign has, read once as the dialog opens (the copy is of the campaign as it was then).
  useEffect(() => {
    if (!id || !world) return;
    const read = campaignContents(useVault.getState().vault, id);
    setContents(read);
    setPlan(everything(read, `${world.name || 'Untitled Campaign'} (Copy)`));
    setTab('campaign');
    // Only when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const open = Boolean(id && world && contents && plan);
  const set = (changes: Partial<CopyPlan>) => setPlan((p) => (p ? { ...p, ...changes } : p));
  const pick = (section: CopySection, ids: string[]) => setPlan((p) => (p ? { ...p, pick: { ...p.pick, [section]: ids } } : p));
  const preset = contents && plan ? PRESETS.find((p) => same(planFor(p.value, contents, plan.name), plan))?.value : undefined;
  const total = plan ? COPY_SECTIONS.reduce((n, s) => n + plan.pick[s].length, 0) : 0;

  const copy = () => {
    if (!id || !plan) return;
    const { world: copied, copied: count, undo } = copyCampaignNow(id, plan);
    onClose();
    void navigate({ to: '/' });
    toast('Campaign Copied', {
      description: `${copied.name} · ${count === 1 ? '1 thing' : `${count} things`}`,
      action: { label: 'Undo', onClick: undo },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="flex h-[min(640px,calc(100vh-64px))] gap-0 overflow-hidden p-0 sm:max-w-[860px]">
        {contents && plan && (
          <>
            <nav aria-label="What to copy" className="flex w-[220px] shrink-0 flex-col border-r bg-sidebar p-3">
              <DialogTitle className="px-2.5 pt-1.5 pb-3 font-display text-xl leading-tight font-black uppercase">Copy Campaign</DialogTitle>
              <DialogDescription className="sr-only">Make a new campaign from {world?.name}, with only what you pick.</DialogDescription>
              <div className="flex">
                <NavRow active={tab === 'campaign'} onClick={() => setTab('campaign')} icon={CastleIcon} label="Campaign" />
              </div>
              <div className="mx-2.5 my-2 border-t" />
              <ul className="flex flex-col gap-0.5 overflow-y-auto">
                {COPY_SECTIONS.map((s) => {
                  const all = contents[s].length;
                  const chosen = plan.pick[s].length;
                  return (
                    <li key={s} className="flex items-center gap-1">
                      <Checkbox
                        aria-label={`Copy ${SECTIONS[s].label}`}
                        disabled={!all}
                        checked={!all || !chosen ? false : chosen === all ? true : 'indeterminate'}
                        onCheckedChange={() => pick(s, chosen === all ? [] : contents[s].map((i) => i.id))}
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
                {tab === 'campaign' ? (
                  <Overview
                    plan={plan}
                    contents={contents}
                    preset={preset}
                    set={set}
                    onPreset={(p) => setPlan(planFor(p, contents, plan.name))}
                    onSection={setTab}
                  />
                ) : (
                  <SectionPane key={tab} section={tab} items={contents[tab]} chosen={plan.pick[tab]} plan={plan} onPick={(ids) => pick(tab, ids)} set={set} />
                )}
              </div>
              <footer className="flex items-center gap-3 border-t px-6 py-3">
                <span className="mr-auto font-mono text-[11px] text-muted-foreground">{total === 1 ? '1 thing' : `${total} things`} to copy</span>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={copy}>Copy Campaign</Button>
              </footer>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NavRow({ active, onClick, icon: Icon, label, count, dim }: { active: boolean; onClick: () => void; icon: LucideIcon; label: string; count?: string; dim?: boolean }) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex h-[34px] min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-[13.5px] text-sidebar-foreground hover:bg-sidebar-accent',
        active && 'bg-sidebar-accent text-sidebar-accent-foreground',
      )}
    >
      <Icon className={cn('size-4 shrink-0', dim ? 'text-muted-foreground/60' : 'text-muted-foreground')} />
      <span className={cn('min-w-0 flex-1 truncate', dim && 'text-muted-foreground')}>{label}</span>
      {count && <span className="font-mono text-[10.5px] text-muted-foreground">{count}</span>}
    </button>
  );
}

function Heading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-1">
      <h2 className="font-display text-2xl leading-tight font-black uppercase">{title}</h2>
      {children && <p className="text-[13px] text-muted-foreground">{children}</p>}
    </header>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <span className="flex flex-col gap-0.5">
        <span className="text-[13.5px]">{label}</span>
        {hint && <span className="text-[12px] text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

function Overview({
  plan,
  contents,
  preset,
  set,
  onPreset,
  onSection,
}: {
  plan: CopyPlan;
  contents: CampaignContents;
  preset: Preset | undefined;
  set: (changes: Partial<CopyPlan>) => void;
  onPreset: (preset: Preset) => void;
  onSection: (section: CopySection) => void;
}) {
  return (
    <section className="flex flex-col gap-5">
      <Heading title="The New Campaign">Its name, genre, rules and summary come from this one. Pick what else comes along here, or section by section on the left.</Heading>
      <Field label="Name">
        <Input autoFocus value={plan.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} className={FIELD} />
      </Field>
      <div className="flex flex-col gap-2">
        <span className="label">Start From</span>
        <div className="flex flex-wrap items-center gap-3">
          <PillTabs label="Start from" value={preset ?? ('custom' as Preset)} options={PRESETS} onChange={onPreset} />
          <span className="text-[12px] text-muted-foreground">
            {preset === 'newTable'
              ? 'The world and your prep, to run again: no party or calendar, no session played, checklists unticked, encounters reset.'
              : preset === 'nothing'
                ? 'An empty campaign with this one’s name and rules.'
                : preset === 'everything'
                  ? 'All of it, as it is now.'
                  : 'Your own pick.'}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="label">With The Campaign</span>
        <div className="-mx-3 flex flex-col">
          <Toggle checked={plan.schedule} onChange={(schedule) => set({ schedule })} label="Its session calendar" hint="The next session and the dates on the calendar." />
          <Toggle checked={plan.layouts} onChange={(layouts) => set({ layouts })} label="How the sidebars are arranged" hint="The spaces and folders of NPCs, places, lore, maps and the rest." />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="label">Sections</span>
        <ul className="grid grid-cols-2 gap-2">
          {COPY_SECTIONS.map((s) => {
            const Icon = SECTIONS[s].icon;
            const all = contents[s].length;
            const chosen = plan.pick[s].length;
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
      <p className="text-[12px] text-muted-foreground">Never copied: your players’ journals and their own maps and creatures, and what you’ve shared with them (the new campaign starts unshared). Pictures are shared between the two, not duplicated.</p>
    </section>
  );
}

function SectionPane({ section, items, chosen, plan, onPick, set }: { section: CopySection; items: CopyItem[]; chosen: string[]; plan: CopyPlan; onPick: (ids: string[]) => void; set: (changes: Partial<CopyPlan>) => void }) {
  const info = SECTIONS[section];
  const [query, setQuery] = useState('');
  const picked = useMemo(() => new Set(chosen), [chosen]);
  const shown = query.trim() ? items.filter((i) => `${i.name} ${i.detail ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())) : items;
  const toggle = (id: string, on: boolean) => onPick(on ? items.filter((i) => i.id === id || picked.has(i.id)).map((i) => i.id) : chosen.filter((x) => x !== id));
  // All / None act on what the search shows.
  const all = () => onPick(items.filter((i) => picked.has(i.id) || shown.includes(i)).map((i) => i.id));
  const none = () => onPick(chosen.filter((id) => !shown.some((i) => i.id === id)));

  return (
    <section className="flex flex-col gap-4">
      <Heading title={info.label}>{info.note}</Heading>
      {!items.length ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">This campaign has no {info.noun} yet.</p>
      ) : (
        <>
          {info.options && (
            <div className="-mx-3 flex flex-col">
              {info.options.map((o) => (
                <Toggle key={o.key} checked={plan[o.key]} onChange={(v) => set({ [o.key]: v })} label={o.label} hint={o.hint} />
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            {items.length > 8 && (
              <div className="relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label={`Search ${info.label}`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${info.noun}`} className={cn(FIELD, 'pl-8')} />
              </div>
            )}
            <span className="mr-auto font-mono text-[11px] text-muted-foreground">
              {chosen.length} of {items.length}
            </span>
            <Button variant="outline" size="sm" onClick={all}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={none}>
              Select None
            </Button>
          </div>
          <ul aria-label={info.label} className="flex flex-col rounded-xl border">
            {shown.map((item) => (
              <li key={item.id} className="border-b last:border-b-0">
                <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2 hover:bg-muted/50">
                  <Checkbox checked={picked.has(item.id)} onCheckedChange={(v) => toggle(item.id, v === true)} />
                  <span className={cn('min-w-0 flex-1 truncate text-[13.5px]', !picked.has(item.id) && 'text-muted-foreground')}>{item.name}</span>
                  {item.detail && <span className="max-w-48 shrink-0 truncate font-mono text-[11px] text-muted-foreground">{item.detail}</span>}
                </label>
              </li>
            ))}
            {!shown.length && <li className="px-3.5 py-6 text-center text-sm text-muted-foreground">Nothing matches “{query}”.</li>}
          </ul>
        </>
      )}
    </section>
  );
}

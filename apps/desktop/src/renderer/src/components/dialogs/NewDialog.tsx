import { useNavigate } from '@tanstack/react-router';
import { ArrowLeftIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, CloudIcon, GemIcon, LibraryBigIcon, MapIcon, MapPinIcon, PencilLineIcon, PlusIcon, SearchIcon, SkullIcon, SlidersHorizontalIcon, SwordsIcon, UploadIcon, UserRoundIcon, XIcon, type LucideIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { pictureKey, usePictures } from '@/components/shared/Portrait';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { createEntry as createRecordEntry, createMonster } from '@/lib/actions';
import { createEntry, editEntry, matches, nameRank, useItems } from '@/lib/compendium';
import { crValue, partyBudget, rate, RATING_LABEL, xpOf, type Rating } from '@/lib/encounterMath';
import { useCharacter, useRole, useWorld, useWorldRecords } from '@/lib/hooks';
import { bestiaryInput, DYSON_MAPS, sourceName, useLibrary } from '@/lib/library';
import { addLibraryEncounter, addLibraryMap, npcEntryInput, type Owner } from '@/lib/library/add';
import { BALLAD_ENCOUNTERS } from '@/lib/library/ballad-encounters';
import { ITEM_CATEGORIES, RARITIES } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useUi, type NewKind, type NewTarget } from '@/stores/ui';

/**
 * The New popup: every New for maps, NPCs, places, items, creatures and
 * encounters starts here. First choice, the Library (a search-and-pick list:
 * Dyson Logos's maps, the Library's NPCs and creatures, its items, Ballad's
 * ready-made encounters); second, your own (for a map, an image from this
 * computer; other cloud sources are listed, to come).
 */

/** Opens the popup: `custom` is the opener's own New; `opened` shows what the Library made (else the popup goes to it). */
export const openNew = (kind: NewKind, custom: () => void, opened?: (id: string) => void) => useUi.getState().setNewThing({ kind, custom, opened });

type Info = { noun: string; icon: LucideIcon; library: string; custom: { label: string; note: string; icon: LucideIcon } };

const INFO: Record<NewKind, Info> = {
  map: {
    noun: 'Map',
    icon: MapIcon,
    library: `One of Dyson Logos’s ${DYSON_MAPS.length} hand-drawn maps: dungeons, towns, temples and caves, free to use with credit.`,
    custom: { label: 'Upload From File', note: 'Any image on this computer: a sketch, a handout, a screenshot.', icon: UploadIcon },
  },
  npc: {
    noun: 'NPC',
    icon: UserRoundIcon,
    library: 'One of the Library’s NPCs (guards, priests, mages, bandit captains…), with their stat block written on their page.',
    custom: { label: 'Create Custom', note: 'A blank NPC to write up yourself.', icon: PencilLineIcon },
  },
  place: {
    noun: 'Place',
    icon: MapPinIcon,
    library: 'An adventure site from Dyson Logos’s maps: the place, with its map added to your Maps.',
    custom: { label: 'Create Custom', note: 'A blank place to write up yourself.', icon: PencilLineIcon },
  },
  item: {
    noun: 'Item',
    icon: GemIcon,
    library: 'Start from one of the Library’s items (weapons, armor, gear, magic items) and make it your own.',
    custom: { label: 'Create Custom', note: 'A blank homebrew item.', icon: PencilLineIcon },
  },
  monster: {
    noun: 'Creature',
    icon: SkullIcon,
    library: 'Copy any of the Library’s thousands of creatures, stat block and all.',
    custom: { label: 'Create Custom', note: 'A blank stat block to fill in.', icon: PencilLineIcon },
  },
  encounter: {
    noun: 'Encounter',
    icon: SwordsIcon,
    library: `One of Ballad’s ${BALLAD_ENCOUNTERS.length} ready-made fights, with setup, tactics and a hook, its creatures added to your Bestiary.`,
    custom: { label: 'Create Custom', note: 'An empty encounter to fill from your Bestiary.', icon: PencilLineIcon },
  },
};

/** Where maps could come from besides this computer: not yet. */
const CLOUD = ['Google Drive', 'Dropbox', 'OneDrive', 'iCloud Drive'];

export function NewDialog() {
  const target = useUi((s) => s.newThing);
  return target ? <NewForm key={target.kind} target={target} onClose={() => useUi.getState().setNewThing(null)} /> : null;
}

function NewForm({ target, onClose }: { target: NewTarget; onClose: () => void }) {
  const [step, setStep] = useState<'choose' | 'library'>('choose');
  const info = INFO[target.kind];
  /** Done in the Library: close, then show what was made (no id: just go). */
  const finish = (id: string, go: () => void) => {
    onClose();
    if (target.opened && id) target.opened(id);
    else go();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn('flex max-h-[calc(100vh-64px)] flex-col', step === 'library' ? 'h-[min(780px,calc(100vh-64px))] sm:max-w-[760px]' : 'sm:max-w-[520px]')}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-black uppercase">
            {step === 'library' && (
              <Button variant="ghost" size="icon-sm" aria-label="Back" onClick={() => setStep('choose')}>
                <ArrowLeftIcon />
              </Button>
            )}
            {step === 'library' ? `${info.noun} From The Library` : `New ${info.noun}`}
          </DialogTitle>
          <DialogDescription>{step === 'library' ? 'Pick one: it’s added at once, and yours to change.' : 'Start from the Library, or make your own.'}</DialogDescription>
        </DialogHeader>
        {step === 'choose' ? (
          <div className="flex flex-col gap-2">
            <Choice icon={LibraryBigIcon} title="From The Library" note={info.library} onClick={() => setStep('library')} primary />
            <Choice
              icon={info.custom.icon}
              title={info.custom.label}
              note={info.custom.note}
              onClick={() => {
                onClose();
                target.custom();
              }}
            />
            {target.kind === 'map' && (
              <div className="flex flex-col gap-1 pt-1">
                <span className="label px-1">Other Sources</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {CLOUD.map((name) => (
                    <div key={name} aria-disabled className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-[13px] text-muted-foreground">
                      <CloudIcon className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      <span className="font-mono text-[9.5px] tracking-[0.08em] uppercase">Soon</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <Picker kind={target.kind} finish={finish} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Choice({ icon: Icon, title, note, onClick, primary }: { icon: LucideIcon; title: string; note: string; onClick: () => void; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn('group flex items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left hover:border-primary hover:bg-primary/5', primary && 'border-primary/60')}>
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted', primary && 'bg-primary text-primary-foreground')}>
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14.5px] font-semibold">{title}</span>
        <span className="text-[12.5px] leading-snug text-muted-foreground">{note}</span>
      </span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
    </button>
  );
}

type Finish = (id: string, go: () => void) => void;

function Picker({ kind, finish }: { kind: NewKind; finish: Finish }) {
  if (kind === 'map' || kind === 'place') return <MapPicker place={kind === 'place'} finish={finish} />;
  if (kind === 'item') return <ItemPicker finish={finish} />;
  if (kind === 'encounter') return <EncounterPicker finish={finish} />;
  return <CreaturePicker npc={kind === 'npc'} finish={finish} />;
}

// ── The list ─────────────────────────────────────────────────────────────

type Option = { id: string; name: string; meta: string; search: string; thumb?: string };

/** A value a filter can take: what it shows, how many have it, and (rarities) a colored dot. */
type FilterOption = { value: string; label: string; count?: number; dot?: string };

/**
 * One filter, declared by a picker; PickList draws them all the same way:
 *
 *   range    one joined row of buttons (challenge, level), any number on
 *   tags     check-chips that wrap (rarity, kind of site), any number on
 *   select   a dropdown with "Every …" first
 *   switch   on or off (needs attunement, in the app only)
 */
type Choices = { label: string; options: FilterOption[]; value: string[]; onChange: (value: string[]) => void };
type Filter =
  | (Choices & { kind: 'range' })
  | (Choices & { kind: 'tags' })
  | { kind: 'select'; label: string; every: string; options: FilterOption[]; value: string; onChange: (value: string) => void }
  | { kind: 'switch'; label: string; note?: string; value: boolean; onChange: (value: boolean) => void };

/** What's on, as removable chips: each with how to take it off. */
function activeOf(filters: Filter[]): { key: string; label: string; off: () => void }[] {
  return filters.flatMap((f) => {
    if (f.kind === 'switch') return f.value ? [{ key: f.label, label: f.label, off: () => f.onChange(false) }] : [];
    if (f.kind === 'select') return f.value ? [{ key: f.label, label: f.options.find((o) => o.value === f.value)?.label ?? f.value, off: () => f.onChange('') }] : [];
    return f.value.map((v) => ({ key: `${f.label}:${v}`, label: `${f.kind === 'range' ? `${f.label} ` : ''}${f.options.find((o) => o.value === v)?.label ?? v}`, off: () => f.onChange(f.value.filter((x) => x !== v)) }));
  });
}

/**
 * A searchable list to pick one from, with its filters in a panel under the
 * search (Filters shows and hides it). Filters and the search narrow the list
 * together: set filters first or after typing, in any order. With the panel
 * closed, what's on shows as chips to take off one by one.
 */
function PickList({ options, placeholder, onPick, filters = [], footer }: { options: Option[] | null; placeholder: string; onPick: (id: string) => void | Promise<void>; filters?: Filter[]; footer?: ReactNode }) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const list = useMemo(
    () => (options ?? []).filter((o) => matches(query, o.name, o.meta, o.search)).sort((a, b) => nameRank(query, a.name) - nameRank(query, b.name) || a.name.localeCompare(b.name)),
    [options, query],
  );
  const shown = list.slice(0, 150);
  const active = activeOf(filters);
  const clearAll = () => active.forEach((a) => a.off());
  const pick = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      await onPick(id);
    } finally {
      setBusy(null);
    }
  };
  const rows = filters.filter((f) => f.kind === 'range' || f.kind === 'tags');
  const selects = filters.filter((f) => f.kind === 'select');
  const switches = filters.filter((f) => f.kind === 'switch');

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex gap-2">
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-background px-2.5 focus-within:border-primary">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input autoFocus aria-label="Search" value={query} placeholder={placeholder} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && shown[0] && void pick(shown[0].id)} className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground" />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
        {filters.length > 0 && (
          <Button variant="outline" aria-expanded={open} onClick={() => setOpen(!open)} className={cn('h-9 gap-1.5 rounded-lg', open && 'border-primary/60 bg-primary/5')}>
            <SlidersHorizontalIcon />
            Filters
            {active.length > 0 && <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 font-mono text-[10.5px] text-primary-foreground">{active.length}</span>}
            <ChevronDownIcon className={cn('transition-transform', open && 'rotate-180')} />
          </Button>
        )}
      </div>

      {filters.length > 0 && open && (
        <section aria-label="Filters" className="flex flex-col gap-3 rounded-xl border bg-muted/35 p-3.5">
          {rows.map((f) => (
            <div key={f.label} className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-3">
              <span className="label pt-2 text-[9.5px]">{f.label}</span>
              {f.kind === 'range' ? <Range filter={f} /> : <Tags filter={f} />}
            </div>
          ))}
          {selects.length > 0 && (
            <div className={cn('grid gap-2.5', selects.length >= 3 ? 'grid-cols-3' : selects.length === 2 ? 'grid-cols-2' : 'grid-cols-[minmax(0,260px)]')}>
              {selects.map((f) => (
                <label key={f.label} className="flex min-w-0 flex-col gap-1">
                  <span className="label text-[9.5px]">{f.label}</span>
                  <SelectField
                    label={f.label}
                    value={f.value}
                    onChange={f.onChange}
                    options={[{ value: '', label: f.every }, ...f.options.map((o) => ({ value: o.value, label: <OptionLabel option={o} /> }))]}
                    className={cn('h-8 text-[12.5px]', f.value && 'border-primary/70 bg-primary/5 dark:bg-primary/5')}
                  />
                </label>
              ))}
            </div>
          )}
          {switches.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-3">
              {switches.map((f) => (
                <label key={f.label} className="flex cursor-pointer items-center gap-2 text-[12.5px]">
                  <Switch size="sm" checked={f.value} onCheckedChange={(on) => f.onChange(on === true)} />
                  <span className="font-medium">{f.label}</span>
                  {f.note && <span className="text-muted-foreground">{f.note}</span>}
                </label>
              ))}
            </div>
          )}
        </section>
      )}

      {!open && active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {active.map((a) => (
            <button key={a.key} type="button" onClick={a.off} aria-label={`Remove ${a.label}`} className="flex h-7 items-center gap-1 rounded-full border border-primary/50 bg-primary/8 pr-1.5 pl-2.5 text-[12px] font-medium hover:border-primary">
              {a.label}
              <XIcon className="size-3 text-muted-foreground" />
            </button>
          ))}
          <button type="button" onClick={clearAll} className="px-1 text-[12px] text-muted-foreground hover:text-foreground">
            Clear All
          </button>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <span className="font-mono text-[10.5px] tracking-[0.08em] text-muted-foreground uppercase">
          {options === null ? 'Loading' : `${list.length.toLocaleString('en-US')} ${list.length === 1 ? 'result' : 'results'}${list.length > shown.length ? ` · showing the first ${shown.length}` : ''}`}
        </span>
        <span className="flex items-center gap-3 text-[12px]">
          {open && active.length > 0 && (
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">
                {active.length} {active.length === 1 ? 'filter' : 'filters'} on
              </span>
              <button type="button" onClick={clearAll} className="font-medium text-link hover:underline">
                Clear All
              </button>
            </span>
          )}
          {footer}
        </span>
      </div>
      <div role="listbox" aria-label="Results" className="min-h-[180px] flex-1 overflow-y-auto rounded-xl border">
        {options === null ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">Opening the Library…</p>
        ) : shown.length ? (
          shown.map((o) => (
            <button key={o.id} type="button" role="option" aria-selected={false} disabled={Boolean(busy)} onClick={() => void pick(o.id)} className="group flex w-full items-center gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/60 disabled:opacity-60">
              {o.thumb !== undefined && (
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
                  <img src={o.thumb} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13.5px] font-medium">{o.name}</span>
                <span className="truncate text-[11.5px] text-muted-foreground">{o.meta}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10.5px] tracking-[0.06em] text-muted-foreground uppercase group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                {busy === o.id ? 'Adding…' : (
                  <>
                    <PlusIcon className="size-3" /> Add
                  </>
                )}
              </span>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[13px] text-muted-foreground">
            <span>Nothing matches{active.length ? ' with these filters' : ''}.</span>
            {active.length > 0 && (
              <button type="button" onClick={clearAll} className="font-medium text-link hover:underline">
                Clear All Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OptionLabel({ option }: { option: FilterOption }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {option.dot && <span className={cn('size-2 shrink-0 rounded-full', option.dot)} />}
      <span className="truncate">{option.label}</span>
      {option.count !== undefined && <span className="font-mono text-[10.5px] text-muted-foreground">{option.count.toLocaleString('en-US')}</span>}
    </span>
  );
}

/** Joined buttons in one row: a range of challenge or level, any number on. */
function Range({ filter: f }: { filter: Extract<Filter, { kind: 'range' }> }) {
  return (
    <div role="group" aria-label={f.label} className="inline-flex w-fit flex-wrap rounded-lg border bg-background p-0.5">
      {f.options.map((o) => {
        const on = f.value.includes(o.value);
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => f.onChange(toggle(f.value, o.value))} className={cn('h-7 rounded-md px-3 font-mono text-[11.5px] text-muted-foreground tabular-nums hover:text-foreground', on && 'bg-primary text-primary-foreground hover:text-primary-foreground')}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Check-chips that wrap: any number on. */
function Tags({ filter: f }: { filter: Extract<Filter, { kind: 'tags' }> }) {
  return (
    <div role="group" aria-label={f.label} className="flex flex-wrap gap-1.5">
      {f.options.map((o) => {
        const on = f.value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => f.onChange(toggle(f.value, o.value))}
            className={cn('flex h-7 items-center gap-1.5 rounded-full border bg-background px-2.5 text-[12px] text-muted-foreground hover:border-foreground/30 hover:text-foreground', on && 'border-primary bg-primary/10 font-medium text-foreground hover:border-primary')}
          >
            {on ? <CheckIcon className="size-3 text-primary" /> : o.dot && <span className={cn('size-2 rounded-full', o.dot)} />}
            {o.label}
            {o.count !== undefined && <span className="font-mono text-[10.5px] text-muted-foreground">{o.count.toLocaleString('en-US')}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** How many of each value `of` gives, sorted by the value's label. */
function tally<T>(items: T[], of: (item: T) => string | string[], label: (value: string) => string = (v) => v): FilterOption[] {
  const counts = new Map<string, number>();
  for (const item of items) for (const v of [of(item)].flat()) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].map(([value, count]) => ({ value, label: label(value), count })).sort((a, b) => a.label.localeCompare(b.label));
}

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

// ── What each kind picks from ──────────────────────────────────────────

/** Whose a new thing is: the campaign's (DM), or the character you're playing (player). */
function useOwner(): Owner | null {
  const role = useRole();
  const world = useWorld();
  const pc = useCharacter();
  if (role === 'player') return pc ? { worldId: null, characterId: pc.id } : null;
  return world ? { worldId: world.id, characterId: null } : null;
}

const isNpc = (type: string) => /^Humanoid/.test(type);
const typeOf = (type: string) => type.split(' (')[0]!;

const CR_BANDS: { label: string; test: (cr: number) => boolean }[] = [
  { label: '0–1', test: (cr) => cr <= 1 },
  { label: '2–4', test: (cr) => cr >= 2 && cr <= 4 },
  { label: '5–10', test: (cr) => cr >= 5 && cr <= 10 },
  { label: '11–16', test: (cr) => cr >= 11 && cr <= 16 },
  { label: '17+', test: (cr) => cr >= 17 },
];

/** Creatures (to the Bestiary) or NPCs (as NPC entries), from the Library: by challenge, type, habitat and book. */
function CreaturePicker({ npc, finish }: { npc: boolean; finish: Finish }) {
  const library = useLibrary();
  const navigate = useNavigate();
  const owner = useOwner();
  const world = useWorld();
  const pictures = usePictures();
  const [bands, setBands] = useState<string[]>([]);
  const [type, setType] = useState('');
  const [habitat, setHabitat] = useState('');
  const [book, setBook] = useState('');
  const pool = useMemo(() => (library ? library.monsters.filter((m) => !npc || isNpc(m.type)) : []), [library, npc]);
  const options = useMemo(
    () =>
      library
        ? pool
            .filter((m) => !bands.length || CR_BANDS.some((b) => bands.includes(b.label) && b.test(crValue(m.cr))))
            .filter((m) => !type || typeOf(m.type) === type)
            .filter((m) => !habitat || m.environments.includes(habitat))
            .filter((m) => !book || m.src === book)
            .map((m) => ({ id: m.id, name: m.name, meta: `CR ${m.cr} · ${m.size} ${m.type} · ${sourceName(m.src)}`, search: `${m.type} ${m.environments.join(' ')}` }))
        : null,
    [library, pool, bands, type, habitat, book],
  );
  const pick = (id: string) => {
    const m = library?.monsters.find((x) => x.id === id);
    if (!m) return;
    const image = pictures.get(pictureKey('monsters', m.id));
    if (npc) {
      if (!world) return;
      const entry = createRecordEntry(world.id, 'character', npcEntryInput(m, image));
      toast('NPC Added', { description: `${m.name}, from ${sourceName(m.src)}.` });
      finish(entry.id, () => void navigate({ to: '/bible/$kind/$entryId', params: { kind: 'character', entryId: entry.id } }));
      return;
    }
    if (!owner) return;
    const created = createMonster(owner.worldId, { ...bestiaryInput(m, image), characterId: owner.characterId });
    toast('Copied To The Bestiary', { description: m.name });
    finish(created.id, () => void navigate({ to: '/bestiary/$monsterId', params: { monsterId: created.id } }));
  };
  const filters: Filter[] = [
    { kind: 'range', label: 'Challenge', options: CR_BANDS.map((b) => ({ value: b.label, label: b.label })), value: bands, onChange: setBands },
    ...(npc ? [] : [{ kind: 'select' as const, label: 'Type', every: 'Every type', options: tally(pool, (m) => typeOf(m.type)), value: type, onChange: setType }]),
    { kind: 'select', label: 'Habitat', every: 'Every habitat', options: tally(pool, (m) => m.environments), value: habitat, onChange: setHabitat },
    { kind: 'select', label: 'Book', every: 'Every book', options: tally(pool, (m) => m.src, sourceName), value: book, onChange: setBook },
  ];
  return <PickList options={options} placeholder={npc ? 'Search NPCs: guard, priest, mage…' : 'Search creatures: goblin, dragon, undead…'} onPick={pick} filters={filters} />;
}

/** What a Dyson Logos map shows, guessed from its title: for narrowing the list. */
const SITES: { label: string; test: RegExp }[] = [
  { label: 'Dungeons & Tombs', test: /dungeon|crypt|tomb|vault|catacomb|lair|delve|barrow|undercroft/i },
  { label: 'Caves & Mines', test: /cave|cavern|grotto|mine|tunnel/i },
  { label: 'Towns & Villages', test: /town|village|city|street|market|inn|tavern|hamlet|shop|carpenter/i },
  { label: 'Temples & Shrines', test: /temple|shrine|chapel|church|monastery|abbey|reliquary|rectory|cathedral|circle/i },
  { label: 'Towers & Keeps', test: /tower|keep|castle|fort|citadel|manor|palace|hall|house|building/i },
  { label: 'Sewers', test: /sewer|cistern|canal/i },
  { label: 'Ruins', test: /ruin/i },
  { label: 'Wilds & Islands', test: /forest|island|isle|river|lake|swamp|rock|cliff|grove|road|camp|valley|coast/i },
];

/** Dyson Logos's maps, as maps (yours or the campaign's) or as places with their maps: by kind of site, and what's in the app. */
function MapPicker({ place, finish }: { place: boolean; finish: Finish }) {
  const navigate = useNavigate();
  const owner = useOwner();
  const world = useWorld();
  const [sites, setSites] = useState<string[]>([]);
  const [bundled, setBundled] = useState(false);
  const options = useMemo(
    () =>
      DYSON_MAPS.filter((m) => !bundled || m.file)
        .filter((m) => !sites.length || SITES.some((s) => sites.includes(s.label) && s.test.test(m.title)))
        .map((m) => ({ id: m.image, name: m.title, meta: m.file ? 'Cartography by Dyson Logos · In the app' : 'Cartography by Dyson Logos · Downloads when added', search: '', thumb: m.file ? `library/maps/${m.file}` : `${m.image}?w=160` })),
    [sites, bundled],
  );
  const pick = async (id: string) => {
    const map = DYSON_MAPS.find((m) => m.image === id);
    if (!map) return;
    const to = place ? (world ? { worldId: world.id, characterId: null } : null) : owner;
    if (!to) return;
    try {
      const created = await addLibraryMap(map, to);
      if (place && world) {
        const entry = createRecordEntry(world.id, 'place', { name: map.title, tagline: 'An adventure site', about: `Its map is in Maps: ${map.title}.\n\nCartography by Dyson Logos.` });
        toast('Place Added', { description: `${map.title}, with its map in Maps.` });
        finish(entry.id, () => void navigate({ to: '/bible/$kind/$entryId', params: { kind: 'place', entryId: entry.id } }));
      } else {
        toast('Map Added', { description: `${map.title} · Cartography by Dyson Logos` });
        finish(created.id, () => void navigate({ to: '/maps/$mapId', params: { mapId: created.id } }));
      }
    } catch {
      toast.error('That map couldn’t be added', { description: map.file ? 'Its file is missing from the app.' : 'It couldn’t be downloaded. Check the connection and try again.' });
    }
  };
  const filters: Filter[] = [
    { kind: 'tags', label: place ? 'Site' : 'Shows', options: SITES.map((s) => ({ value: s.label, label: s.label, count: DYSON_MAPS.filter((m) => s.test.test(m.title)).length })), value: sites, onChange: setSites },
    { kind: 'switch', label: 'In the app only', note: `${DYSON_MAPS.filter((m) => m.file).length} come with Ballad; the rest download when added`, value: bundled, onChange: setBundled },
  ];
  return <PickList options={options} placeholder={place ? 'Search sites: temple, village, caves…' : 'Search maps: dungeon, tower, sewer…'} onPick={pick} filters={filters} />;
}

const CATEGORY_LABEL: Record<string, string> = { Weapon: 'Weapons', Armor: 'Armor', Gear: 'Adventuring Gear', Tools: 'Tools', 'Mounts & Vehicles': 'Mounts & Vehicles', 'Magic Item': 'Magic Items' };
/** Each rarity's dot, from plain to precious. */
const RARITY_DOT: Record<string, string> = { Common: 'bg-muted-foreground/50', Uncommon: 'bg-online', Rare: 'bg-sky-500', 'Very Rare': 'bg-violet-500', Legendary: 'bg-amber-500', Artifact: 'bg-destructive' };

/** The Library's items, copied as the start of your own (homebrew): by category, rarity, attunement and book. */
function ItemPicker({ finish }: { finish: Finish }) {
  const navigate = useNavigate();
  const items = useItems();
  const [category, setCategory] = useState('');
  const [rarities, setRarities] = useState<string[]>([]);
  const [attunement, setAttunement] = useState(false);
  const [book, setBook] = useState('');
  const pool = useMemo(() => items.filter((s) => s.source !== 'homebrew' && !s.hidden), [items]);
  const options = useMemo(
    () =>
      pool
        .filter((s) => !category || s.category === category)
        .filter((s) => !rarities.length || rarities.includes(s.rarity))
        .filter((s) => !attunement || s.attunement)
        .filter((s) => !book || (s.book ?? 'srd-2014') === book)
        .map((s) => ({ id: s.id, name: s.name, meta: [s.rarity ? `${s.rarity} ${s.type.split(',')[0]}` : s.type, s.cost, sourceName(s.book ?? 'srd-2014')].filter(Boolean).join(' · '), search: `${s.type} ${s.category} ${s.stats}` })),
    [pool, category, rarities, attunement, book],
  );
  const pick = (id: string) => {
    const from = items.find((s) => s.id === id);
    if (!from) return;
    const made = createEntry('items');
    const copy = { name: `${from.name} (Copy)`, category: from.category, type: from.type, rarity: from.rarity, attunement: from.attunement, cost: from.cost, weight: from.weight, stats: from.stats, text: from.text };
    editEntry('items', { ...copy, id: made, source: 'homebrew', hidden: false, recordId: made }, copy);
    toast('Item Copied', { description: `${copy.name}: change it however you like.` });
    finish(made, () => void navigate({ to: '/items', search: { id: made } }));
  };
  const filters: Filter[] = [
    { kind: 'tags', label: 'Rarity', options: RARITIES.map((r) => ({ value: r, label: r, dot: RARITY_DOT[r] })), value: rarities, onChange: setRarities },
    { kind: 'select', label: 'Category', every: 'Every category', options: ITEM_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] ?? c, count: pool.filter((s) => s.category === c).length })), value: category, onChange: setCategory },
    { kind: 'select', label: 'Book', every: 'Every book', options: tally(pool, (s) => s.book ?? 'srd-2014', sourceName), value: book, onChange: setBook },
    { kind: 'switch', label: 'Needs attunement', value: attunement, onChange: setAttunement },
  ];
  return <PickList options={options} placeholder="Search items: rope, longsword, +1…" onPick={pick} filters={filters} />;
}

const TIERS: { label: string; test: (level: number) => boolean }[] = [
  { label: '1–4', test: (l) => l <= 4 },
  { label: '5–10', test: (l) => l >= 5 && l <= 10 },
  { label: '11–16', test: (l) => l >= 11 && l <= 16 },
  { label: '17–20', test: (l) => l >= 17 },
];
const RATING_DOT: Partial<Record<Rating, string>> = { low: 'bg-online', moderate: 'bg-amber-500', high: 'bg-primary', beyond: 'bg-destructive' };

/** Ballad's ready-made fights, rated for the campaign's party: by level, habitat and how hard they are for you. */
function EncounterPicker({ finish }: { finish: Finish }) {
  const navigate = useNavigate();
  const library = useLibrary();
  const world = useWorld();
  const pcs = useWorldRecords('pcs');
  const bestiary = useWorldRecords('monsters');
  const pictures = usePictures();
  const [tiers, setTiers] = useState<string[]>([]);
  const [habitat, setHabitat] = useState('');
  const [ratings, setRatings] = useState<string[]>([]);
  const levels = useMemo(() => (pcs.length ? pcs.map((pc) => pc.level) : null), [pcs]);
  const options = useMemo(() => {
    if (!library) return null;
    const crOf = (id: string) => library.monsters.find((m) => m.id === id)?.cr;
    return BALLAD_ENCOUNTERS.map((e) => ({ e, rating: levels ? rate(xpOf(e.creatures, crOf), partyBudget(levels)) : null }))
      .filter(({ e }) => !tiers.length || TIERS.some((t) => tiers.includes(t.label) && t.test(e.level)))
      .filter(({ e }) => !habitat || e.environments.includes(habitat))
      .filter(({ rating }) => !ratings.length || (rating && ratings.includes(rating)))
      .map(({ e, rating }) => ({
        id: e.id,
        name: e.name,
        meta: [`Level ${e.level}`, e.environments.join(', '), rating && `${RATING_LABEL[rating]} for your party`].filter(Boolean).join(' · '),
        search: `${e.summary} ${e.environments.join(' ')}`,
      }));
  }, [library, levels, tiers, habitat, ratings]);
  const pick = (id: string) => {
    const e = BALLAD_ENCOUNTERS.find((x) => x.id === id);
    if (!e || !library || !world) return;
    const notes = [`Setup: ${e.setup}`, `Tactics: ${e.tactics}`, `Hook: ${e.hook}`].join('\n\n');
    const encounter = addLibraryEncounter(world.id, library, bestiary, pictures, e.name, notes, e.creatures);
    toast('Encounter Added', { description: `${e.name} · ${encounter.combatants.length} creatures` });
    finish(encounter.id, () => void navigate({ to: '/encounters/$encounterId', params: { encounterId: encounter.id } }));
  };
  const filters: Filter[] = [
    { kind: 'range', label: 'Level', options: TIERS.map((t) => ({ value: t.label, label: t.label })), value: tiers, onChange: setTiers },
    ...(levels
      ? [{ kind: 'tags' as const, label: 'For your party', options: (['low', 'moderate', 'high', 'beyond'] as Rating[]).map((r) => ({ value: r, label: RATING_LABEL[r], dot: RATING_DOT[r] })), value: ratings, onChange: setRatings }]
      : []),
    { kind: 'select', label: 'Habitat', every: 'Every habitat', options: tally(BALLAD_ENCOUNTERS, (e) => e.environments), value: habitat, onChange: setHabitat },
  ];
  return (
    <PickList
      options={options}
      placeholder="Search encounters: bandits, undead, swamp…"
      onPick={pick}
      filters={filters}
      footer={
        <button type="button" className="text-[12px] text-link hover:underline" onClick={() => finish('', () => void navigate({ to: '/library/$kind', params: { kind: 'encounters' }, search: {} }))}>
          Or build one to order →
        </button>
      }
    />
  );
}

import { useNavigate, useSearch } from '@tanstack/react-router';
import { DicesIcon, MinusIcon, PlusIcon, SwordsIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Empty, Label } from '@/components/shared/bits';
import { usePictures } from '@/components/shared/Portrait';
import { Button } from '@/components/ui/button';
import { buildEncounter, crXp, DIFFICULTIES, partyBudget, rate, RATING_LABEL, xpOf, type Built, type Difficulty, type Pick, type Rating } from '@/lib/encounterMath';
import { useRole, useWorld, useWorldRecords } from '@/lib/hooks';
import { BALLAD_ENCOUNTERS, type BalladEncounter } from '@/lib/library/ballad-encounters';
import { sourceName, type Library } from '@/lib/library';
import { addLibraryEncounter } from '@/lib/library/add';
import { matches } from '@/lib/compendium';
import { cn } from '@/lib/utils';
import { Chip, DetailColumn, ListColumn, Row } from '@/screens/dnd/CompendiumScreen';

/**
 * The Library's Encounters: Ballad's own ready-made fights (lib/library/
 * ballad-encounters) and a builder that makes one to order from the Library's
 * creatures, both rated for your party by the SRD 5.2's XP budgets
 * (lib/encounterMath). Add To Encounters copies the creatures to the Bestiary
 * (or reuses ones already there) and opens the fight in Encounters.
 */
export function EncountersPage({ library }: { library: Library }) {
  const [tab, setTab] = useState<'ready' | 'build'>('ready');
  const party = useParty();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b px-5 py-2.5">
        <div role="tablist" className="flex gap-1">
          <Chip on={tab === 'ready'} onClick={() => setTab('ready')}>
            Ready-Made · {BALLAD_ENCOUNTERS.length}
          </Chip>
          <Chip on={tab === 'build'} onClick={() => setTab('build')}>
            Build One
          </Chip>
        </div>
        <PartyControls party={party} />
      </div>
      {tab === 'ready' ? <ReadyMade library={library} levels={party.levels} /> : <Builder library={library} levels={party.levels} />}
    </div>
  );
}

// ── The party ────────────────────────────────────────────────────────────

type Party = { size: number; level: number; levels: number[]; fromCampaign: boolean; set: (size: number, level: number) => void };

/** Your campaign's characters if it has any (their own levels), until you change it; four level 1s otherwise. */
function useParty(): Party {
  const pcs = useWorldRecords('pcs');
  const [chosen, setChosen] = useState<{ size: number; level: number } | null>(null);
  const campaign = pcs.length ? { size: pcs.length, level: Math.round(pcs.reduce((sum, pc) => sum + pc.level, 0) / pcs.length) } : null;
  const { size, level } = chosen ?? campaign ?? { size: 4, level: 1 };
  const levels = !chosen && pcs.length ? pcs.map((pc) => pc.level) : Array.from({ length: size }, () => level);
  return { size, level, levels, fromCampaign: !chosen && Boolean(pcs.length), set: (s, l) => setChosen({ size: Math.min(8, Math.max(1, s)), level: Math.min(20, Math.max(1, l)) }) };
}

function PartyControls({ party }: { party: Party }) {
  return (
    <div className="flex items-center gap-3 text-[12.5px]">
      <Label>Party</Label>
      <Stepper label="Characters" value={party.size} onChange={(v) => party.set(v, party.level)} />
      <Stepper label="Level" value={party.level} onChange={(v) => party.set(party.size, v)} />
      {party.fromCampaign && <span className="text-muted-foreground">From your campaign</span>}
    </div>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-muted-foreground">{label}</span>
      <Button variant="outline" size="icon-xs" aria-label={`Fewer ${label.toLowerCase()}`} onClick={() => onChange(value - 1)}>
        <MinusIcon />
      </Button>
      <span className="w-5 text-center font-mono tabular-nums">{value}</span>
      <Button variant="outline" size="icon-xs" aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(value + 1)}>
        <PlusIcon />
      </Button>
    </span>
  );
}

// ── Ready-made ───────────────────────────────────────────────────────────

const TIERS: { label: string; test: (level: number) => boolean }[] = [
  { label: '1–4', test: (l) => l <= 4 },
  { label: '5–10', test: (l) => l >= 5 && l <= 10 },
  { label: '11–16', test: (l) => l >= 11 && l <= 16 },
  { label: '17–20', test: (l) => l >= 17 },
];

function ReadyMade({ library, levels }: { library: Library; levels: number[] }) {
  const navigate = useNavigate();
  const { id } = useSearch({ from: '/library/$kind' });
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<string | null>(null);
  const [habitat, setHabitat] = useState<string | null>(null);
  const crOf = useCrOf(library);
  const budget = partyBudget(levels);
  const habitats = [...new Set(BALLAD_ENCOUNTERS.flatMap((e) => e.environments))].sort();
  const list = BALLAD_ENCOUNTERS.filter((e) => !tier || TIERS.find((t) => t.label === tier)!.test(e.level))
    .filter((e) => !habitat || e.environments.includes(habitat))
    .filter((e) => matches(query, e.name, e.summary, e.environments.join(' '), e.creatures.map((c) => library.monsters.find((m) => m.id === c.id)?.name ?? '').join(' ')));
  const selected = BALLAD_ENCOUNTERS.find((e) => e.id === id) ?? list[0];
  const select = (next: string) => void navigate({ to: '/library/$kind', params: { kind: 'encounters' }, search: { id: next }, replace: true });

  return (
    <div className="flex min-h-0 flex-1">
      <ListColumn query={query} onQuery={setQuery} placeholder="Search encounters" count={list.length} ids={list.map((e) => e.id)} selected={selected?.id} onSelect={select} onEnter={() => undefined}>
        <div className="flex flex-col gap-1.5 px-1 pb-2">
          <div className="flex flex-wrap gap-1">
            {TIERS.map((t) => (
              <Chip key={t.label} on={tier === t.label} onClick={() => setTier(tier === t.label ? null : t.label)}>
                Level {t.label}
              </Chip>
            ))}
          </div>
          <select aria-label="Habitat" value={habitat ?? ''} onChange={(e) => setHabitat(e.target.value || null)} className="h-8 rounded-lg border bg-background px-2 text-[12.5px]">
            <option value="">Every habitat</option>
            {habitats.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        {list.map((e) => (
          <Row key={e.id} id={e.id} selected={e.id === selected?.id} onSelect={select} trail={<RatingBadge rating={rate(xpOf(e.creatures, crOf), budget)} />}>
            <span className="truncate text-[13.5px] font-medium">{e.name}</span>
            <span className="truncate text-[11.5px] text-muted-foreground">
              Level {e.level} · {e.environments.join(', ')}
            </span>
          </Row>
        ))}
        {!list.length && <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">Nothing matches.</p>}
      </ListColumn>
      <DetailColumn>{selected ? <ReadyDetail key={selected.id} encounter={selected} library={library} levels={levels} /> : <Empty title="Nothing Here" />}</DetailColumn>
    </div>
  );
}

function ReadyDetail({ encounter: e, library, levels }: { encounter: BalladEncounter; library: Library; levels: number[] }) {
  const notes = [e.setup && `Setup: ${e.setup}`, e.tactics && `Tactics: ${e.tactics}`, e.hook && `Hook: ${e.hook}`].filter(Boolean).join('\n\n');
  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-col gap-1.5 border-b pb-4">
        <span className="font-mono text-[11px] tracking-[0.1em] text-link uppercase">Ballad · Built for 4 at level {e.level}</span>
        <h1 className="font-display text-[34px] leading-[1.05] font-black break-words uppercase">{e.name}</h1>
        <p className="text-[14.5px] text-muted-foreground italic">{e.summary}</p>
        <span className="pt-1.5">
          <AddToEncounters name={e.name} notes={notes} picks={e.creatures} library={library} />
        </span>
      </header>
      <Creatures picks={e.creatures} library={library} levels={levels} />
      <Section title="Setup">{e.setup}</Section>
      <Section title="Tactics">{e.tactics}</Section>
      <Section title="Hook">{e.hook}</Section>
      <p className="text-[11.5px] text-muted-foreground">Habitats: {e.environments.join(', ')}. Written for Ballad; creatures from the SRD 5.1.</p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="border-b border-primary pb-1 font-display text-[18px] font-black text-primary uppercase">{title}</h3>
      <p className="text-[14px] leading-relaxed">{children}</p>
    </section>
  );
}

// ── Build one ────────────────────────────────────────────────────────────

const ANY = 'Any';

function Builder({ library, levels }: { library: Library; levels: number[] }) {
  const [habitat, setHabitat] = useState(ANY);
  const [difficulty, setDifficulty] = useState<Difficulty>('moderate');
  const [srdOnly, setSrdOnly] = useState(true);
  const [built, setBuilt] = useState<Built | null | undefined>(undefined);
  const pool = useMemo(() => library.monsters.filter((m) => (!srdOnly || m.src === 'srd-2014') && (habitat === ANY || m.environments.includes(habitat))), [library, srdOnly, habitat]);
  const habitats = useMemo(() => [...new Set(library.monsters.flatMap((m) => m.environments))].sort(), [library]);
  const build = () => setBuilt(buildEncounter(pool, levels, difficulty));
  const name = `${habitat === ANY ? '' : `${habitat} `}${DIFFICULTY_NAME[difficulty]} Encounter`;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-8 pt-7 pb-16">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-[30px] leading-none font-black uppercase">Build An Encounter</h1>
          <p className="text-[13.5px] text-muted-foreground">
            Pick where and how hard: a fight is drawn from the Library’s creatures that live there, using as much of your party’s XP budget as it can without going over. Creatures above your party’s level are left out.
          </p>
        </header>
        <div className="flex flex-col gap-3 rounded-2xl border px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Label>Habitat</Label>
            <select aria-label="Habitat" value={habitat} onChange={(e) => setHabitat(e.target.value)} className="h-8 rounded-lg border bg-background px-2 text-[12.5px]">
              <option value={ANY}>Anywhere</option>
              {habitats.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Label>Difficulty</Label>
            {DIFFICULTIES.map((d) => (
              <Chip key={d} on={difficulty === d} onClick={() => setDifficulty(d)}>
                {DIFFICULTY_NAME[d]} · {partyBudget(levels)[d].toLocaleString('en-US')} XP
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Label>Creatures</Label>
            <Chip on={srdOnly} onClick={() => setSrdOnly(true)}>
              SRD 5.1
            </Chip>
            <Chip on={!srdOnly} onClick={() => setSrdOnly(false)}>
              Every Book
            </Chip>
            <span className="text-[12px] text-muted-foreground">{pool.length.toLocaleString('en-US')} to draw from</span>
          </div>
          <span>
            <Button onClick={build}>
              <DicesIcon /> {built === undefined ? 'Build' : 'Build Another'}
            </Button>
          </span>
        </div>
        {built === null && <p className="rounded-xl border px-4 py-3 text-[13px] text-muted-foreground">Nothing fits: no creatures from there suit this party at that difficulty. Try another habitat, or every book.</p>}
        {built && (
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-[22px] font-black uppercase">{name}</h2>
              <AddToEncounters name={name} notes="" picks={built.picks} library={library} />
            </div>
            <Creatures picks={built.picks} library={library} levels={levels} />
          </section>
        )}
      </div>
    </div>
  );
}

const DIFFICULTY_NAME: Record<Difficulty, string> = { low: 'Low', moderate: 'Moderate', high: 'High' };

// ── Shared ───────────────────────────────────────────────────────────────

function useCrOf(library: Library) {
  return useMemo(() => {
    const crs = new Map(library.monsters.map((m) => [m.id, m.cr]));
    return (id: string) => crs.get(id);
  }, [library]);
}

const RATING_TONE: Record<Rating, string> = {
  trivial: 'text-muted-foreground',
  low: 'text-online',
  moderate: 'text-foreground',
  high: 'text-primary',
  beyond: 'text-destructive',
};

function RatingBadge({ rating }: { rating: Rating }) {
  return <span className={cn('shrink-0 font-mono text-[10.5px] tracking-[0.06em] uppercase', RATING_TONE[rating])}>{RATING_LABEL[rating]}</span>;
}

/** The creatures, their XP, and how hard they are for this party. Each name opens its stat block. */
function Creatures({ picks, library, levels }: { picks: Pick[]; library: Library; levels: number[] }) {
  const navigate = useNavigate();
  const crOf = useCrOf(library);
  const xp = xpOf(picks, crOf);
  const budget = partyBudget(levels);
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border">
      {picks.map((p) => {
        const m = library.monsters.find((x) => x.id === p.id);
        if (!m) return null;
        return (
          <div key={p.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
            <span className="w-8 font-mono text-[13px] text-muted-foreground tabular-nums">{p.count}×</span>
            <button type="button" className="min-w-0 flex-1 truncate text-left text-[14px] font-medium hover:underline" onClick={() => void navigate({ to: '/library/$kind', params: { kind: 'monsters' }, search: { id: m.id } })}>
              {m.name}
            </button>
            <span className="hidden text-[12px] text-muted-foreground @md:inline">{sourceName(m.src)}</span>
            <span className="font-mono text-[12px] text-muted-foreground tabular-nums">CR {m.cr}</span>
            <span className="w-20 text-right font-mono text-[12px] tabular-nums">{(crXp(m.cr) * p.count).toLocaleString('en-US')} XP</span>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-muted/50 px-4 py-2.5 text-[12.5px]">
        <span className="flex items-center gap-1.5">
          <SwordsIcon className="size-3.5" /> <RatingBadge rating={rate(xp, budget)} /> for {levels.length} at level{new Set(levels).size > 1 ? 's' : ''} {[...new Set(levels)].join(', ')}
        </span>
        <span className="ml-auto font-mono tabular-nums">{xp.toLocaleString('en-US')} XP</span>
        <span className="w-full font-mono text-[11px] text-muted-foreground tabular-nums">
          Budget · Low {budget.low.toLocaleString('en-US')} · Moderate {budget.moderate.toLocaleString('en-US')} · High {budget.high.toLocaleString('en-US')}
        </span>
      </div>
    </div>
  );
}

/**
 * Makes the fight in your campaign's Encounters: each kind of creature comes
 * from the Bestiary if it's there already (by name), or is copied into it.
 */
function AddToEncounters({ name, notes, picks, library }: { name: string; notes: string; picks: Pick[]; library: Library }) {
  const navigate = useNavigate();
  const world = useWorld();
  const role = useRole();
  const bestiary = useWorldRecords('monsters');
  const pictures = usePictures();
  if (role !== 'dm' || !world) return null;
  const add = () => {
    const encounter = addLibraryEncounter(world.id, library, bestiary, pictures, name, notes, picks);
    const n = encounter.combatants.length;
    toast('Added To Encounters', { description: `${name} · ${n} creature${n === 1 ? '' : 's'}`, action: { label: 'Open', onClick: () => void navigate({ to: '/encounters/$encounterId', params: { encounterId: encounter.id } }) } });
  };
  return (
    <Button size="sm" onClick={add}>
      <SwordsIcon /> Add To Encounters
    </Button>
  );
}

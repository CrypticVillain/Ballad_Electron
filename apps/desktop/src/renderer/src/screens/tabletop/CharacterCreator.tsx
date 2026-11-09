import { useNavigate } from '@tanstack/react-router';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, DicesIcon, MinusIcon, PlusIcon, SearchIcon, SkipForwardIcon, SparklesIcon, UserRoundPlusIcon } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/shared/bits';
import { Hint } from '@/components/shared/Hint';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Button } from '@/components/ui/button';
import { createMyCharacter } from '@/lib/actions';
import { levelLabel, sameName, useItems, useSpells } from '@/lib/compendium';
import {
  BACKGROUNDS,
  buildCharacter,
  CLASSES,
  draftBackground,
  draftClass,
  draftEquipment,
  draftSkills,
  draftSpecies,
  emptyDraft,
  featuresAt,
  finalScores,
  PRIMARY,
  SPECIES,
  speciesBonuses,
  spellCounts,
  type AbilityMethod,
  type CharacterClass,
  type Draft,
} from '@/lib/compendium/classes';
import { ABILITY_NAME, modifier, POINT_BUY, POINT_BUY_BUDGET, pointBuyCost, proficiencyBonus, roll, signed, SKILLS, STANDARD_ARRAY } from '@/lib/tabletop';
import { useWorld } from '@/lib/hooks';
import { useVault } from '@/stores/vault';
import { bringCharacter } from '@/tabletop/members/actions';
import { campaignOptions, useCampaigns } from '@/tabletop/members/campaigns';
import { ABILITIES, type Abilities, type Ability, type ItemInfo } from '@/lib/model';
import { cn } from '@/lib/utils';
import { NameSuggest } from '@/names/NameSuggest';

/**
 * /create — the character creator: a walkthrough from a name to a finished
 * sheet, a step at a time (species, class, background, ability scores,
 * equipment, spells for a caster, then a look at the whole thing), with the
 * sheet taking shape in the preview beside it. Every step can be left as it
 * is, and Skip makes the character from what's picked so far (nothing, if you
 * skip at once) so you can fill in the sheet yourself.
 */
type Step = 'basics' | 'species' | 'class' | 'background' | 'abilities' | 'equipment' | 'spells' | 'review';
const STEP_LABEL: Record<Step, string> = { basics: 'Name', species: 'Species', class: 'Class', background: 'Background', abilities: 'Ability Scores', equipment: 'Equipment', spells: 'Spells', review: 'Review' };

export function CharacterCreator() {
  const navigate = useNavigate();
  const world = useWorld();
  const items = useItems();
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft(world?.id ?? null), base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }));
  const set = (changes: Partial<Draft>) => setDraft((d) => ({ ...d, ...changes }));
  const cls = draftClass(draft);
  const casts = spellCounts(cls, draft.level, finalScores(draft)).maxLevel > 0 || spellCounts(cls, draft.level, finalScores(draft)).cantrips > 0;
  const steps: Step[] = ['basics', 'species', 'class', 'background', 'abilities', 'equipment', ...(casts ? (['spells'] as Step[]) : []), 'review'];
  const [step, setStep] = useState<Step>('basics');
  const at = Math.max(0, steps.indexOf(step));
  const itemNamed = (name: string) => items.find((i) => !i.hidden && sameName(i.name, name));

  const finish = (skipped: boolean) => {
    const pc = createMyCharacter(buildCharacter(draft, itemNamed));
    // Made for a campaign another account runs (one you've joined): into its party.
    if (pc.worldId && !useVault.getState().vault.worlds[pc.worldId]) bringCharacter(pc, pc.worldId);
    toast(skipped ? 'Character Made' : `${pc.name || 'Your Character'} Is Ready`, { description: skipped ? 'Fill in the rest on the sheet.' : `Level ${pc.level} ${pc.species} ${pc.className}`.replace(/\s+/g, ' ') });
    void navigate({ to: '/' });
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      <TopBar crumbs={['New Character', STEP_LABEL[step]]}>
        <Hint label="Make the character from what's picked so far, and fill in the sheet yourself">
          <Button variant="outline" size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => finish(true)}>
            <SkipForwardIcon /> Skip, Fill In The Sheet
          </Button>
        </Hint>
      </TopBar>
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Steps" className="flex w-[210px] shrink-0 flex-col gap-0.5 border-r bg-sidebar px-3 py-5">
          {steps.map((s, i) => (
            <button
              key={s}
              type="button"
              aria-current={s === step ? 'step' : undefined}
              onClick={() => setStep(s)}
              className={cn('flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-left text-[13.5px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground', s === step && 'bg-sidebar-accent font-medium text-foreground')}
            >
              <span className={cn('flex size-5 items-center justify-center rounded-full border font-mono text-[10px]', i < at && 'border-primary bg-primary text-primary-foreground', s === step && 'border-primary text-primary')}>
                {i < at ? <CheckIcon className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              {STEP_LABEL[s]}
            </button>
          ))}
        </nav>
        <div className="@container flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 px-8 pt-7 pb-10">
              {step === 'basics' && <Basics draft={draft} set={set} />}
              {step === 'species' && <SpeciesStep draft={draft} set={set} />}
              {step === 'class' && <ClassStep draft={draft} set={set} />}
              {step === 'background' && <BackgroundStep draft={draft} set={set} />}
              {step === 'abilities' && <AbilitiesStep draft={draft} set={set} />}
              {step === 'equipment' && <EquipmentStep draft={draft} set={set} itemNamed={itemNamed} />}
              {step === 'spells' && cls && <SpellsStep draft={draft} set={set} cls={cls} />}
              {step === 'review' && <Review draft={draft} itemNamed={itemNamed} />}
            </div>
          </div>
          <footer className="flex items-center gap-2 border-t px-8 py-3">
            <Button variant="ghost" disabled={at === 0} onClick={() => setStep(steps[at - 1]!)}>
              <ArrowLeftIcon /> Back
            </Button>
            <span className="flex-1 text-center font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
              Step {at + 1} Of {steps.length}
            </span>
            {step === 'review' ? (
              <Button onClick={() => finish(false)}>
                <UserRoundPlusIcon /> Create Character
              </Button>
            ) : (
              <Button onClick={() => setStep(steps[at + 1]!)}>
                Next: {STEP_LABEL[steps[at + 1]!]} <ArrowRightIcon />
              </Button>
            )}
          </footer>
        </div>
        <Preview draft={draft} itemNamed={itemNamed} />
      </div>
    </main>
  );
}

type StepProps = { draft: Draft; set: (changes: Partial<Draft>) => void };

function Heading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-1.5">
      <h1 className="font-display text-[34px] leading-none font-black uppercase">{title}</h1>
      {children && <p className="max-w-[62ch] text-[14px] text-muted-foreground">{children}</p>}
    </header>
  );
}

// ── Steps ───────────────────────────────────────────────────────────────

function Basics({ draft, set }: StepProps) {
  const campaigns = useCampaigns();
  return (
    <>
      <Heading title="Who Are They?">A name to start (you can change everything later). Then pick a species and class, or Skip at any point to fill in the sheet yourself.</Heading>
      <span className="flex items-center gap-1 border-b pb-2 focus-within:border-primary">
        <input autoFocus aria-label="Character name" value={draft.name} placeholder="UNNAMED CHARACTER" onChange={(e) => set({ name: e.target.value })} className="min-w-0 flex-1 bg-transparent font-display text-[40px] leading-none font-black uppercase outline-none placeholder:text-muted-foreground/40" />
        <NameSuggest kind="person" onPick={(name) => set({ name })} />
      </span>
      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-3">
        <Box label="Played By">
          <input aria-label="Player" value={draft.player} placeholder="Your name" onChange={(e) => set({ player: e.target.value })} className="w-full bg-transparent text-[14px] outline-none" />
        </Box>
        <Box label="Campaign">
          <SelectField
            label="Campaign"
            variant="inline"
            value={draft.worldId}
            onChange={(worldId) => set({ worldId })}
            options={campaignOptions(campaigns)}
            className="text-[14px] data-[size=default]:h-auto"
          />
        </Box>
        <Box label="Starting Level">
          <Stepper value={draft.level} min={1} max={20} onChange={(level) => set({ level })} />
        </Box>
      </div>
      {draft.level > 1 && <p className="text-[13px] text-muted-foreground">Starting past 1st level: hit points are taken as the average for each level after the first, and every feature up to level {draft.level} is added. Ability score improvements are yours to add on the sheet.</p>}
    </>
  );
}

function SpeciesStep({ draft, set }: StepProps) {
  const species = draftSpecies(draft);
  return (
    <>
      <Heading title="Species">Each brings ability bonuses, a speed and traits of its own.</Heading>
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-3">
        {SPECIES.map((s) => (
          <Choice key={s.id} on={draft.speciesId === s.id} onClick={() => set({ speciesId: s.id, subraceId: s.subraces[0]?.id ?? null, bonusPicks: [], speciesSkills: [] })} title={s.name} meta={`${s.speed} ft.`}>
            {bonusText(s.bonuses)}
            {s.bonusChoice && `, +1 to ${s.bonusChoice.choose} others`}
            {s.subraces.length > 0 && ` · ${s.subraces.map((x) => x.name).join(', ')}`}
          </Choice>
        ))}
        <Choice on={!draft.speciesId && Boolean(draft.customSpecies)} onClick={() => set({ speciesId: null, subraceId: null, bonusPicks: [], speciesSkills: [] })} title="Something Else" meta="Custom">
          Type it in; add its traits on the sheet.
        </Choice>
      </div>
      {!draft.speciesId && (
        <Box label="Species">
          <input aria-label="Custom species" value={draft.customSpecies} placeholder="Tabaxi, Warforged, your own…" onChange={(e) => set({ customSpecies: e.target.value })} className="w-full bg-transparent text-[14px] outline-none" />
        </Box>
      )}
      {species && (
        <section className="flex flex-col gap-3 rounded-2xl border px-5 py-4">
          <p className="text-[13.5px] text-muted-foreground">{species.about}</p>
          {species.subraces.length > 0 && (
            <Row label="Subrace">
              {species.subraces.map((sub) => (
                <Chip key={sub.id} on={draft.subraceId === sub.id} onClick={() => set({ subraceId: draft.subraceId === sub.id ? null : sub.id })}>
                  {sub.name} <span className="text-muted-foreground">{bonusText(sub.bonuses)}</span>
                </Chip>
              ))}
            </Row>
          )}
          {species.bonusChoice && (
            <Row label={`+1 To ${species.bonusChoice.choose}`}>
              {species.bonusChoice.from.map((a) => (
                <Chip key={a} on={draft.bonusPicks.includes(a)} onClick={() => set({ bonusPicks: toggle(draft.bonusPicks, a, species.bonusChoice!.choose) })}>
                  {ABILITY_NAME[a]}
                </Chip>
              ))}
            </Row>
          )}
          {species.skillChoice && (
            <Row label={`${species.skillChoice.choose} Skills`}>
              {species.skillChoice.from.map((skill) => (
                <Chip key={skill} on={draft.speciesSkills.includes(skill)} onClick={() => set({ speciesSkills: toggle(draft.speciesSkills, skill, species.skillChoice!.choose) })}>
                  {skill}
                </Chip>
              ))}
            </Row>
          )}
          <TraitList traits={[...species.traits, ...(species.subraces.find((s) => s.id === draft.subraceId)?.traits ?? [])]} />
        </section>
      )}
    </>
  );
}

function ClassStep({ draft, set }: StepProps) {
  const cls = draftClass(draft);
  return (
    <>
      <Heading title="Class">What they do best: how much they can take (the hit die), what they’re trained in, and the features they gain as they level.</Heading>
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-3">
        {CLASSES.map((c) => (
          <Choice key={c.id} on={draft.classId === c.id} onClick={() => set({ classId: c.id, classSkills: [], equipment: [], spells: [] })} title={c.name} meta={`d${c.hitDie}`}>
            {ABILITY_NAME[PRIMARY[c.id] ?? c.saves[0]!]} · saves {c.saves.map((a) => a.toUpperCase()).join(', ')}
            {c.spellcasting && ' · spells'}
          </Choice>
        ))}
        <Choice on={!draft.classId && Boolean(draft.customClass)} onClick={() => set({ classId: null, classSkills: [], equipment: [], spells: [] })} title="Something Else" meta="Custom">
          Type it in; set its saves and features on the sheet.
        </Choice>
      </div>
      {!draft.classId && (
        <Box label="Class">
          <input aria-label="Custom class" value={draft.customClass} placeholder="Artificer, Blood Hunter, your own…" onChange={(e) => set({ customClass: e.target.value })} className="w-full bg-transparent text-[14px] outline-none" />
        </Box>
      )}
      {cls && (
        <section className="flex flex-col gap-3 rounded-2xl border px-5 py-4">
          <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
            <Fact label="Hit Die">d{cls.hitDie}</Fact>
            <Fact label="Saves">{cls.saves.map((a) => ABILITY_NAME[a]).join(', ')}</Fact>
            <Fact label="Spellcasting">{cls.spellcasting ? ABILITY_NAME[cls.spellcasting] : 'None'}</Fact>
            <Fact label={`Subclass · Level ${cls.subclass?.level ?? '—'}`}>{cls.subclass?.name ?? '—'}</Fact>
          </div>
          <p className="text-[13px] text-muted-foreground">Trained in: {cls.proficiencies.join(', ') || 'nothing more'}.</p>
          <Row label={`Pick ${cls.skillChoice.choose} Skills`}>
            {cls.skillChoice.from.map((skill) => (
              <Chip key={skill} on={draft.classSkills.includes(skill)} onClick={() => set({ classSkills: toggle(draft.classSkills, skill, cls.skillChoice.choose) })}>
                {skill}
              </Chip>
            ))}
          </Row>
          <TraitList traits={Array.from({ length: draft.level }, (_, i) => featuresAt(cls, i + 1, Boolean(cls.subclass && draft.level >= cls.subclass.level)).map((f) => f.trait)).flat()} title={`Features To Level ${draft.level}`} />
        </section>
      )}
    </>
  );
}

function BackgroundStep({ draft, set }: StepProps) {
  const background = draftBackground(draft);
  const others = new Set([...(draftSpecies(draft)?.skills ?? []), ...draft.speciesSkills, ...draft.classSkills]);
  return (
    <>
      <Heading title="Background">Where they come from, and two skills it taught them. Acolyte is the SRD’s; the others bring their skills only, so the story is yours.</Heading>
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-3">
        {BACKGROUNDS.map((b) => (
          <Choice key={b.id} on={draft.backgroundId === b.id} onClick={() => set({ backgroundId: b.id, backgroundSkills: b.skills })} title={b.name} meta={b.srd ? 'SRD' : undefined}>
            {b.skills.join(', ')}
          </Choice>
        ))}
        <Choice on={!draft.backgroundId && Boolean(draft.customBackground)} onClick={() => set({ backgroundId: null, backgroundSkills: [] })} title="Your Own" meta="Custom">
          Name it and pick any two skills.
        </Choice>
      </div>
      {!draft.backgroundId && (
        <section className="flex flex-col gap-3 rounded-2xl border px-5 py-4">
          <Box label="Background">
            <input aria-label="Custom background" value={draft.customBackground} placeholder="Lighthouse keeper's child" onChange={(e) => set({ customBackground: e.target.value })} className="w-full bg-transparent text-[14px] outline-none" />
          </Box>
          <Row label="Pick 2 Skills">
            {SKILLS.map(({ name }) => (
              <Chip key={name} on={draft.backgroundSkills.includes(name)} onClick={() => set({ backgroundSkills: toggle(draft.backgroundSkills, name, 2) })} dim={others.has(name)}>
                {name}
              </Chip>
            ))}
          </Row>
        </section>
      )}
      {background?.feature && <TraitList traits={[background.feature]} title="Background Feature" />}
      {draft.backgroundSkills.some((s) => others.has(s)) && <p className="text-[13px] text-muted-foreground">A skill they already have from their species or class: pick another for it on the sheet (any skill will do).</p>}
    </>
  );
}

const METHODS: { value: AbilityMethod; label: string; hint: string }[] = [
  { value: 'standard', label: 'Standard Array', hint: 'Hand out 15, 14, 13, 12, 10 and 8.' },
  { value: 'pointbuy', label: 'Point Buy', hint: `Spend ${POINT_BUY_BUDGET} points on scores from 8 to 15.` },
  { value: 'roll', label: 'Roll', hint: 'Roll 4d6 six times, drop each lowest die, and hand them out.' },
  { value: 'manual', label: 'Manual', hint: 'Type in scores you already have.' },
];

/** The scores in the order a class wants them: its main ability, Constitution, then the rest. */
function suggested(cls: CharacterClass | undefined, values: number[]): Abilities {
  const primary = cls ? (PRIMARY[cls.id] ?? cls.saves[0]!) : 'str';
  const order = [...new Set<Ability>([primary, 'con', ...(cls?.saves ?? []), 'dex', 'wis', 'str', 'int', 'cha'])];
  const sorted = [...values].sort((a, b) => b - a);
  return Object.fromEntries(order.map((a, i) => [a, sorted[i] ?? 10])) as Abilities;
}

function AbilitiesStep({ draft, set }: StepProps) {
  const cls = draftClass(draft);
  const [rolled, setRolled] = useState<number[]>([]);
  const bonus = speciesBonuses(draft);
  const pool = draft.method === 'standard' ? STANDARD_ARRAY : draft.method === 'roll' ? rolled : [];
  const isPermutation = (values: number[]) => [...ABILITIES.map((a) => draft.base[a])].sort().join() === [...values].sort().join();
  useEffect(() => {
    if (draft.method === 'standard' && !isPermutation(STANDARD_ARRAY)) set({ base: suggested(cls, STANDARD_ARRAY) });
    if (draft.method === 'pointbuy' && pointBuyCost(draft.base) > POINT_BUY_BUDGET) set({ base: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } });
    // Only when the method changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.method]);
  const rollAll = () => {
    const values = Array.from({ length: 6 }, () => roll('4d6kh3')!.total);
    setRolled(values);
    set({ base: suggested(cls, values) });
  };
  /** Gives an ability a value from the pool, swapping with whichever had it. */
  const assign = (ability: Ability, value: number) => {
    const holder = ABILITIES.find((a) => a !== ability && draft.base[a] === value);
    set({ base: { ...draft.base, [ability]: value, ...(holder ? { [holder]: draft.base[ability] } : {}) } });
  };
  const spent = pointBuyCost(draft.base);

  return (
    <>
      <Heading title="Ability Scores">Six scores, the heart of the sheet. Species bonuses are added for you.</Heading>
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
        {METHODS.map((m) => (
          <Choice key={m.value} on={draft.method === m.value} onClick={() => set({ method: m.value })} title={m.label}>
            {m.hint}
          </Choice>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {draft.method === 'roll' && (
          <Button variant="outline" size="sm" onClick={rollAll}>
            <DicesIcon /> {rolled.length ? 'Roll Again' : 'Roll 4d6 × 6'}
          </Button>
        )}
        {draft.method === 'roll' && rolled.length > 0 && <span className="font-mono text-[13px] text-muted-foreground">Rolled: {rolled.join(', ')}</span>}
        {draft.method === 'pointbuy' && (
          <span className={cn('font-mono text-[13px]', spent > POINT_BUY_BUDGET ? 'text-destructive' : 'text-muted-foreground')}>
            {POINT_BUY_BUDGET - spent} of {POINT_BUY_BUDGET} points left
          </span>
        )}
        {cls && pool.length === 6 && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => set({ base: suggested(cls, pool) })}>
            <SparklesIcon /> Suggest For A {cls.name}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-3">
        {ABILITIES.map((a) => {
          const score = Math.min(20, draft.base[a] + bonus[a]);
          return (
            <div key={a} className={cn('flex items-center gap-3 rounded-xl border px-3.5 py-2.5', cls && PRIMARY[cls.id] === a && 'border-primary/60')}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="label text-[9.5px]">{ABILITY_NAME[a]}</span>
                {pool.length === 6 ? (
                  <SelectField label={ABILITY_NAME[a]} variant="inline" value={draft.base[a]} onChange={(v) => assign(a, v)} options={[...new Set(pool)].sort((x, y) => y - x).map((v) => ({ value: v, label: String(v) }))} className="text-[16px] font-semibold data-[size=default]:h-auto" />
                ) : draft.method === 'pointbuy' ? (
                  <Stepper value={draft.base[a]} min={8} max={15} onChange={(v) => set({ base: { ...draft.base, [a]: v } })} disableUp={spent + (POINT_BUY[draft.base[a] + 1] ?? 99) - (POINT_BUY[draft.base[a]] ?? 0) > POINT_BUY_BUDGET} />
                ) : draft.method === 'roll' ? (
                  <span className="text-[13px] text-muted-foreground">Roll first</span>
                ) : (
                  <Stepper value={draft.base[a]} min={3} max={20} onChange={(v) => set({ base: { ...draft.base, [a]: v } })} />
                )}
              </span>
              {bonus[a] > 0 && <span className="font-mono text-[12px] text-primary">+{bonus[a]}</span>}
              <span className="flex flex-col items-center">
                <span className="font-display text-[26px] leading-none font-black">{score}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{signed(modifier(score))}</span>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function EquipmentStep({ draft, set, itemNamed }: StepProps & { itemNamed: (name: string) => { stats: string } | undefined }) {
  const cls = draftClass(draft);
  const background = draftBackground(draft);
  return (
    <>
      <Heading title="Equipment">Pick between the class’s options; the rest comes with it. Armor sets Armor Class and weapons become attacks on the sheet.</Heading>
      {!cls && <p className="text-[14px] text-muted-foreground">Pick a class from the SRD to get its starting gear, or add items on the sheet’s Inventory.</p>}
      {cls?.equipmentChoices.map((choice, i) => (
        <section key={i} className="flex flex-col gap-2">
          <Label>{`Choice ${i + 1}`}</Label>
          <div className="grid grid-cols-1 gap-2 @2xl:grid-cols-2">
            {choice.options.map((option, j) => (
              <Choice key={j} on={(draft.equipment[i] ?? 0) === j} onClick={() => set({ equipment: Object.assign([...draft.equipment], { [i]: j }) })} title={option.map((it) => `${it.qty > 1 ? `${it.qty} × ` : ''}${it.name}`).join(' + ')}>
                {option.map((it) => itemNamed(it.name)?.stats).filter(Boolean).join(' · ') || ' '}
              </Choice>
            ))}
          </div>
        </section>
      ))}
      {cls && (cls.equipment.length > 0 || background) && (
        <p className="text-[13px] text-muted-foreground">
          Also:{' '}
          {[...cls.equipment, ...(background?.equipment ?? [])].map((it) => `${it.qty > 1 ? `${it.qty} × ` : ''}${it.name}`).join(', ') || 'nothing else'}
          {background?.gold ? `, and ${background.gold} gp.` : '.'}
        </p>
      )}
    </>
  );
}

function SpellsStep({ draft, set, cls }: StepProps & { cls: CharacterClass }) {
  const counts = spellCounts(cls, draft.level, finalScores(draft));
  const picked = (level: 'cantrip' | 'spell') => draft.spells.filter((s) => (level === 'cantrip' ? s.level === 0 : s.level > 0));
  return (
    <>
      <Heading title="Spells">
        {counts.prepared
          ? `Pick ${counts.cantrips ? `${counts.cantrips} cantrips and ` : ''}the ${counts.spells} spells they ${cls.id === 'wizard' ? 'have in their spellbook' : 'prepare'} (up to level ${counts.maxLevel}). Prepared spells can change after each long rest.`
          : `Pick ${counts.cantrips ? `${counts.cantrips} cantrips and ` : ''}${counts.spells} spells they know (up to level ${counts.maxLevel}).`}
      </Heading>
      <SpellPicker className={cls.name} maxLevel={counts.maxLevel} cantrips={counts.cantrips} spells={counts.spells} picked={draft.spells} onChange={(spells) => set({ spells })} />
      <p className="text-[12.5px] text-muted-foreground">
        {picked('cantrip').length} / {counts.cantrips} cantrips · {picked('spell').length} / {counts.spells} spells
      </p>
    </>
  );
}

/** Picks spells of a class from the compendium, cantrips and leveled spells each up to a count. */
export function SpellPicker({ className, maxLevel, cantrips, spells, picked, onChange }: { className: string; maxLevel: number; cantrips: number; spells: number; picked: { name: string; level: number }[]; onChange: (picked: { name: string; level: number }[]) => void }) {
  const all = useSpells();
  const [query, setQuery] = useState('');
  // One of each name (the SRD's own first: the Library repeats some, rewritten).
  const list = useMemo(() => {
    const seen = new Set<string>();
    return all
      .filter((s) => !s.hidden && s.classes.includes(className) && s.level <= maxLevel && (s.level > 0 ? spells > 0 : cantrips > 0) && s.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => Number(b.book === 'srd-2014') - Number(a.book === 'srd-2014'))
      .filter((s) => !seen.has(s.name.toLowerCase()) && Boolean(seen.add(s.name.toLowerCase())))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [all, className, maxLevel, query, cantrips, spells]);
  const count = (cantrip: boolean) => picked.filter((p) => (p.level === 0) === cantrip).length;
  const levels = [...new Set(list.map((s) => s.level))];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-9 items-center gap-2 rounded-lg border px-2.5 focus-within:border-primary">
        <SearchIcon className="size-4 text-muted-foreground" />
        <input aria-label="Search spells" value={query} placeholder={`Search ${className.toLowerCase()} spells`} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none" />
      </div>
      {levels.map((level) => {
        const cantrip = level === 0;
        const full = count(cantrip) >= (cantrip ? cantrips : spells);
        return (
          <section key={level} className="flex flex-col gap-1.5">
            <Label>{levelLabel(level) === 'Cantrip' ? `Cantrips · ${count(true)} / ${cantrips}` : `${levelLabel(level)}${level === 1 || levels[0] === level || (levels[0] === 0 && levels[1] === level) ? ` · ${count(false)} / ${spells}` : ''}`}</Label>
            <div className="flex flex-wrap gap-1.5">
              {list
                .filter((s) => s.level === level)
                .map((s) => {
                  const on = picked.some((p) => sameName(p.name, s.name));
                  return (
                    <Hint key={s.id} label={<span className="block max-w-[320px] text-[12px] leading-snug">{s.text.split('\n\n')[0]}</span>}>
                      <span>
                        <Chip on={on} dim={!on && full} onClick={() => (on ? onChange(picked.filter((p) => !sameName(p.name, s.name))) : !full && onChange([...picked, { name: s.name, level: s.level }]))}>
                          {s.name}
                        </Chip>
                      </span>
                    </Hint>
                  );
                })}
            </div>
          </section>
        );
      })}
      {!list.length && <p className="text-[13px] text-muted-foreground">No {className.toLowerCase()} spells match.</p>}
    </div>
  );
}

function Review({ draft, itemNamed }: { draft: Draft; itemNamed: (name: string) => ItemInfo | undefined }) {
  const pc = buildCharacter(draft, itemNamed);
  return (
    <>
      <Heading title={pc.name || 'Unnamed Character'}>
        {`Level ${pc.level} ${pc.species || 'species to come'} ${pc.className || 'adventurer'}${pc.subclass ? ` (${pc.subclass})` : ''}${pc.background ? `, ${pc.background}` : ''}. Everything here can be changed on the sheet.`}
      </Heading>
      <div className="grid grid-cols-3 gap-2 @2xl:grid-cols-6">
        {ABILITIES.map((a) => (
          <div key={a} className="flex flex-col items-center gap-0.5 rounded-xl border py-2">
            <span className="label text-[9px]">{a.toUpperCase()}</span>
            <span className="font-display text-[26px] leading-none font-black">{pc.abilities![a]}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{signed(modifier(pc.abilities![a]))}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
        <Fact label="Hit Points">{pc.hp!.max}</Fact>
        <Fact label="Armor Class">{pc.ac}</Fact>
        <Fact label="Speed">{pc.speed} ft.</Fact>
        <Fact label="Proficiency">{signed(proficiencyBonus(pc.level!))}</Fact>
      </div>
      <ReviewList title="Saves" items={pc.saves!.map((a) => ABILITY_NAME[a])} />
      <ReviewList title="Skills" items={pc.skills!} />
      <ReviewList title="Features & Traits" items={pc.traits!.map((f) => f.name)} />
      <ReviewList title="Attacks" items={pc.attacks!.map((a) => `${a.name} ${signed(a.bonus)} · ${a.damage}`)} />
      <ReviewList title="Inventory" items={pc.inventory!.map((it) => `${it.qty > 1 ? `${it.qty} × ` : ''}${it.name}`)} />
      {pc.spells!.length > 0 && <ReviewList title="Spells" items={pc.spells!.map((s) => s.name)} />}
    </>
  );
}

function ReviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="flex flex-col gap-1.5">
      <Label>{`${title} · ${items.length}`}</Label>
      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <span key={i} className="rounded-full border px-2.5 py-0.5 text-[12.5px]">
              {it}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">None yet.</p>
      )}
    </section>
  );
}

/** The sheet as it stands, beside every step. */
function Preview({ draft, itemNamed }: { draft: Draft; itemNamed: (name: string) => ItemInfo | undefined }) {
  const pc = buildCharacter(draft, itemNamed);
  const skills = draftSkills(draft);
  return (
    <aside aria-label="Preview" className="hidden w-[260px] shrink-0 flex-col gap-4 overflow-y-auto border-l bg-sidebar/50 px-4 py-5 xl:flex">
      <div className="cover-dots flex flex-col gap-1 rounded-xl px-4 py-3 text-background">
        <span className="font-mono text-[9.5px] tracking-[0.16em] uppercase opacity-80">
          Level {pc.level} {pc.species} {pc.className}
        </span>
        <span className="font-display text-[22px] leading-none font-black uppercase">{pc.name || 'Unnamed Character'}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {ABILITIES.map((a) => (
          <div key={a} className="flex flex-col items-center rounded-lg border bg-background py-1.5">
            <span className="label text-[8.5px]">{a.toUpperCase()}</span>
            <span className="text-[16px] font-semibold">{pc.abilities![a]}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{signed(modifier(pc.abilities![a]))}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <Mini label="HP">{pc.hp!.max}</Mini>
        <Mini label="AC">{pc.ac}</Mini>
        <Mini label="Speed">{pc.speed}</Mini>
      </div>
      <PreviewList title="Skills" items={skills} />
      <PreviewList title="Features" items={pc.traits!.map((f) => f.name)} />
      <PreviewList title="Gear" items={draftEquipment(draft).map((it) => it.name)} />
      {draft.spells.length > 0 && <PreviewList title="Spells" items={draft.spells.map((s) => s.name)} />}
    </aside>
  );
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="flex flex-col gap-1">
      <Label>{`${title} · ${items.length}`}</Label>
      <p className="text-[12.5px] leading-snug text-muted-foreground">{items.join(', ') || '—'}</p>
    </section>
  );
}

function Mini({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg border bg-background py-1.5">
      <span className="label text-[8.5px]">{label}</span>
      <span className="text-[16px] font-semibold">{children}</span>
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────

function Choice({ on, onClick, title, meta, children }: { on: boolean; onClick: () => void; title: string; meta?: string; children?: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn('flex flex-col items-start gap-1 rounded-xl border px-3.5 py-2.5 text-left hover:border-foreground/30', on && 'border-primary bg-primary/8 ring-1 ring-primary')}>
      <span className="flex w-full items-baseline justify-between gap-2">
        <span className="text-[14px] font-semibold">{title}</span>
        {meta && <span className="font-mono text-[10.5px] text-muted-foreground">{meta}</span>}
      </span>
      {children && <span className="text-[12px] leading-snug text-muted-foreground">{children}</span>}
    </button>
  );
}

function Chip({ on, dim, onClick, children }: { on: boolean; dim?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn('h-7 rounded-full border px-2.5 text-[12.5px] hover:border-foreground/30', on && 'border-primary bg-primary/12 font-medium', dim && 'opacity-45')}>
      {children}
    </button>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Box({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5 rounded-xl border px-3.5 py-2 focus-within:border-primary">
      <span className="label text-[9.5px]">{label}</span>
      {children}
    </label>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border px-3 py-2">
      <span className="label text-[9.5px]">{label}</span>
      <span className="text-[14px] font-medium">{children}</span>
    </div>
  );
}

function TraitList({ traits, title = 'Traits' }: { traits: { name: string; text: string }[]; title?: string }) {
  if (!traits.length) return null;
  return (
    <section className="flex flex-col gap-1.5">
      <Label>{title}</Label>
      <div className="flex flex-wrap gap-1.5">
        {traits.map((t, i) => (
          <Hint key={i} label={<span className="block max-w-[340px] text-[12px] leading-snug">{t.text.split('\n\n')[0] || t.name}</span>}>
            <span tabIndex={0} className="rounded-full border px-2.5 py-0.5 text-[12.5px] outline-none hover:border-foreground/30 focus-visible:border-primary">
              {t.name}
            </span>
          </Hint>
        ))}
      </div>
    </section>
  );
}

export function Stepper({ value, min, max, onChange, disableUp }: { value: number; min: number; max: number; onChange: (value: number) => void; disableUp?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <button type="button" aria-label="Less" disabled={value <= min} onClick={() => onChange(value - 1)} className="rounded-md border p-0.5 hover:border-foreground/40 disabled:opacity-30">
        <MinusIcon className="size-3.5" />
      </button>
      <span className="min-w-6 text-center text-[16px] font-semibold tabular-nums">{value}</span>
      <button type="button" aria-label="More" disabled={value >= max || disableUp} onClick={() => onChange(value + 1)} className="rounded-md border p-0.5 hover:border-foreground/40 disabled:opacity-30">
        <PlusIcon className="size-3.5" />
      </button>
    </span>
  );
}

const bonusText = (bonuses: Partial<Abilities>) =>
  Object.entries(bonuses)
    .filter(([, n]) => n)
    .map(([a, n]) => `${a.toUpperCase()} +${n}`)
    .join(', ');

/** Toggles a pick, keeping at most `max` (the oldest drops off). */
function toggle<T>(list: T[], value: T, max: number): T[] {
  if (list.includes(value)) return list.filter((v) => v !== value);
  return [...list, value].slice(-max);
}

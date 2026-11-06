import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, DicesIcon, SkipForwardIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { rollAndShow } from '@/components/tabletop/rolling';
import { RulesText } from '@/components/tabletop/RulesText';
import { Label } from '@/components/shared/bits';
import { AREA } from '@/components/shared/Field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { updateRecord } from '@/lib/actions';
import { classOf, featuresAt, mergeFeatures, refreshFeatures, slotsAt, spellCounts, toFeature, type Trait } from '@/lib/compendium/classes';
import { ABILITY_NAME, actionKind, averageLevelHp, improve, modifier, proficiencyBonus, signed, usesFromText } from '@/lib/tabletop';
import { ABILITIES, newId, type Ability, type Feature, type PlayerCharacter } from '@/lib/model';
import { cn } from '@/lib/utils';
import { SpellPicker } from './CharacterCreator';

/**
 * LevelUpDialog — leveling up a step at a time: hit points (roll the hit die
 * or take the average), a subclass when the class gets one, the new features
 * (added to Features & Traits, with their uses), an ability score improvement
 * or a feat when the level brings one, and new spells and slots. A class from
 * the SRD fills it all in; any other class gets the same steps to fill by
 * hand. "Just Change The Number" skips it all.
 */
type Step = 'hp' | 'subclass' | 'features' | 'asi' | 'spells' | 'review';
const STEP_LABEL: Record<Step, string> = { hp: 'Hit Points', subclass: 'Subclass', features: 'Features', asi: 'Ability Scores', spells: 'Spells', review: 'Review' };
const ASI_LEVELS = [4, 8, 12, 16, 19];

export function LevelUpDialog({ pc, onClose }: { pc: PlayerCharacter; onClose: () => void }) {
  const cls = classOf(pc);
  const level = Math.min(20, pc.level + 1);
  const row = cls?.levels[level - 1];
  const [hitDie, setHitDie] = useState(pc.hitDie ?? cls?.hitDie ?? 8);
  const [hp, setHp] = useState<{ how: 'average' | 'roll'; value: number }>({ how: 'average', value: averageLevelHp(hitDie, pc.abilities.con) });
  const [subclass, setSubclass] = useState<{ srd: boolean; name: string }>({ srd: Boolean(cls?.subclass), name: cls?.subclass?.name ?? '' });
  const getsSubclass = Boolean(cls?.subclass && level === cls.subclass.level && !pc.subclass);
  const hasSubclass = Boolean(cls?.subclass && level >= cls.subclass.level && (pc.subclassId === cls.subclass.id || (getsSubclass && subclass.srd) || pc.subclass === cls.subclass.name));
  const gained = cls ? featuresAt(cls, level, hasSubclass) : [];
  const [skip, setSkip] = useState<string[]>([]);
  const [custom, setCustom] = useState<Trait>({ name: '', text: '' });
  const asi = cls ? Boolean(row?.asi) : ASI_LEVELS.includes(level);
  const [asiMode, setAsiMode] = useState<'two' | 'one' | 'feat'>('two');
  const [picks, setPicks] = useState<Ability[]>([]);
  const [feat, setFeat] = useState<Trait>({ name: '', text: '' });
  const scores = asi && asiMode !== 'feat' ? improve(pc.abilities, asiMode === 'one' ? picks.slice(0, 1).flatMap((a) => [a, a]) : picks.slice(0, 2)) : pc.abilities;
  const before = spellCounts(cls, pc.level, pc.abilities);
  const after = spellCounts(cls, level, scores);
  const newCantrips = Math.max(0, after.cantrips - before.cantrips);
  const newSpells = after.prepared ? Math.max(0, after.spells - before.spells) : Math.max(0, after.spells - before.spells);
  const [spells, setSpells] = useState<{ name: string; level: number }[]>([]);
  const casts = Boolean(cls?.spellcasting && (after.maxLevel > 0 || after.cantrips > 0));
  const steps: Step[] = ['hp', ...(getsSubclass ? (['subclass'] as Step[]) : []), 'features', ...(asi ? (['asi'] as Step[]) : []), ...(casts ? (['spells'] as Step[]) : []), 'review'];
  const [step, setStep] = useState<Step>('hp');
  const at = steps.indexOf(step);
  const conChange = modifier(scores.con) - modifier(pc.abilities.con);
  const hpGain = Math.max(1, hp.value) + conChange * level;

  const apply = () => {
    const kept = gained.filter((g) => !skip.includes(g.trait.name));
    const added: Feature[] = [
      ...kept.map(({ trait, source }) => toFeature(trait, source, cls, level, scores)),
      ...(!cls && custom.name.trim() ? [{ id: newId(), name: custom.name.trim(), source: 'Class', text: custom.text, uses: usesFromText(custom.text), action: actionKind(custom.text) } as Feature] : []),
      ...(asi && asiMode === 'feat' && feat.name.trim() ? [{ id: newId(), name: feat.name.trim(), source: 'Feat', text: feat.text, uses: usesFromText(feat.text), action: actionKind(feat.text) } as Feature] : []),
    ];
    const prior = { level: pc.level, hp: pc.hp, abilities: pc.abilities, traits: pc.traits, slots: pc.slots, spells: pc.spells, subclass: pc.subclass, subclassId: pc.subclassId, hitDie: pc.hitDie };
    updateRecord('pcs', pc.id, {
      level,
      hp: { ...pc.hp, max: pc.hp.max + hpGain, current: pc.hp.current + hpGain },
      abilities: scores,
      traits: mergeFeatures(refreshFeatures(pc.traits ?? [], cls, level, scores), added),
      slots: cls ? slotsAt(cls, level, pc.slots) : pc.slots,
      spells: [...pc.spells, ...spells.filter((s) => !pc.spells.some((p) => p.name.toLowerCase() === s.name.toLowerCase())).map((s) => ({ ...s, prepared: true }))],
      hitDie,
      ...(getsSubclass ? { subclass: subclass.name.trim(), subclassId: subclass.srd ? cls!.subclass!.id : undefined } : {}),
    });
    toast(`Level ${level}!`, { description: `${pc.name || 'Your character'} gained ${hpGain} hit points${added.length ? ` and ${added.length} ${added.length === 1 ? 'feature' : 'features'}` : ''}.`, action: { label: 'Undo', onClick: () => updateRecord('pcs', pc.id, prior) } });
    onClose();
  };

  const justNumber = () => {
    updateRecord('pcs', pc.id, { level });
    toast(`Level ${level}`, { description: 'Only the number changed: update the rest on the sheet.', action: { label: 'Undo', onClick: () => updateRecord('pcs', pc.id, { level: pc.level }) } });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[86vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[760px]">
        <header className="flex flex-col gap-3 border-b px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="flex flex-col gap-1">
              <DialogTitle className="font-display text-[28px] leading-none font-black uppercase">Level {level}</DialogTitle>
              <DialogDescription>
                {pc.name || 'Your character'}, {cls?.name ?? pc.className ?? 'adventurer'} {pc.level} → {level}. Proficiency {signed(proficiencyBonus(level))}
                {proficiencyBonus(level) > proficiencyBonus(pc.level) && ' (up one)'}.
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={justNumber}>
              <SkipForwardIcon /> Just Change The Number
            </Button>
          </div>
          <nav aria-label="Steps" className="flex flex-wrap gap-1">
            {steps.map((s, i) => (
              <button key={s} type="button" aria-current={s === step ? 'step' : undefined} onClick={() => setStep(s)} className={cn('flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] text-muted-foreground', s === step && 'border-primary text-foreground', i < at && 'text-foreground')}>
                <span className={cn('flex size-4 items-center justify-center rounded-full font-mono text-[9px]', i < at ? 'bg-primary text-primary-foreground' : 'border')}>{i < at ? <CheckIcon className="size-2.5" strokeWidth={3} /> : i + 1}</span>
                {STEP_LABEL[s]}
              </button>
            ))}
          </nav>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {step === 'hp' && (
            <div className="flex flex-col gap-4">
              <p className="text-[14px] text-muted-foreground">Each level adds one roll of the hit die plus your Constitution modifier ({signed(modifier(pc.abilities.con))}), or the average if you’d rather not risk it.</p>
              {!cls && (
                <div className="flex items-center gap-2">
                  <Label>Hit Die</Label>
                  {[6, 8, 10, 12].map((d) => (
                    <Pick
                      key={d}
                      on={hitDie === d}
                      onClick={() => {
                        setHitDie(d);
                        setHp({ how: 'average', value: averageLevelHp(d, pc.abilities.con) });
                      }}
                    >
                      d{d}
                    </Pick>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Option on={hp.how === 'average'} onClick={() => setHp({ how: 'average', value: averageLevelHp(hitDie, pc.abilities.con) })} title={`Take ${averageLevelHp(hitDie, pc.abilities.con)}`}>
                  The average: {hitDie / 2 + 1} {signed(modifier(pc.abilities.con))}
                </Option>
                <Option
                  on={hp.how === 'roll'}
                  onClick={() => {
                    const r = rollAndShow(`1d${hitDie}${modifier(pc.abilities.con) ? signed(modifier(pc.abilities.con)) : ''}`, `${pc.name || 'Character'} · Level ${level} Hit Points`);
                    if (r) setHp({ how: 'roll', value: Math.max(1, r.total) });
                  }}
                  title={hp.how === 'roll' ? `Rolled ${hp.value}` : `Roll 1d${hitDie}`}
                >
                  <span className="flex items-center gap-1">
                    <DicesIcon className="size-3.5" /> {hp.how === 'roll' ? 'Click to roll again' : `1d${hitDie} ${signed(modifier(pc.abilities.con))}, at least 1`}
                  </span>
                </Option>
              </div>
              <p className="font-mono text-[13px]">
                Hit points: {pc.hp.max} → <span className="font-semibold text-primary">{pc.hp.max + hpGain}</span>
                {conChange !== 0 && ` (with ${signed(conChange * level)} from the new Constitution)`}
              </p>
            </div>
          )}

          {step === 'subclass' && cls?.subclass && (
            <div className="flex flex-col gap-4">
              <p className="text-[14px] text-muted-foreground">At level {level} a {cls.name.toLowerCase()} picks their path. The SRD has one; name another if your table uses it, and add its features by hand.</p>
              <div className="grid grid-cols-2 gap-2">
                <Option on={subclass.srd} onClick={() => setSubclass({ srd: true, name: cls.subclass!.name })} title={cls.subclass.name}>
                  From the SRD, with its features
                </Option>
                <Option on={!subclass.srd} onClick={() => setSubclass({ srd: false, name: subclass.srd ? '' : subclass.name })} title="Another">
                  <input aria-label="Subclass" value={subclass.srd ? '' : subclass.name} placeholder="Name it" onClick={(e) => e.stopPropagation()} onFocus={() => setSubclass((s) => ({ srd: false, name: s.srd ? '' : s.name }))} onChange={(e) => setSubclass({ srd: false, name: e.target.value })} className="w-full bg-transparent text-[13px] text-foreground outline-none" />
                </Option>
              </div>
              {subclass.srd && cls.subclass.text && <RulesText text={cls.subclass.text} className="text-[13.5px]" />}
            </div>
          )}

          {step === 'features' && (
            <div className="flex flex-col gap-3">
              {cls ? (
                gained.length ? (
                  <>
                    <p className="text-[14px] text-muted-foreground">New at level {level}. Each goes into Features & Traits, with its uses and roll where it has them; untick any you don’t want added.</p>
                    {gained.map(({ trait, source }) => {
                      const on = !skip.includes(trait.name);
                      return (
                        <article key={trait.name} className={cn('flex flex-col gap-1.5 rounded-xl border px-4 py-3', !on && 'opacity-55')}>
                          <label className="flex items-center gap-2.5">
                            <input type="checkbox" checked={on} onChange={() => setSkip(on ? [...skip, trait.name] : skip.filter((n) => n !== trait.name))} className="size-4 accent-[var(--primary)]" />
                            <span className="flex-1 text-[14px] font-semibold">{trait.name}</span>
                            <span className="font-mono text-[10.5px] text-muted-foreground uppercase">{source}</span>
                          </label>
                          <RulesText text={trait.text} className="gap-1.5 text-[13px] leading-normal text-foreground/85" />
                        </article>
                      );
                    })}
                  </>
                ) : (
                  <p className="text-[14px] text-muted-foreground">No new features at level {level}{asi ? ', but an ability score improvement is next' : ''}. Counted features (uses, dice) are brought up to the new level for you.</p>
                )
              ) : (
                <>
                  <p className="text-[14px] text-muted-foreground">{pc.className || 'This class'} isn’t one of the SRD’s, so add what it gains at level {level} here (or later, on the sheet).</p>
                  <input aria-label="Feature name" value={custom.name} placeholder="Feature name" onChange={(e) => setCustom({ ...custom, name: e.target.value })} className="rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-primary" />
                  <Textarea aria-label="What it does" rows={4} value={custom.text} placeholder="What it does. “Once you use it, you must finish a long rest…” gives it a use to tick off." onChange={(e) => setCustom({ ...custom, text: e.target.value })} className={cn(AREA, 'text-[13.5px]')} />
                </>
              )}
            </div>
          )}

          {step === 'asi' && (
            <div className="flex flex-col gap-4">
              <p className="text-[14px] text-muted-foreground">An ability score improvement: +2 to one score or +1 to two (none past 20), or a feat in its place.</p>
              <div className="grid grid-cols-3 gap-2">
                <Option on={asiMode === 'two'} onClick={() => setAsiMode('two')} title="+1 And +1">
                  Two scores, one each
                </Option>
                <Option on={asiMode === 'one'} onClick={() => setAsiMode('one')} title="+2">
                  One score, twice
                </Option>
                <Option on={asiMode === 'feat'} onClick={() => setAsiMode('feat')} title="A Feat">
                  Instead of scores
                </Option>
              </div>
              {asiMode === 'feat' ? (
                <>
                  <input aria-label="Feat" value={feat.name} placeholder="Feat name (Grappler, Alert…)" onChange={(e) => setFeat({ ...feat, name: e.target.value })} className="rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-primary" />
                  <Textarea aria-label="What the feat does" rows={4} value={feat.text} placeholder="What it does (and any score it raises: change that on the sheet)." onChange={(e) => setFeat({ ...feat, text: e.target.value })} className={cn(AREA, 'text-[13.5px]')} />
                </>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {ABILITIES.map((a) => {
                    const on = picks.includes(a);
                    const max = pc.abilities[a] >= 20;
                    return (
                      <button
                        key={a}
                        type="button"
                        aria-pressed={on}
                        disabled={max}
                        onClick={() => setPicks(on ? picks.filter((p) => p !== a) : [...picks, a].slice(asiMode === 'one' ? -1 : -2))}
                        className={cn('flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left hover:border-foreground/30 disabled:opacity-40', on && 'border-primary bg-primary/8 ring-1 ring-primary')}
                      >
                        <span className="flex flex-col">
                          <span className="label text-[9.5px]">{ABILITY_NAME[a]}</span>
                          <span className="font-mono text-[12px] text-muted-foreground">
                            {pc.abilities[a]} ({signed(modifier(pc.abilities[a]))})
                          </span>
                        </span>
                        <span className="font-display text-[24px] leading-none font-black">{scores[a]}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 'spells' && cls && (
            <div className="flex flex-col gap-4">
              <SlotTable before={slotsAt(cls, pc.level)} after={slotsAt(cls, level)} />
              <p className="text-[14px] text-muted-foreground">
                {after.prepared
                  ? `${cls.name}s prepare spells from their list (${after.spells} now${cls.id === 'wizard' ? `; ${newSpells} more for the spellbook` : ''}). Add any you want on the sheet${newCantrips ? `, and ${newCantrips} new cantrip${newCantrips > 1 ? 's' : ''}` : ''}.`
                  : newSpells || newCantrips
                    ? `${newSpells ? `${newSpells} new spell${newSpells > 1 ? 's' : ''}` : ''}${newSpells && newCantrips ? ' and ' : ''}${newCantrips ? `${newCantrips} new cantrip${newCantrips > 1 ? 's' : ''}` : ''} to learn, up to level ${after.maxLevel}.`
                    : 'No new spells to learn this level, only the slots above.'}
              </p>
              {(newSpells > 0 || newCantrips > 0 || after.prepared) && (
                <SpellPicker className={cls.name} maxLevel={after.maxLevel} cantrips={newCantrips} spells={after.prepared && cls.id !== 'wizard' ? Math.max(newSpells, 6) : newSpells} picked={spells} onChange={setSpells} />
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="flex flex-col gap-3 text-[14px]">
              <Line label="Level">
                {pc.level} → {level}
              </Line>
              <Line label="Hit Points">
                {pc.hp.max} → {pc.hp.max + hpGain} ({hp.how === 'roll' ? 'rolled' : 'average'})
              </Line>
              {getsSubclass && subclass.name && <Line label="Subclass">{subclass.name}</Line>}
              {asi && <Line label={asiMode === 'feat' ? 'Feat' : 'Scores'}>{asiMode === 'feat' ? feat.name || 'Not named yet' : ABILITIES.filter((a) => scores[a] !== pc.abilities[a]).map((a) => `${ABILITY_NAME[a]} ${pc.abilities[a]} → ${scores[a]}`).join(', ') || 'None picked yet'}</Line>}
              <Line label="New Features">{[...gained.filter((g) => !skip.includes(g.trait.name)).map((g) => g.trait.name), ...(custom.name ? [custom.name] : [])].join(', ') || 'None'}</Line>
              {casts && <Line label="New Spells">{spells.map((s) => s.name).join(', ') || 'None'}</Line>}
            </div>
          )}
        </div>

        <footer className="flex items-center gap-2 border-t px-6 py-3">
          <Button variant="ghost" disabled={at === 0} onClick={() => setStep(steps[at - 1]!)}>
            <ArrowLeftIcon /> Back
          </Button>
          <span className="flex-1" />
          {step === 'review' ? (
            <Button onClick={apply}>
              <CheckIcon /> Level Up
            </Button>
          ) : (
            <Button onClick={() => setStep(steps[at + 1]!)}>
              Next: {STEP_LABEL[steps[at + 1]!]} <ArrowRightIcon />
            </Button>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function SlotTable({ before, after }: { before: [number, number][]; after: [number, number][] }) {
  const levels = after.map(([max], i) => ({ level: i + 1, was: before[i]![0], now: max })).filter((s) => s.now > 0 || s.was > 0);
  if (!levels.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {levels.map((s) => (
        <div key={s.level} className={cn('flex flex-col items-center rounded-lg border px-3 py-1.5', s.now > s.was && 'border-primary')}>
          <span className="label text-[9px]">Level {s.level}</span>
          <span className="text-[15px] font-semibold">
            {s.now}
            {s.now > s.was && <span className="text-[11px] text-primary"> +{s.now - s.was}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function Option({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children?: ReactNode }) {
  return (
    <div role="button" tabIndex={0} aria-pressed={on} onClick={onClick} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())} className={cn('flex cursor-default flex-col items-start gap-1 rounded-xl border px-3.5 py-2.5 text-left outline-none hover:border-foreground/30 focus-visible:border-primary', on && 'border-primary bg-primary/8 ring-1 ring-primary')}>
      <span className="text-[14px] font-semibold">{title}</span>
      {children && <span className="w-full text-[12.5px] text-muted-foreground">{children}</span>}
    </div>
  );
}

function Pick({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn('h-7 rounded-full border px-2.5 font-mono text-[12px]', on && 'border-primary bg-primary/12')}>
      {children}
    </button>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-b pb-2">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}

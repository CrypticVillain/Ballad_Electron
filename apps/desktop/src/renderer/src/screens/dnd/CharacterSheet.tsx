import { useNavigate } from '@tanstack/react-router';
import { AlertTriangleIcon, CircleIcon, CircleCheckIcon, CircleDotIcon, EyeIcon, GemIcon, HeartIcon, LockIcon, LockOpenIcon, MoonIcon, PencilIcon, PlusIcon, ShieldCheckIcon, SparklesIcon, SwordIcon, Trash2Icon, XIcon } from 'lucide-react';
import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { rollAndShow, rollCheck, ROLL_HINT } from '@/components/dnd/rolling';
import { Label } from '@/components/shared/bits';
import { afterConfirm } from '@/components/shared/Confirm';
import { HoverCard } from '@/components/shared/HoverCard';
import { ToolbarButton, ToolbarGroup } from '@/components/shared/Toolbar';
import { AREA, FIELD } from '@/components/shared/Field';
import { Hint } from '@/components/shared/Hint';
import { RowPicture, usePicturesByName } from '@/components/shared/Portrait';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { restore, trash, updateRecord } from '@/lib/actions';
import { ABILITY_NAME, ATTUNEMENT_SLOTS, carriedWeight, carryingCapacity, COIN_NAME, coinsInGold, CONDITION_TEXT, CONDITIONS, damage, heal, initiative, longRest, modifier, passivePerception, proficiencyBonus, saveBonus, signed, SKILLS, skillBonus, spellAttack, spellSaveDc } from '@/lib/dnd';
import { ABILITIES, COINS, type Ability, type Coin, type Item, type PlayerCharacter, type World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { CharacterPlate } from './CharacterPlate';
import { HpBar } from './PartyScreen';
import { AttackDialog, ItemDialog, SpellDialog } from './SheetDialogs';
import { useUi } from '@/stores/ui';
import { FeaturesPanel } from './SheetPanels';

/**
 * CharacterSheet — a player character's sheet, laid out the way D&D Beyond's
 * is read at the table: who they are, the numbers you need every turn (AC,
 * initiative, speed, HP), the six abilities, saves and skills (proficiency
 * marks; click any bonus to roll it), attacks, spell slots and spells,
 * inventory, conditions, features and notes. Everything edits in place, and
 * Long Rest sets HP, slots and death saves back. `readOnly`: another player's
 * character, seen from Player view.
 */
/**
 * Whether the sheet takes typing in place. Locked (the default) its lists
 * change through their dialogs and the rest is played, not typed: hit points,
 * slots, uses, conditions, rolls. The lock in the top bar opens every field.
 */
export const SheetEditable = createContext(true);
export const useEditable = () => useContext(SheetEditable);

/** The top bar's lock: locked, the sheet is played; unlocked, every field is typed into. */
export function LockButton() {
  const unlocked = useUi((s) => s.sheetUnlocked);
  return (
    <ToolbarButton
      icon={unlocked ? LockOpenIcon : LockIcon}
      label={unlocked ? 'Unlocked' : 'Locked'}
      hint={unlocked ? 'Unlocked: every field is typed into. Click to lock.' : 'Locked: lists change through their dialogs. Click to type into every field.'}
      pressed={unlocked}
      onClick={() => useUi.getState().setSheetUnlocked(!unlocked)}
    />
  );
}

export function CharacterSheet({ pc, world, readOnly, crumb = 'Party' }: { pc: PlayerCharacter; world: World; readOnly?: boolean; crumb?: string }) {
  const navigate = useNavigate();
  const set = (changes: Partial<PlayerCharacter>) => updateRecord('pcs', pc.id, changes);
  const prof = proficiencyBonus(pc.level);
  const down = pc.hp.current === 0;

  const unlocked = useUi((s) => s.sheetUnlocked);
  const remove = () =>
    afterConfirm(`Delete ${pc.name || 'This Character'}?`, 'Their sheet goes from the party. Undo is offered right after.', () => {
      trash('pcs', pc.id);
      void navigate({ to: '/party' });
      toast('Character Deleted', { description: pc.name || 'Unnamed Character', action: { label: 'Undo', onClick: () => restore('pcs', pc.id) } });
    }, 'Delete');


  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      <TopBar crumbs={[crumb, pc.name || 'Unnamed Character']}>
        {readOnly ? (
          <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
            <EyeIcon className="size-3.5" /> Read Only · {pc.player || 'Another Player'}’s Sheet
          </span>
        ) : (
          <>
            <span className="hidden font-mono text-[11px] whitespace-nowrap text-muted-foreground @7xl/topbar:inline">{ROLL_HINT}</span>
            <ToolbarGroup label="Sheet">
              <LockButton />
              <ToolbarButton icon={MoonIcon} label="Long Rest" hint="Long rest: hit points, slots, uses and death saves back" onClick={() => takeLongRest(pc)} />
              <ToolbarButton icon={SparklesIcon} label="Inspiration" hint={pc.inspiration ? 'Inspiration: on. Click to spend it.' : 'Inspiration: off. Click to give it.'} pressed={pc.inspiration} onClick={() => set({ inspiration: !pc.inspiration })} />
              <ToolbarButton icon={Trash2Icon} label="Delete" hint="Delete Character" tone="destructive" onClick={remove} />
            </ToolbarGroup>
          </>
        )}
      </TopBar>

      {/* Another player's sheet: every field and roll disabled at once. */}
      <SheetEditable.Provider value={!readOnly && unlocked}>
      <fieldset disabled={readOnly} className="@container min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-7 pt-6 pb-10">
          {/* Who they are. */}
          <CharacterPlate pc={pc} set={set} eyebrow={<span className="shrink-0">{world.name || 'Untitled Campaign'} ·</span>} inspiration={false} />

          {/* Every turn's numbers. */}
          {/* Narrower (the dice pinned beside it): hit points get a row of their own, and the third column goes below. */}
          <section className="grid grid-cols-5 gap-3 @5xl:grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,2.4fr)]">
            <Stat label="Armor Class">
              <NumberInput label="Armor class" value={pc.ac} onChange={(ac) => set({ ac })} className="font-display text-[30px] font-black" />
            </Stat>
            <Stat label="Initiative">
              <RollValue bonus={initiative(pc)} label={`${pc.name || 'Character'} · Initiative`} big />
            </Stat>
            <Stat label="Speed">
              <span className="flex items-baseline gap-1">
                <NumberInput label="Speed" value={pc.speed} step={5} onChange={(speed) => set({ speed })} className="w-14 font-display text-[30px] font-black" />
                <span className="font-mono text-[11px] text-muted-foreground">ft.</span>
              </span>
            </Stat>
            <Stat label="Proficiency">
              <span className="font-display text-[30px] leading-none font-black">{signed(prof)}</span>
            </Stat>
            <Stat label="Passive Perception">
              <span className="font-display text-[30px] leading-none font-black">{passivePerception(pc)}</span>
            </Stat>
            <div className="col-span-5 @5xl:col-span-1">
              <HitPointsCard pc={pc} />
            </div>
          </section>

          {down && <DeathSaves pc={pc} />}

          <div className="grid grid-cols-2 items-start gap-4 @5xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.25fr)]">
            {/* Abilities and saves. */}
            <div className="flex flex-col gap-4">
              <Card title="Abilities">
                <div className="grid grid-cols-3 gap-2">
                  {ABILITIES.map((ability) => (
                    <div key={ability} className="flex flex-col items-center gap-1 rounded-xl border bg-muted/40 px-2 py-2.5">
                      <span className="label max-w-full truncate text-[9.5px]">{ABILITY_NAME[ability]}</span>
                      <RollValue bonus={modifier(pc.abilities[ability])} label={`${ABILITY_NAME[ability]} Check`} big />
                      <NumberInput
                        label={`${ABILITY_NAME[ability]} score`}
                        value={pc.abilities[ability]}
                        min={1}
                        max={30}
                        onChange={(score) => set({ abilities: { ...pc.abilities, [ability]: score } })}
                        className="w-12 rounded-full border bg-background text-center font-mono text-[12px]"
                      />
                    </div>
                  ))}
                </div>
              </Card>
              <SavesCard pc={pc} />
            </div>

            {/* Skills. */}
            <SkillsCard pc={pc} />

            <div className="col-span-2 flex flex-col gap-4 @5xl:col-span-1">
              <Attacks pc={pc} />
              <Spells pc={pc} />
              <ConditionsCard pc={pc} />
            </div>
          </div>

          <InventoryPanel pc={pc} />
          <div className="grid grid-cols-3 gap-4">
            <FeaturesPanel pc={pc} />
            <ProficienciesCard pc={pc} rows={8} />
            <Card title="Notes">
              <Textarea aria-label="Notes" rows={8} value={pc.notes} placeholder="Backstory, bonds, the debt they owe…" onChange={(e) => set({ notes: e.target.value })} className={cn(AREA, 'resize-y text-[13px] leading-relaxed')} />
            </Card>
          </div>
        </div>
      </fieldset>
      </SheetEditable.Provider>
    </main>
  );
}

/** Hit points: current / max, temporary, and a box to apply damage or healing. */
export function HitPointsCard({ pc }: { pc: PlayerCharacter }) {
  const [amount, setAmount] = useState('');
  const value = Math.max(0, Number(amount) || 0);
  const apply = (kind: 'damage' | 'heal') => {
    if (!value) return;
    const hp = kind === 'damage' ? damage(pc.hp, value) : heal(pc.hp, value);
    // Back on their feet: the death saves reset.
    updateRecord('pcs', pc.id, { hp, ...(kind === 'heal' && hp.current > 0 ? { deathSaves: { successes: 0, failures: 0 } } : {}) });
    setAmount('');
  };
  return (
    <section className="flex flex-col gap-2 rounded-2xl border px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Hit Points</Label>
        <span className="flex items-baseline gap-1 font-mono text-[11px] text-muted-foreground">
          Temp
          <NumberInput play label="Temporary hit points" value={pc.hp.temp} onChange={(temp) => updateRecord('pcs', pc.id, { hp: { ...pc.hp, temp } })} className="w-10 text-right text-foreground" />
        </span>
      </div>
      <div className="flex items-end gap-3">
        <span className="flex items-baseline gap-1">
          <NumberInput play label="Current hit points" value={pc.hp.current} max={pc.hp.max} onChange={(current) => updateRecord('pcs', pc.id, { hp: { ...pc.hp, current } })} className="w-[64px] text-right font-display text-[34px] font-black" />
          <span className="font-display text-[20px] font-black text-muted-foreground">/</span>
          <NumberInput label="Max hit points" value={pc.hp.max} min={1} onChange={(max) => updateRecord('pcs', pc.id, { hp: { ...pc.hp, max, current: Math.min(pc.hp.current, max) } })} className="w-12 font-display text-[20px] font-black text-muted-foreground" />
        </span>
        <div className="flex flex-1 items-center gap-1.5">
          <Input aria-label="Amount" type="number" min={0} value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && apply('damage')} className={cn(FIELD, 'h-8 w-16 font-mono text-[13px]')} />
          <Button variant="outline" size="sm" className="h-8 text-destructive" disabled={!value} onClick={() => apply('damage')}>
            <SwordIcon /> Damage
          </Button>
          <Button variant="outline" size="sm" className="h-8" disabled={!value} onClick={() => apply('heal')}>
            <HeartIcon /> Heal
          </Button>
        </div>
      </div>
      <HpBar current={pc.hp.current} max={pc.hp.max} />
    </section>
  );
}

export function DeathSaves({ pc }: { pc: PlayerCharacter }) {
  const set = (deathSaves: PlayerCharacter['deathSaves']) => updateRecord('pcs', pc.id, { deathSaves });
  const row = (kind: 'successes' | 'failures') => (
    <span className="flex items-center gap-1.5">
      <span className="w-20 font-mono text-[11px] text-muted-foreground uppercase">{kind}</span>
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${kind} ${n}`}
          onClick={() => set({ ...pc.deathSaves, [kind]: pc.deathSaves[kind] >= n ? n - 1 : n })}
          className={cn('size-5 rounded-full border-2', pc.deathSaves[kind] >= n && (kind === 'successes' ? 'border-online bg-online' : 'border-destructive bg-destructive'))}
        />
      ))}
    </span>
  );
  return (
    <section className="flex flex-wrap items-center gap-6 rounded-2xl border border-destructive/60 bg-destructive/5 px-5 py-3">
      <Label className="text-destructive">Down · Death Saves</Label>
      {row('successes')}
      {row('failures')}
      <Button variant="outline" size="sm" onClick={() => rollAndShow('d20', `${pc.name || 'Character'} · Death Save`)}>
        Roll Death Save
      </Button>
      <span className="text-[12.5px] text-muted-foreground">
        {pc.deathSaves.successes >= 3 ? 'Stable.' : pc.deathSaves.failures >= 3 ? 'Dead.' : '10 or higher succeeds; a natural 20 brings them back with 1 HP.'}
      </span>
    </section>
  );
}

export function Attacks({ pc }: { pc: PlayerCharacter }) {
  const set = (attacks: PlayerCharacter['attacks']) => updateRecord('pcs', pc.id, { attacks });
  const editable = useEditable();
  const [dialog, setDialog] = useState<{ index?: number } | null>(null);
  const remove = (i: number) => afterConfirm(`Remove ${pc.attacks[i]?.name || 'This Attack'}?`, undefined, () => set(pc.attacks.filter((_, j) => j !== i)));
  return (
    <Card
      title="Attacks"
      action={<AddButton label="Add attack" onClick={() => (editable ? set([...pc.attacks, { name: '', bonus: proficiencyBonus(pc.level) + modifier(pc.abilities.str), damage: '1d8' }]) : setDialog({}))} />}
    >
      {pc.attacks.length ? (
        <ul className="flex flex-col">
          {pc.attacks.map((attack, i) => (
            <li key={i} className="group/row flex items-center gap-2 border-t border-border/60 py-1.5 first:border-t-0">
              {editable ? (
                <>
                  <input aria-label="Attack" value={attack.name} placeholder="Longbow" onChange={(e) => set(pc.attacks.map((a, j) => (j === i ? { ...a, name: e.target.value } : a)))} className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none" />
                  <RollValue bonus={attack.bonus} label={`${attack.name || 'Attack'} · To Hit`} />
                  <NumberInput label="To-hit bonus" value={attack.bonus} min={-10} max={30} onChange={(bonus) => set(pc.attacks.map((a, j) => (j === i ? { ...a, bonus } : a)))} className="w-8 text-center font-mono text-[11px] text-muted-foreground" />
                  <input aria-label="Damage" value={attack.damage} placeholder="1d8+3" onChange={(e) => set(pc.attacks.map((a, j) => (j === i ? { ...a, damage: e.target.value } : a)))} className="w-16 bg-transparent font-mono text-[12px] outline-none" />
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{attack.name || 'Unnamed Attack'}</span>
                  <RollValue bonus={attack.bonus} label={`${attack.name || 'Attack'} · To Hit`} />
                  <span className="w-16 font-mono text-[12px]">{attack.damage}</span>
                </>
              )}
              <Hint label="Roll damage">
                <Button variant="outline" size="xs" onClick={() => rollAndShow(attack.damage, `${attack.name || 'Attack'} · Damage`)}>
                  Dmg
                </Button>
              </Hint>
              <RowActions name={attack.name || 'attack'} onEdit={() => setDialog({ index: i })} onRemove={() => remove(i)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">No attacks yet.</p>
      )}
      {dialog && <AttackDialog pc={pc} index={dialog.index} onClose={() => setDialog(null)} />}
    </Card>
  );
}

/** A row's Edit (its dialog) and Remove (after a confirmation), shown on hover. */
export function RowActions({ name, onEdit, onRemove }: { name: string; onEdit: () => void; onRemove: () => void }) {
  return (
    <span className="flex shrink-0 gap-0.5 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100">
      <Hint label="Edit">
        <Button variant="ghost" size="icon-xs" aria-label={`Edit ${name}`} onClick={onEdit}>
          <PencilIcon />
        </Button>
      </Hint>
      <Hint label="Remove">
        <Button variant="ghost" size="icon-xs" aria-label={`Remove ${name}`} onClick={onRemove}>
          <XIcon />
        </Button>
      </Hint>
    </span>
  );
}

export function Spells({ pc }: { pc: PlayerCharacter }) {
  const set = (changes: Partial<PlayerCharacter>) => updateRecord('pcs', pc.id, changes);
  const levels = pc.slots.map((slot, i) => ({ level: i + 1, max: slot[0], used: slot[1] })).filter((s) => s.max > 0 || s.level <= 3);
  const setSlot = (level: number, slot: [number, number]) => set({ slots: pc.slots.map((s, i) => (i === level - 1 ? slot : s)) });
  const editable = useEditable();
  const spellPictures = usePicturesByName('spells');
  const [dialog, setDialog] = useState<{ index?: number } | null>(null);
  const dc = spellSaveDc(pc);
  const attack = spellAttack(pc);
  return (
    <Card title="Spell Slots & Spells" action={<AddButton label="Add spell" onClick={() => (editable ? set({ spells: [...pc.spells, { name: '', level: 1, prepared: true }] }) : setDialog({}))} />}>
      <div className="flex items-center gap-5 rounded-xl border bg-muted/30 px-3 py-2">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="label text-[9.5px]">Casting Ability</span>
          {editable ? (
            <SelectField
              label="Spellcasting ability"
              variant="inline"
              value={pc.spellcasting ?? null}
              onChange={(spellcasting) => set({ spellcasting })}
              options={[{ value: null as Ability | null, label: 'None' }, ...ABILITIES.map((a) => ({ value: a as Ability | null, label: ABILITY_NAME[a] }))]}
              className="text-[13px] font-semibold"
            />
          ) : (
            <span className="text-[13px] font-semibold">{pc.spellcasting ? ABILITY_NAME[pc.spellcasting] : 'None'}</span>
          )}
        </span>
        {dc !== null && attack !== null && (
          <>
            <span className="flex flex-col items-center gap-1">
              <span className="font-display text-[26px] leading-none font-black">{dc}</span>
              <span className="label text-[9px]">Save DC</span>
            </span>
            <span className="flex flex-col items-center gap-1">
              <RollValue bonus={attack} label={`${pc.name || 'Character'} · Spell Attack`} big />
              <span className="label text-[9px]">Spell Attack</span>
            </span>
          </>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {levels.map(({ level, max, used }) => (
          <div key={level} className="flex items-center gap-2">
            <span className="w-10 font-mono text-[11px] text-muted-foreground">LVL {level}</span>
            <span className="flex flex-1 gap-1">
              {Array.from({ length: max }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Level ${level} slot ${n + 1}${n < used ? ', used' : ''}`}
                  onClick={() => setSlot(level, [max, n < used ? n : n + 1])}
                  className={cn('size-4 rounded-[4px] border-2 border-primary', n < used ? 'bg-transparent opacity-50' : 'bg-primary')}
                />
              ))}
              {!max && <span className="text-[12px] text-muted-foreground">None</span>}
            </span>
            {editable && <NumberInput label={`Level ${level} slots`} value={max} min={0} max={9} onChange={(m) => setSlot(level, [m, Math.min(used, m)])} className="w-8 text-center font-mono text-[11px]" />}
          </div>
        ))}
        <Button variant="ghost" size="xs" className="self-start text-muted-foreground" onClick={() => set({ slots: pc.slots.map(([max]) => [max, 0] as [number, number]) })}>
          Long Rest: Restore Slots
        </Button>
      </div>
      {pc.spells.length > 0 && (
        <ul className="flex flex-col border-t pt-2">
          {[...pc.spells.entries()]
            .sort(([, a], [, b]) => a.level - b.level)
            .map(([i, spell]) => (
              <li key={i} className="group/row flex items-center gap-2 py-1">
                <Hint label={spell.prepared ? 'Prepared' : 'Not prepared'}>
                  <button type="button" aria-label="Prepared" onClick={() => set({ spells: pc.spells.map((s, j) => (j === i ? { ...s, prepared: !s.prepared } : s)) })} className="text-primary">
                    {spell.prepared ? <CircleCheckIcon className="size-4" /> : <CircleIcon className="size-4 text-muted-foreground" />}
                  </button>
                </Hint>
                {editable ? (
                  <>
                    <input aria-label="Spell" value={spell.name} placeholder="Hunter’s Mark" onChange={(e) => set({ spells: pc.spells.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)) })} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
                    <SelectField
                      label="Spell level"
                      variant="inline"
                      align="end"
                      value={spell.level}
                      onChange={(level) => set({ spells: pc.spells.map((s, j) => (j === i ? { ...s, level } : s)) })}
                      options={Array.from({ length: 10 }, (_, l) => ({ value: l, label: l === 0 ? 'Cantrip' : `Level ${l}` }))}
                      className="font-mono text-[11px] text-muted-foreground"
                    />
                  </>
                ) : (
                  <>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <RowPicture image={spellPictures.get(spell.name.trim().toLowerCase())} className="ml-0 size-5 rounded" />
                      <span className="truncate text-[13px]">{spell.name || 'Unnamed Spell'}</span>
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">{spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}</span>
                  </>
                )}
                <RowActions name={spell.name || 'spell'} onEdit={() => setDialog({ index: i })} onRemove={() => afterConfirm(`Remove ${spell.name || 'This Spell'}?`, `It comes off ${pc.name || 'the character'}’s spells.`, () => set({ spells: pc.spells.filter((_, j) => j !== i) }))} />
              </li>
            ))}
        </ul>
      )}
      {dialog && <SpellDialog pc={pc} index={dialog.index} onClose={() => setDialog(null)} />}
    </Card>
  );
}

/** Conditions: click to set or clear one. */
/**
 * Conditions: click to set or clear one, hover for what it does. The ones the
 * character has are spelled out above the buttons in red, so they aren't missed.
 */
export function ConditionsCard({ pc }: { pc: PlayerCharacter }) {
  const set = (changes: Partial<PlayerCharacter>) => updateRecord('pcs', pc.id, changes);
  const active = CONDITIONS.filter((c) => pc.conditions.includes(c));
  return (
    <Card title="Conditions" meta={active.length ? `${active.length} Active` : undefined}>
      <div role="status" aria-live="polite" className={cn('flex flex-col gap-1.5 rounded-xl border px-3 py-2', active.length ? 'border-destructive/50 bg-destructive/8' : 'border-dashed')}>
        {active.length ? (
          active.map((condition) => (
            <p key={condition} className="flex gap-2 text-[12.5px] leading-snug text-destructive">
              <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <b>{condition}.</b> {CONDITION_TEXT[condition]}
              </span>
            </p>
          ))
        ) : (
          <p className="text-[12.5px] text-muted-foreground">No conditions. Hover one to read what it does.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CONDITIONS.map((condition) => {
          const on = pc.conditions.includes(condition);
          return (
            <HoverCard
              key={condition}
              title={condition}
              trigger={
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ conditions: on ? pc.conditions.filter((c) => c !== condition) : [...pc.conditions, condition] })}
                  className={cn('h-7 rounded-full border px-2.5 text-[12px] text-muted-foreground hover:text-foreground', on && 'border-destructive bg-destructive/12 font-medium text-destructive hover:text-destructive')}
                >
                  {condition}
                </button>
              }
            >
              <p className="text-[12.5px] leading-normal">{CONDITION_TEXT[condition]}</p>
              <p className="border-t pt-1.5 text-[11.5px] text-muted-foreground">{on ? 'Click to clear it.' : 'Click to set it.'}</p>
            </HoverCard>
          );
        })}
      </div>
    </Card>
  );
}

export function ProficienciesCard({ pc, rows = 5 }: { pc: PlayerCharacter; rows?: number }) {
  return (
    <Card title="Proficiencies & Training">
      <Textarea
        aria-label="Proficiencies and training"
        readOnly={!useEditable()}
        rows={rows}
        value={pc.proficiencies ?? ''}
        placeholder="Armor, weapons, tools, languages…"
        onChange={(e) => updateRecord('pcs', pc.id, { proficiencies: e.target.value })}
        className={cn(AREA, 'resize-y text-[13px] leading-relaxed')}
      />
    </Card>
  );
}

const COIN_TINT: Record<Coin, string> = { cp: 'bg-[#b87333]', sp: 'bg-[#c4c7cc]', ep: 'bg-[#d6cc95]', gp: 'bg-[#e3b437]', pp: 'bg-[#eceae6] ring-1 ring-border' };

/**
 * Inventory: coins (and their worth in gold), the weight carried against
 * Strength × 15 lb, magic items attuned (three at most), then the equipment:
 * what's worn or in hand first, the backpack after.
 */
export function InventoryPanel({ pc }: { pc: PlayerCharacter }) {
  const setItems = (inventory: Item[]) => updateRecord('pcs', pc.id, { inventory });
  const change = (i: number, changes: Partial<Item>) => setItems(pc.inventory.map((it, j) => (j === i ? { ...it, ...changes } : it)));
  const currency: Record<Coin, number> = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, ...pc.currency };
  const weight = carriedWeight(pc.inventory);
  const capacity = carryingCapacity(pc.abilities.str);
  const attuned = pc.inventory.filter((it) => it.attuned).length;
  const rows = [...pc.inventory.entries()];
  const groups = [
    { title: 'Equipped', rows: rows.filter(([, it]) => it.equipped) },
    { title: 'Backpack', rows: rows.filter(([, it]) => !it.equipped) },
  ];
  const columns = 'grid grid-cols-[24px_minmax(0,1fr)_44px_58px_24px_minmax(0,0.9fr)_44px] items-center gap-2';
  const editable = useEditable();
  const itemPictures = usePicturesByName('items');
  const [dialog, setDialog] = useState<{ index?: number } | null>(null);
  const remove = (i: number) => afterConfirm(`Remove ${pc.inventory[i]?.name || 'This Item'}?`, `It comes out of ${pc.name || 'the character'}’s inventory.`, () => setItems(pc.inventory.filter((_, j) => j !== i)));

  return (
    <Card title="Inventory" action={<AddButton label="Add item" onClick={() => (editable ? setItems([...pc.inventory, { name: '', qty: 1, weight: 0 }]) : setDialog({}))} />}>
      <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.75fr)] gap-3">
        <div className="flex flex-col gap-1.5 rounded-xl border bg-muted/30 px-3 py-2">
          <span className="flex items-baseline justify-between gap-2">
            <span className="label text-[9.5px]">Coins</span>
            <span className="font-mono text-[10.5px] text-muted-foreground">≈ {coinsInGold(currency)} gp</span>
          </span>
          <div className="grid grid-cols-5 gap-1">
            {COINS.map((coin) => (
              <span key={coin} className="flex flex-col items-center gap-0.5">
                <NumberInput play label={`${COIN_NAME[coin]} pieces`} value={currency[coin]} max={999999} onChange={(n) => updateRecord('pcs', pc.id, { currency: { ...currency, [coin]: n } })} className="w-full text-center font-display text-[20px] font-black" />
                <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground uppercase">
                  <span className={cn('size-2 rounded-full', COIN_TINT[coin])} />
                  {coin}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between gap-1.5 rounded-xl border bg-muted/30 px-3 py-2">
          <span className="label text-[9.5px]">Weight Carried</span>
          <span className={cn('font-display text-[24px] leading-none font-black', weight > capacity && 'text-destructive')}>
            {weight}
            <span className="text-[14px] text-muted-foreground"> / {capacity} lb</span>
          </span>
          <span className="block h-1.5 overflow-hidden rounded-full bg-input" aria-hidden>
            <span className={cn('block h-full rounded-full', weight > capacity ? 'bg-destructive' : weight > capacity * 0.66 ? 'bg-primary' : 'bg-online')} style={{ width: `${Math.min(100, (weight / Math.max(1, capacity)) * 100)}%` }} />
          </span>
        </div>
        <div className="flex flex-col justify-between gap-1.5 rounded-xl border bg-muted/30 px-3 py-2">
          <span className="label text-[9.5px]">Attuned</span>
          <span className="font-display text-[24px] leading-none font-black">
            {attuned}
            <span className="text-[14px] text-muted-foreground"> / {ATTUNEMENT_SLOTS}</span>
          </span>
          <span className="flex gap-1" aria-hidden>
            {Array.from({ length: ATTUNEMENT_SLOTS }, (_, n) => (
              <span key={n} className={cn('h-1.5 flex-1 rounded-full', n < attuned ? 'bg-primary' : 'bg-input')} />
            ))}
          </span>
        </div>
      </div>

      {pc.inventory.length ? (
        <div className="flex flex-col">
          <div className={cn(columns, 'border-b pb-1.5 font-mono text-[9.5px] tracking-[0.12em] text-muted-foreground uppercase')}>
            <span title="Equipped">Eq</span>
            <span>Item</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Lb Each</span>
            <span title="Attuned">At</span>
            <span>Notes</span>
            <span />
          </div>
          {groups.map(
            (group) =>
              group.rows.length > 0 && (
                <Fragment key={group.title}>
                  <span className="label pt-3 pb-1 text-[9.5px]">
                    {group.title} · {group.rows.reduce((n, [, it]) => n + it.qty, 0)}
                  </span>
                  {group.rows.map(([i, item]) => (
                    <div key={i} className={cn(columns, 'group/row border-t border-border/60 py-1 first:border-t-0')}>
                      <Hint label={item.equipped ? 'Equipped: move to backpack' : 'In the backpack: equip'}>
                        <button type="button" aria-label="Equipped" aria-pressed={Boolean(item.equipped)} onClick={() => change(i, { equipped: !item.equipped })} className={item.equipped ? 'text-primary' : 'text-muted-foreground/60 hover:text-muted-foreground'}>
                          {item.equipped ? <ShieldCheckIcon className="size-4" /> : <CircleIcon className="size-4" />}
                        </button>
                      </Hint>
                      {editable ? (
                        <>
                          <input aria-label="Item" value={item.name} placeholder="Rope, 50 ft." onChange={(e) => change(i, { name: e.target.value })} className="min-w-0 bg-transparent text-[13px] outline-none" />
                          <NumberInput label="Quantity" value={item.qty} min={0} max={9999} onChange={(qty) => change(i, { qty })} className="w-full text-center font-mono text-[12px]" />
                          <WeightInput value={item.weight ?? 0} onChange={(w) => change(i, { weight: w })} />
                        </>
                      ) : (
                        <>
                          <span className="flex min-w-0 items-center gap-2">
                            <RowPicture image={itemPictures.get(item.name.trim().toLowerCase())} className="ml-0 size-5 rounded" />
                            <span className="truncate text-[13px]">{item.name || 'Unnamed Item'}</span>
                          </span>
                          <span className="text-center font-mono text-[12px]">{item.qty}</span>
                          <span className="text-right font-mono text-[12px]">{item.weight || '—'}</span>
                        </>
                      )}
                      <Hint label={item.attuned ? 'Attuned' : attuned >= ATTUNEMENT_SLOTS ? 'Attuned to three already' : 'Attune'}>
                        <button
                          type="button"
                          aria-label="Attuned"
                          aria-pressed={Boolean(item.attuned)}
                          disabled={!item.attuned && attuned >= ATTUNEMENT_SLOTS}
                          onClick={() => change(i, { attuned: !item.attuned })}
                          className={cn('disabled:opacity-30', item.attuned ? 'text-primary' : 'text-muted-foreground/50 hover:text-muted-foreground')}
                        >
                          <GemIcon className="size-4" />
                        </button>
                      </Hint>
                      {editable ? (
                        <input aria-label="Notes" value={item.notes ?? ''} placeholder="—" onChange={(e) => change(i, { notes: e.target.value })} className="min-w-0 bg-transparent text-[12px] text-muted-foreground outline-none focus:text-foreground" />
                      ) : (
                        <span className="min-w-0 truncate text-[12px] text-muted-foreground">{item.notes || '—'}</span>
                      )}
                      <RowActions name={item.name || 'item'} onEdit={() => setDialog({ index: i })} onRemove={() => remove(i)} />
                    </div>
                  ))}
                </Fragment>
              ),
          )}
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">Nothing carried yet.</p>
      )}
      {dialog && <ItemDialog pc={pc} index={dialog.index} onClose={() => setDialog(null)} />}
    </Card>
  );
}

/** Pounds, tenths allowed ("0.05" for an arrow): kept as typed until it's a number. */
function WeightInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(value ? String(value) : '');
  useEffect(() => {
    if ((Number(text) || 0) !== value) setText(value ? String(value) : '');
    // Only when the record changes under us (another row removed, Undo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      aria-label="Weight each, in pounds"
      inputMode="decimal"
      value={text}
      placeholder="—"
      onChange={(e) => {
        const next = e.target.value.replace(/[^\d.]/g, '');
        setText(next);
        const n = Number(next);
        if (Number.isFinite(n)) onChange(n);
      }}
      className="w-full bg-transparent text-right font-mono text-[12px] outline-none focus:text-link"
    />
  );
}

/** A long rest: HP, slots and death saves back, with Undo. */
export function takeLongRest(pc: PlayerCharacter) {
  const before = { hp: pc.hp, slots: pc.slots, deathSaves: pc.deathSaves, traits: pc.traits };
  updateRecord('pcs', pc.id, longRest(pc));
  toast('Long Rest', { description: 'Hit points, spell slots, death saves and feature uses restored.', action: { label: 'Undo', onClick: () => updateRecord('pcs', pc.id, before) } });
}

/** Saving throws: proficiency marks, click a bonus to roll it. */
export function SavesCard({ pc }: { pc: PlayerCharacter }) {
  const set = (changes: Partial<PlayerCharacter>) => updateRecord('pcs', pc.id, changes);
  return (
    <Card title="Saving Throws">
      <ul className="flex flex-col">
        {ABILITIES.map((ability) => {
          const proficient = pc.saves.includes(ability);
          return (
            <li key={ability} className="flex items-center gap-2.5 border-t border-border/60 py-1.5 first:border-t-0">
              <ProfToggle level={proficient ? 1 : 0} max={1} label={`${ABILITY_NAME[ability]} save proficiency`} onChange={(l) => set({ saves: l ? [...pc.saves, ability] : pc.saves.filter((s) => s !== ability) })} />
              <span className="flex-1 text-[13.5px]">{ABILITY_NAME[ability]}</span>
              <RollValue bonus={saveBonus(pc, ability)} label={`${ABILITY_NAME[ability]} Save`} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** The eighteen skills: none / proficient / expertise, click a bonus to roll it. */
export function SkillsCard({ pc }: { pc: PlayerCharacter }) {
  const set = (changes: Partial<PlayerCharacter>) => updateRecord('pcs', pc.id, changes);
  return (
    <Card title="Skills" meta="◉ Proficient · ● Expertise">
      <ul className="flex flex-col">
        {SKILLS.map((skill) => {
          const level = pc.expertise.includes(skill.name) ? 2 : pc.skills.includes(skill.name) ? 1 : 0;
          return (
            <li key={skill.name} className="flex items-center gap-2.5 border-t border-border/60 py-1 first:border-t-0">
              <ProfToggle
                level={level}
                max={2}
                label={`${skill.name} proficiency`}
                onChange={(l) =>
                  set({
                    skills: l >= 1 ? [...new Set([...pc.skills, skill.name])] : pc.skills.filter((s) => s !== skill.name),
                    expertise: l === 2 ? [...new Set([...pc.expertise, skill.name])] : pc.expertise.filter((s) => s !== skill.name),
                  })
                }
              />
              <span className="flex-1 text-[13px]">{skill.name}</span>
              <span className="w-7 font-mono text-[10px] text-muted-foreground uppercase">{skill.ability}</span>
              <RollValue bonus={skillBonus(pc, skill.name)} label={skill.name} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

/** A bonus you click to roll a d20 with it (Shift: advantage, Alt: disadvantage). */
export function RollValue({ bonus, label, big }: { bonus: number; label: string; big?: boolean }) {
  return (
    <Hint label={`${label}: ${ROLL_HINT}`}>
      <button
        type="button"
        onClick={(e) => rollCheck(bonus, label, e)}
        className={cn(
          'rounded-md px-1.5 font-mono tabular-nums transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          big ? 'font-display text-[30px] leading-none font-black' : 'text-[13px] font-semibold',
        )}
      >
        {signed(bonus)}
      </button>
    </Hint>
  );
}

/** A number edited in place (no spinner arrows), kept between min and max. */
export function NumberInput({ label, value, onChange, min = 0, max = 999, step = 1, className, play }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; className?: string; play?: boolean }) {
  // `play`: changed in play (hit points), so typed into even on a locked sheet.
  const editable = useEditable() || play;
  if (!editable) {
    return (
      <span aria-label={label} className={cn('inline-block leading-none', className)}>
        {value}
      </span>
    );
  }
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value.replace(/[^\d-]/g, ''));
        if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          onChange(Math.max(min, Math.min(max, value + (e.key === 'ArrowUp' ? step : -step))));
        }
      }}
      className={cn('bg-transparent leading-none outline-none focus:text-link', className)}
    />
  );
}

/** Proficiency: none, proficient, expertise (click to step through). */
export function ProfToggle({ level, max, label, onChange }: { level: number; max: 1 | 2; label: string; onChange: (level: number) => void }) {
  const Icon = level === 2 ? CircleDotIcon : level === 1 ? CircleCheckIcon : CircleIcon;
  const editable = useEditable();
  return (
    <button type="button" aria-label={label} aria-pressed={level > 0} disabled={!editable} onClick={() => onChange((level + 1) % (max + 1))} className={cn('shrink-0', level ? 'text-primary' : 'text-muted-foreground/60 hover:text-muted-foreground')}>
      <Icon className="size-4" />
    </button>
  );
}

export function PlateField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[9.5px] tracking-[0.16em] opacity-70">{label}</dt>
      <dd>
        <input aria-label={label} readOnly={!useEditable()} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-28 bg-transparent text-[13px] font-semibold uppercase outline-none placeholder:text-background/40" />
      </dd>
    </div>
  );
}

export function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col items-start justify-between gap-1.5 rounded-2xl border px-4 py-3">
      <span className="label text-[9.5px]">{label}</span>
      {children}
    </section>
  );
}

export function Card({ title, meta, action, children }: { title: string; meta?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <Label>{title}</Label>
        {meta && <span className="font-mono text-[10px] text-muted-foreground">{meta}</span>}
        {action}
      </div>
      {children}
    </section>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Hint label={label}>
      <Button variant="ghost" size="icon-xs" aria-label={label} onClick={onClick}>
        <PlusIcon />
      </Button>
    </Hint>
  );
}

export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={`Remove ${label}`} onClick={onClick} className="rounded text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:text-foreground focus-visible:opacity-100">
      <XIcon className="size-3.5" />
    </button>
  );
}


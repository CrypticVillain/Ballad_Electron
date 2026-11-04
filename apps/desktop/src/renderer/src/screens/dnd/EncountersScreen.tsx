import { Link, Navigate, useNavigate, useParams } from '@tanstack/react-router';
import { ChevronLeftIcon, ChevronRightIcon, DicesIcon, HeartIcon, PlayIcon, PlusIcon, ShieldIcon, SquareIcon, SwordIcon, SwordsIcon, Trash2Icon, UsersIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { rollAndShow } from '@/components/dnd/rolling';
import { Empty, Label, Led } from '@/components/shared/bits';
import { AREA } from '@/components/shared/Field';
import { Hint } from '@/components/shared/Hint';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SidebarLink, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { combatant, createEncounter, restore, trash, updateRecord } from '@/lib/actions';
import { CONDITIONS, damage, heal, initiative, modifier, signed } from '@/lib/dnd';
import { useRecord, useRole, useWorld, useWorldRecords } from '@/lib/hooks';
import type { Combatant, Encounter, Monster, PlayerCharacter } from '@/lib/model';
import { cn } from '@/lib/utils';
import { HpBar } from './PartyScreen';

/** Highest initiative first; ties go to the one added first. Combatants without one sit at the end. */
export function initiativeOrder(combatants: Combatant[]): Combatant[] {
  return combatants
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (b.c.initiative ?? -Infinity) - (a.c.initiative ?? -Infinity) || a.i - b.i)
    .map(({ c }) => c);
}

/** /encounters: opens the last-edited encounter. */
export function EncountersIndex() {
  const world = useWorld();
  const player = useRole() === 'player';
  const encounters = useWorldRecords('encounters');
  const navigate = useNavigate();
  if (player) return <Navigate to="/" replace />;
  const last = [...encounters].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (last) return <Navigate to="/encounters/$encounterId" params={{ encounterId: last.id }} replace />;
  return (
    <>
      <EncountersSidebar />
      <main className="flex min-w-0 flex-1 items-center justify-center bg-background">
        <Empty title="No Encounters Yet" action={world && <Button onClick={() => void navigate({ to: '/encounters/$encounterId', params: { encounterId: createEncounter(world.id).id } })}>New Encounter</Button>}>
          Build a fight ahead of time, then run it here: initiative, turns, hit points and conditions.
        </Empty>
      </main>
    </>
  );
}

/** /encounters/$encounterId — building and running one encounter. */
export function EncountersScreen() {
  const { encounterId } = useParams({ from: '/encounters/$encounterId' });
  const encounter = useRecord('encounters', encounterId);
  const world = useWorld();
  const player = useRole() === 'player';
  if (player) return <Navigate to="/" replace />;
  if (!encounter || encounter.worldId !== world?.id) return <Navigate to="/encounters" replace />;
  return (
    <>
      <EncountersSidebar />
      <Tracker key={encounter.id} encounter={encounter} />
    </>
  );
}

function EncountersSidebar() {
  const world = useWorld();
  const navigate = useNavigate();
  const encounters = useWorldRecords('encounters');
  const sorted = [...encounters].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Sidebar title="Encounters" addLabel="New Encounter" onAdd={world ? () => void navigate({ to: '/encounters/$encounterId', params: { encounterId: createEncounter(world.id).id } }) : undefined}>
      <SidebarSection title={`Encounters · ${encounters.length}`}>
        {sorted.map((e) => (
          <SidebarLink key={e.id} to={`/encounters/${e.id}`} lead={<Led tone={e.round > 0 ? 'accent' : 'off'} />} label={e.name} meta={e.round > 0 ? `R${e.round}` : e.combatants.length || undefined} />
        ))}
      </SidebarSection>
    </Sidebar>
  );
}

/**
 * Tracker — an encounter, D&D Beyond's encounter builder and combat tracker
 * in one: add the party and creatures from the bestiary, roll initiative,
 * then step through turns and rounds, applying damage, healing and
 * conditions. A player character's hit points are their sheet's, so damage
 * here shows on the sheet.
 */
function Tracker({ encounter }: { encounter: Encounter }) {
  const pcs = useWorldRecords('pcs');
  const monsters = useWorldRecords('monsters');
  const navigate = useNavigate();
  const set = (changes: Partial<Encounter>) => updateRecord('encounters', encounter.id, changes);
  const order = initiativeOrder(encounter.combatants);
  const running = encounter.round > 0;
  const active = running ? order[encounter.turn % Math.max(1, order.length)] : undefined;
  const setCombatant = (id: string, changes: Partial<Combatant>) => set({ combatants: encounter.combatants.map((c) => (c.id === id ? { ...c, ...changes } : c)) });

  const addParty = () => {
    const present = new Set(encounter.combatants.map((c) => c.refId));
    const added = pcs.filter((pc) => !present.has(pc.id)).map((pc) => combatant({ kind: 'pc', refId: pc.id, name: pc.name || 'Character', initiative: null, ac: pc.ac, hp: pc.hp.current, maxHp: pc.hp.max, conditions: [] }));
    set({ combatants: [...encounter.combatants, ...added] });
  };
  const addMonster = (monster: Monster, count: number) => {
    const existing = encounter.combatants.filter((c) => c.refId === monster.id).length;
    const added = Array.from({ length: count }, (_, i) =>
      combatant({ kind: 'monster', refId: monster.id, name: `${monster.name || 'Creature'}${existing + count > 1 ? ` ${existing + i + 1}` : ''}`, initiative: null, ac: monster.ac, hp: monster.hp, maxHp: monster.hp, conditions: [] }),
    );
    set({ combatants: [...encounter.combatants, ...added] });
  };
  /** Rolls d20 + DEX (+ the sheet's bonus) for everyone without an initiative yet. */
  const rollInitiative = () => {
    set({
      combatants: encounter.combatants.map((c) => {
        if (c.initiative !== null) return c;
        const pc = pcs.find((p) => p.id === c.refId);
        const monster = monsters.find((m) => m.id === c.refId);
        const bonus = pc ? initiative(pc) : monster ? modifier(monster.abilities.dex) : 0;
        const result = rollAndShow(`d20${bonus ? signed(bonus) : ''}`, `${c.name} · Initiative`);
        return { ...c, initiative: result?.total ?? 10 };
      }),
    });
  };
  const step = (direction: 1 | -1) => {
    if (!order.length) return;
    let turn = encounter.turn + direction;
    let round = encounter.round;
    if (turn >= order.length) {
      turn = 0;
      round += 1;
    } else if (turn < 0) {
      if (round <= 1) return;
      turn = order.length - 1;
      round -= 1;
    }
    set({ turn, round });
  };
  const remove = () => {
    trash('encounters', encounter.id);
    void navigate({ to: '/encounters' });
    toast('Encounter Deleted', { description: encounter.name, action: { label: 'Undo', onClick: () => restore('encounters', encounter.id) } });
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      <TopBar crumbs={['Encounters', encounter.name]}>
        {running ? (
          <>
            <span className="font-mono text-xs">
              Round <b className="font-display text-lg font-black">{encounter.round}</b>
            </span>
            <Button variant="outline" size="sm" aria-label="Previous turn" onClick={() => step(-1)}>
              <ChevronLeftIcon />
            </Button>
            <Button size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={() => step(1)}>
              Next Turn <ChevronRightIcon />
            </Button>
            <Button variant="outline" size="sm" onClick={() => set({ round: 0, turn: 0 })}>
              <SquareIcon /> End
            </Button>
          </>
        ) : (
          <Button size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" disabled={!order.length} onClick={() => set({ round: 1, turn: 0 })}>
            <PlayIcon /> Start Combat
          </Button>
        )}
        <Hint label="Delete Encounter">
          <Button variant="outline" size="icon-sm" aria-label="Delete Encounter" className="rounded-full" onClick={remove}>
            <Trash2Icon />
          </Button>
        </Hint>
      </TopBar>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-4 px-7 pt-5 pb-10">
          <input aria-label="Encounter name" value={encounter.name} onChange={(e) => set({ name: e.target.value })} className="bg-transparent font-display text-[36px] leading-none font-black uppercase outline-none" />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={addParty} disabled={!pcs.length}>
              <UsersIcon /> Add The Party
            </Button>
            <AddMonster monsters={monsters} onAdd={addMonster} />
            <Button variant="outline" size="sm" onClick={() => set({ combatants: [...encounter.combatants, combatant({ kind: 'other', refId: null, name: 'Combatant', initiative: null, ac: 10, hp: 10, maxHp: 10, conditions: [] })] })}>
              <PlusIcon /> Add Other
            </Button>
            <span className="flex-1" />
            <Button variant="outline" size="sm" onClick={rollInitiative} disabled={!encounter.combatants.some((c) => c.initiative === null)}>
              <DicesIcon /> Roll Initiative
            </Button>
          </div>

          {order.length ? (
            <ol className="flex flex-col gap-2">
              {order.map((c) => (
                <CombatantRow
                  key={c.id}
                  combatant={c}
                  active={c.id === active?.id}
                  pc={c.kind === 'pc' ? pcs.find((p) => p.id === c.refId) : undefined}
                  onChange={(changes) => setCombatant(c.id, changes)}
                  onRemove={() => set({ combatants: encounter.combatants.filter((x) => x.id !== c.id), turn: 0 })}
                />
              ))}
            </ol>
          ) : (
            <Empty title="Nobody Here Yet">Add the party, creatures from the bestiary, or anyone else.</Empty>
          )}

          <section className="flex flex-col gap-2 rounded-2xl border px-5 py-4">
            <Label>Notes</Label>
            <Textarea aria-label="Encounter notes" rows={3} value={encounter.notes} placeholder="Terrain, tactics, what the creatures want, the treasure…" onChange={(e) => set({ notes: e.target.value })} className={cn(AREA, 'resize-y text-[13px] leading-relaxed')} />
          </section>
        </div>
      </div>
    </main>
  );
}

function AddMonster({ monsters, onAdd }: { monsters: Monster[]; onAdd: (monster: Monster, count: number) => void }) {
  const [count, setCount] = useState(1);
  if (!monsters.length) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link to="/bestiary">
          <SwordsIcon /> Make A Creature First
        </Link>
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <SelectField label="How many" variant="chip" value={count} onChange={setCount} options={[1, 2, 3, 4, 5, 6, 8, 10].map((n) => ({ value: n, label: `${n}×` }))} />
      <SelectField
        label="Add a creature"
        variant="chip"
        value={null as string | null}
        onChange={(id) => {
          const monster = monsters.find((m) => m.id === id);
          if (monster) onAdd(monster, count);
        }}
        options={[{ value: null, label: '+ Creature' }, ...monsters.map((m) => ({ value: m.id as string | null, label: `${m.name || 'Unnamed'} · CR ${m.cr}` }))]}
      />
    </span>
  );
}

function CombatantRow({ combatant: c, active, pc, onChange, onRemove }: { combatant: Combatant; active: boolean; pc: PlayerCharacter | undefined; onChange: (changes: Partial<Combatant>) => void; onRemove: () => void }) {
  const [amount, setAmount] = useState('');
  const hp = pc ? pc.hp : { max: c.maxHp, current: c.hp, temp: 0 };
  const conditions = pc ? pc.conditions : c.conditions;
  const value = Math.max(0, Number(amount) || 0);
  const down = hp.current === 0;

  const apply = (kind: 'damage' | 'heal') => {
    if (!value) return;
    const next = kind === 'damage' ? damage(hp, value) : heal(hp, value);
    // A player character's hit points live on their sheet.
    if (pc) updateRecord('pcs', pc.id, { hp: next });
    else onChange({ hp: next.current });
    setAmount('');
  };
  const setConditions = (list: string[]) => (pc ? updateRecord('pcs', pc.id, { conditions: list }) : onChange({ conditions: list }));

  return (
    <li className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3', active && 'border-primary bg-primary/5 shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_15%,transparent)]', down && 'opacity-60')}>
      <span className="flex w-14 flex-col items-center">
        <span className="label text-[9px]">Init</span>
        <input
          aria-label={`${c.name} initiative`}
          inputMode="numeric"
          value={c.initiative ?? ''}
          placeholder="—"
          onChange={(e) => onChange({ initiative: e.target.value === '' ? null : Number(e.target.value.replace(/[^\d-]/g, '')) || 0 })}
          className="w-12 bg-transparent text-center font-display text-[24px] font-black outline-none placeholder:text-muted-foreground/40"
        />
      </span>
      <span className="flex min-w-[180px] flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          {active && <Led tone="accent" />}
          {c.kind === 'pc' && pc ? (
            <Link to="/party/$pcId" params={{ pcId: pc.id }} className="truncate text-[15px] font-semibold hover:underline">
              {pc.name || c.name}
            </Link>
          ) : (
            <input aria-label="Name" value={c.name} onChange={(e) => onChange({ name: e.target.value })} className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none" />
          )}
          <span className="font-mono text-[10px] text-muted-foreground uppercase">{c.kind === 'pc' ? 'Player' : c.kind === 'monster' ? 'Creature' : ''}</span>
          {down && <span className="font-mono text-[10px] text-destructive uppercase">Down</span>}
        </span>
        <span className="flex flex-wrap items-center gap-1">
          {conditions.map((condition) => (
            <span key={condition} className="inline-flex h-6 items-center gap-1 rounded-full border border-primary/50 bg-primary/10 pr-1 pl-2 text-[11.5px]">
              {condition}
              <button type="button" aria-label={`Remove ${condition}`} onClick={() => setConditions(conditions.filter((x) => x !== condition))} className="rounded-full text-muted-foreground hover:text-foreground">
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
          <SelectField
            label="Add a condition"
            variant="chip"
            value={null as string | null}
            onChange={(condition) => condition && setConditions([...conditions, condition])}
            options={[{ value: null, label: '+ Condition' }, ...CONDITIONS.filter((x) => !conditions.includes(x)).map((x) => ({ value: x as string | null, label: x }))]}
            className="h-6 text-[10.5px]"
          />
        </span>
      </span>
      <span className="flex items-center gap-1.5 font-mono text-[12px]">
        <ShieldIcon className="size-4 text-muted-foreground" />
        <span className="text-[15px] font-semibold">{pc ? pc.ac : c.ac}</span>
      </span>
      <span className="flex w-[150px] flex-col gap-1">
        <span className="font-mono text-[12px] tabular-nums">
          <b className="text-[15px]">{hp.current}</b> / {hp.max}
          {hp.temp > 0 && <span className="text-link"> +{hp.temp}</span>}
        </span>
        <HpBar current={hp.current} max={hp.max} />
      </span>
      <span className="flex items-center gap-1">
        <input aria-label={`Damage or healing for ${c.name}`} inputMode="numeric" value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && apply('damage')} className="h-8 w-12 rounded-lg border bg-background px-2 font-mono text-[13px] outline-none focus:border-primary" />
        <Hint label="Damage (Enter)">
          <Button variant="outline" size="icon-sm" aria-label={`Damage ${c.name}`} className="text-destructive" disabled={!value} onClick={() => apply('damage')}>
            <SwordIcon />
          </Button>
        </Hint>
        <Hint label="Heal">
          <Button variant="outline" size="icon-sm" aria-label={`Heal ${c.name}`} disabled={!value} onClick={() => apply('heal')}>
            <HeartIcon />
          </Button>
        </Hint>
      </span>
      <Hint label="Remove from encounter">
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${c.name}`} onClick={onRemove}>
          <XIcon />
        </Button>
      </Hint>
    </li>
  );
}

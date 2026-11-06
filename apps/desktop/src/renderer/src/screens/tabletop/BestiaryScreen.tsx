import { Navigate, useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import { DicesIcon, LibraryBigIcon, PlusIcon, SkullIcon, SwordsIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { rollAndShow } from '@/components/tabletop/rolling';
import { confirmDelete, ShareButton, SharedMark, SharedSwitch, UpdatedDot, useShareMenus } from '@/components/tabletop/Sharing';
import { Empty } from '@/components/shared/bits';
import { AREA } from '@/components/shared/Field';
import { Hint } from '@/components/shared/Hint';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SidebarLink } from '@/components/shell/Sidebar';
import { Spaces } from '@/components/shell/Spaces';
import { useMonsterLayouts } from '@/components/shell/layouts';
import { openNew } from '@/components/dialogs/NewDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { combatant, createMonster, restore, trash, updateRecord } from '@/lib/actions';
import { ABILITY_NAME, modifier, signed } from '@/lib/tabletop';
import { useCharacter, useRole, useWorld, useWorldRecords } from '@/lib/hooks';
import { ABILITIES, type Monster } from '@/lib/model';
import { deleteShared, dropCopy, editShared, useVisibleMonsters } from '@/lib/shared';
import { cn } from '@/lib/utils';
import { Card, NumberInput, RollValue, SheetEditable } from './CharacterSheet';
import { Portrait, PortraitPicker } from '@/components/shared/Portrait';

/** The creatures you see (lib/shared useVisibleMonsters), by name. */
function useBestiary(): Monster[] {
  const monsters = useVisibleMonsters();
  return useMemo(() => [...monsters].sort((a, b) => a.name.localeCompare(b.name)), [monsters]);
}

/**
 * New Creature: the New popup (from the Library, or a blank stat block where
 * it belongs: the campaign's Bestiary for the GM, your character's own for a
 * player). Null if there's nowhere yet.
 */
function useNewCreature(): (() => void) | null {
  const world = useWorld();
  const player = useRole() === 'player';
  const pc = useCharacter();
  const navigate = useNavigate();
  const blank = player ? (pc ? () => createMonster(null, { characterId: pc.id }) : null) : world ? () => createMonster(world.id) : null;
  if (!blank) return null;
  return () => openNew('monster', () => void navigate({ to: '/bestiary/$monsterId', params: { monsterId: blank().id } }));
}

/**
 * Deletes a creature, asked first: the GM's (players lose the shared
 * version), a player's own, or a player's copy of one the GM deleted.
 */
function removeMonster(monster: Monster, characterId: string | undefined, after?: () => void) {
  const name = monster.name || 'Unnamed Creature';
  if (monster.via) {
    if (monster.via.ended && characterId) confirmDelete({ noun: 'Creature', name, area: 'tabletop:bestiary', extra: 'It’s your own version: the GM deleted theirs.', remove: () => dropCopy(monster.via!.shareId, characterId), after });
    return;
  }
  if (monster.characterId) confirmDelete({ noun: 'Creature', name, area: 'tabletop:bestiary', remove: () => { trash('monsters', monster.id); return () => restore('monsters', monster.id); }, after });
  else confirmDelete({ noun: 'Creature', name, area: 'tabletop:bestiary', sharedId: monster.id, remove: () => deleteShared('monsters', monster.id), after });
}

/** /bestiary: opens the first creature, or says how to start. */
export function BestiaryIndex() {
  const player = useRole() === 'player';
  const monsters = useBestiary();
  const create = useNewCreature();
  const navigate = useNavigate();
  if (monsters[0]) return <Navigate to="/bestiary/$monsterId" params={{ monsterId: monsters[0].id }} replace />;
  return (
    <>
      <BestiarySidebar />
      <main className="flex min-w-0 flex-1 items-center justify-center bg-background">
        <Empty
          title="No Creatures Yet"
          action={
            <span className="flex gap-2">
              {create && <Button onClick={create}>New Creature</Button>}
              <Button variant="outline" onClick={() => void navigate({ to: '/library/$kind', params: { kind: 'monsters' }, search: {} })}>
                <LibraryBigIcon /> Browse The Library
              </Button>
            </span>
          }
        >
          {player
            ? create
              ? 'Copy creatures from the Library, or write up the ones your character has met. Creatures the GM shares with you show up here too.'
              : 'Make a character first: your Bestiary is theirs.'
            : 'Write up the creatures the party will face, or copy them from the Library: their stat blocks live here, and you can share any of them with the players.'}
        </Empty>
      </main>
    </>
  );
}

/** /bestiary/$monsterId — a creature's stat block, edited in place (a shared one: as the player sees it). */
export function BestiaryScreen() {
  const { monsterId } = useParams({ from: '/bestiary/$monsterId' });
  const monster = useBestiary().find((m) => m.id === monsterId);
  if (!monster) return <Navigate to="/bestiary" replace />;
  return (
    <>
      <BestiarySidebar />
      <MonsterSheet key={monster.id} monster={monster} />
    </>
  );
}

/**
 * The GM's creatures (with their shared marks), or a player's own and those
 * the GM shared with them, in spaces and folders like the maps
 * (components/shell/Spaces): drag to arrange, right-click for more.
 */
function BestiarySidebar() {
  const monsters = useBestiary();
  const create = useNewCreature();
  const player = useRole() === 'player';
  const world = useWorld();
  const pc = useCharacter();
  const { campaign, own } = useMonsterLayouts();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const remove = (id: string) => {
    const m = monsters.find((x) => x.id === id);
    if (m) removeMonster(m, pc?.id, () => path === `/bestiary/${id}` && void navigate({ to: '/bestiary' }));
  };
  const byId = useMemo(() => new Map(monsters.map((m) => [m.id, m])), [monsters]);
  const sharing = useShareMenus('monsters', (id) => byId.get(id)?.name || 'Unnamed Creature');
  const link = (m: Monster) => (
    <SidebarLink
      key={m.id}
      to={`/bestiary/${m.id}`}
      icon={m.image ? undefined : SkullIcon}
      lead={
        <>
          {m.image && <Portrait image={m.image} name={m.name} className="size-5 rounded-md" />}
          <SharedMark status={sharing.status(m.id)} />
          <UpdatedDot via={m.via} />
        </>
      }
      label={m.name || 'Unnamed Creature'}
      meta={`CR ${m.cr}`}
    />
  );
  const nameOf = (m: Monster) => m.name || 'Unnamed Creature';
  return (
    <Sidebar title="Bestiary" addLabel="New Creature" onAdd={create ?? undefined}>
      {!player && world && (
        <Spaces scope={`${world.id}:monsters`} layout={campaign.layout} items={byId} render={link} nameOf={nameOf} editable={campaign.editable} noun="creature" onChange={campaign.save} itemMenu={sharing.itemMenu} groupMenu={sharing.groupMenu} onDelete={remove} />
      )}
      {own && pc && <Spaces scope={`${pc.id}:monsters`} layout={own.layout} items={byId} render={link} nameOf={nameOf} editable noun="creature" onChange={own.save} onDelete={remove} deletable={(id) => !byId.get(id)?.via || Boolean(byId.get(id)?.via?.ended)} />}
      <p className="px-2.5 text-xs text-muted-foreground">{player ? 'Creatures the GM shares are theirs: unlock one to keep notes of your own on it.' : 'Players have only the creatures you share, as you last sent them.'}</p>
    </Sidebar>
  );
}

/**
 * A creature's stat block. The GM's can be shared with players (Share); a
 * player sees a shared one as the GM sent it, read-only until they unlock it
 * to keep a version of their own (SharedSwitch).
 */
function MonsterSheet({ monster }: { monster: Monster }) {
  const navigate = useNavigate();
  const player = useRole() === 'player';
  const pc = useCharacter();
  const encounters = useWorldRecords('encounters');
  const via = monster.via;
  const locked = Boolean(via) && via?.showing !== 'edited';
  const set = (changes: Partial<Monster>) => {
    if (!via) updateRecord('monsters', monster.id, changes);
    else if (pc && !locked) editShared(via.shareId, pc.id, changes);
  };
  const remove = () => removeMonster(monster, pc?.id, () => void navigate({ to: '/bestiary' }));
  const addTo = (encounterId: string) => {
    const encounter = encounters.find((e) => e.id === encounterId);
    if (!encounter) return;
    const same = encounter.combatants.filter((c) => c.refId === monster.id).length;
    updateRecord('encounters', encounter.id, {
      combatants: [...encounter.combatants, combatant({ kind: 'monster', refId: monster.id, name: `${monster.name || 'Creature'}${same ? ` ${same + 1}` : ''}`, initiative: null, ac: monster.ac, hp: monster.hp, maxHp: monster.hp, conditions: [] })],
    });
    toast(`Added To ${encounter.name}`, { description: monster.name });
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      <TopBar crumbs={['Bestiary', monster.name || 'Unnamed Creature']}>
        {via && <SharedSwitch via={via} />}
        {!player && <ShareButton collection="monsters" id={monster.id} name={monster.name || 'Unnamed Creature'} />}
        {!player && encounters.length > 0 && (
          <SelectField
            label="Add to an encounter"
            variant="chip"
            value={null as string | null}
            onChange={(id) => id && addTo(id)}
            options={[{ value: null, label: '+ Add To Encounter' }, ...encounters.map((e) => ({ value: e.id as string | null, label: e.name }))]}
          />
        )}
        {!via && (
          <Hint label="Delete Creature">
            <Button variant="outline" size="icon-sm" aria-label="Delete Creature" className="rounded-full" onClick={remove}>
              <Trash2Icon />
            </Button>
          </Hint>
        )}
      </TopBar>
      <SheetEditable.Provider value={!locked}>
        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4 px-7 pt-6 pb-10">
          <section className="flex flex-col gap-3 rounded-2xl border border-t-4 border-t-primary px-6 py-5">
            <div className="flex items-center gap-4">
              <PortraitPicker image={monster.image} label={monster.name || 'this creature'} editable={!locked} onChange={(image) => set({ image })} className="block size-[84px] shrink-0 rounded-2xl">
                <Portrait image={monster.image} name={monster.name} className="size-full rounded-2xl" text="font-display text-[30px] font-black" />
              </PortraitPicker>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <input aria-label="Name" readOnly={locked} value={monster.name} placeholder="UNNAMED CREATURE" onChange={(e) => set({ name: e.target.value })} className="bg-transparent font-display text-[38px] leading-none font-black uppercase outline-none placeholder:text-muted-foreground/40" />
                <input aria-label="Size, type and alignment" readOnly={locked} value={monster.kind} placeholder="Medium undead, neutral evil" onChange={(e) => set({ kind: e.target.value })} className="bg-transparent text-[14px] text-muted-foreground italic outline-none" />
              </div>
            </div>
            <dl className="grid grid-cols-4 gap-3 border-t pt-3">
              <Field label="Armor Class">
                <NumberInput label="Armor class" value={monster.ac} onChange={(ac) => set({ ac })} className="w-14 font-display text-[26px] font-black" />
              </Field>
              <Field label="Hit Points">
                <span className="flex items-baseline gap-2">
                  <NumberInput label="Hit points" value={monster.hp} min={1} onChange={(hp) => set({ hp })} className="w-16 font-display text-[26px] font-black" />
                  <input aria-label="Hit dice" readOnly={locked} value={monster.hpDice} placeholder="4d8 + 4" onChange={(e) => set({ hpDice: e.target.value })} className="w-20 bg-transparent font-mono text-[12px] text-muted-foreground outline-none" />
                  {monster.hpDice && !locked && (
                    <Hint label="Roll hit points">
                      <button type="button" aria-label="Roll hit points" onClick={() => { const r = rollAndShow(monster.hpDice, `${monster.name} · Hit Points`); if (r) set({ hp: Math.max(1, r.total) }); }} className="text-muted-foreground hover:text-foreground">
                        <DicesIcon className="size-4" />
                      </button>
                    </Hint>
                  )}
                </span>
              </Field>
              <Field label="Speed">
                <input aria-label="Speed" readOnly={locked} value={monster.speed} placeholder="30 ft." onChange={(e) => set({ speed: e.target.value })} className="w-full bg-transparent text-[14px] outline-none" />
              </Field>
              <Field label="Challenge">
                <input aria-label="Challenge rating" readOnly={locked} value={monster.cr} placeholder="1/2" onChange={(e) => set({ cr: e.target.value })} className="w-full bg-transparent font-display text-[26px] font-black outline-none" />
              </Field>
            </dl>
            <div className="grid grid-cols-6 gap-2 border-t pt-3">
              {ABILITIES.map((ability) => (
                <div key={ability} className="flex flex-col items-center gap-0.5">
                  <span className="label text-[9.5px]">{ability.toUpperCase()}</span>
                  <NumberInput label={`${ABILITY_NAME[ability]} score`} value={monster.abilities[ability]} min={1} max={30} onChange={(score) => set({ abilities: { ...monster.abilities, [ability]: score } })} className="w-10 text-center font-mono text-[15px] font-semibold" />
                  <RollValue bonus={modifier(monster.abilities[ability])} label={`${monster.name || 'Creature'} · ${ABILITY_NAME[ability]}`} />
                </div>
              ))}
            </div>
          </section>

          <Card title="Traits">
            <Textarea aria-label="Traits" readOnly={locked} rows={4} value={monster.traits} placeholder="Senses, languages, resistances, and anything it does without trying…" onChange={(e) => set({ traits: e.target.value })} className={cn(AREA, 'resize-y text-[13.5px] leading-relaxed')} />
          </Card>

          <Card
            title="Actions"
            action={
              !locked && (
              <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => set({ actions: [...monster.actions, { name: '', text: '' }] })}>
                <PlusIcon /> Add Action
              </Button>
              )
            }
          >
            {monster.actions.length ? (
              <ul className="flex flex-col gap-2">
                {monster.actions.map((action, i) => (
                  <li key={i} className="group/row flex flex-col gap-1 border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
                    <span className="flex items-center gap-2">
                      <SwordsIcon className="size-3.5 text-muted-foreground" />
                      <input aria-label="Action name" readOnly={locked} value={action.name} placeholder="Claw" onChange={(e) => set({ actions: monster.actions.map((a, j) => (j === i ? { ...a, name: e.target.value } : a)) })} className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold outline-none" />
                      <button type="button" hidden={locked} aria-label={`Remove ${action.name || 'action'}`} onClick={() => set({ actions: monster.actions.filter((_, j) => j !== i) })} className="rounded text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:text-foreground focus-visible:opacity-100">
                        <XIcon className="size-3.5" />
                      </button>
                    </span>
                    <Textarea
                      aria-label={`${action.name || 'Action'} text`}
                      readOnly={locked}
                      rows={2}
                      value={action.text}
                      placeholder={`Melee attack: ${signed(4)} to hit, reach 5 ft. Hit: 2d4+2 slashing.`}
                      onChange={(e) => set({ actions: monster.actions.map((a, j) => (j === i ? { ...a, text: e.target.value } : a)) })}
                      className={cn(AREA, 'resize-y text-[13px] leading-relaxed')}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted-foreground">No actions yet.</p>
            )}
          </Card>
        </div>
        </div>
      </SheetEditable.Provider>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="label text-[9.5px]">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

import { Link, Navigate, useNavigate, useParams } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { ArchiveIcon, BackpackIcon, Trash2Icon, UsersIcon, DicesIcon, MoonIcon, PlusIcon, ScrollTextIcon, ShieldIcon, SparklesIcon, StickyNoteIcon, SwordsIcon, UserRoundPlusIcon, type LucideIcon } from 'lucide-react';
import { Empty } from '@/components/shared/bits';
import { ToolbarButton, ToolbarGroup } from '@/components/shared/Toolbar';
import { AREA } from '@/components/shared/Field';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { pickCharacter, updateRecord } from '@/lib/actions';
import { ABILITY_NAME, initiative, modifier, passive, proficiencyBonus, signed } from '@/lib/dnd';
import { useCharacter, useLive, useMyCharacters, useRole } from '@/lib/hooks';
import { ABILITIES, type PlayerCharacter } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useUi } from '@/stores/ui';
import {
  Attacks,
  Card,
  ConditionsCard,
  DeathSaves,
  HitPointsCard,
  InventoryPanel,
  NumberInput,
  LockButton,
  SheetEditable,
  ProficienciesCard,
  RollValue,
  SavesCard,
  SkillsCard,
  Spells,
  takeLongRest,
} from './CharacterSheet';
import { CharacterPlate } from './CharacterPlate';
import { archiveCharacter, CharactersDialog, deleteCharacter } from './Characters';
import { LevelUpDialog } from './LevelUp';
import { CombatActions, FeaturesPanel } from './SheetPanels';

export const SHEET_TABS: { tab: SheetTab; label: string; icon: LucideIcon }[] = [
  { tab: 'actions', label: 'Actions', icon: SwordsIcon },
  { tab: 'spells', label: 'Spells', icon: SparklesIcon },
  { tab: 'inventory', label: 'Inventory', icon: BackpackIcon },
  { tab: 'features', label: 'Features & Traits', icon: ScrollTextIcon },
  { tab: 'notes', label: 'Notes', icon: StickyNoteIcon },
];
export type SheetTab = 'actions' | 'spells' | 'inventory' | 'features' | 'notes';
const isTab = (tab: string): tab is SheetTab => SHEET_TABS.some((t) => t.tab === tab);

/** /sheet/$tab — the player's sheet on one of its tabs (Player view only). */
export function PlayerSheetScreen() {
  const { tab } = useParams({ from: '/sheet/$tab' });
  const role = useRole();
  if (role !== 'player' || !isTab(tab)) return <Navigate to="/" replace />;
  return <PlayerSheet tab={tab} />;
}

/**
 * PlayerSheet — Player view's home (/, on Actions): the character you play,
 * laid out like D&D Beyond's sheet. Across the top who they are, then the six
 * abilities and every turn's numbers beside hit points; down the left saves,
 * senses and training; the skills; and the big panel on the right, tabbed:
 * Actions (attacks, what anyone can do in combat, conditions), Spells,
 * Inventory (equipment, coins, weight, attunement), Features & Traits,
 * Notes. The character needn't be in a campaign (the sheet's Campaign chip
 * puts them in one); you can have several and switch between them here or
 * in the app menu.
 */
export function PlayerSheet({ tab }: { tab: SheetTab }) {
  const character = useCharacter();
  if (!character) return <PickCharacter />;
  return <Sheet key={character.id} pc={character} tab={tab} />;
}

function Sheet({ pc, tab }: { pc: PlayerCharacter; tab: SheetTab }) {
  const set = (changes: Partial<PlayerCharacter>) => updateRecord('pcs', pc.id, changes);
  const characters = useMyCharacters();
  const campaigns = useLive('worlds').filter((w) => w.section === 'dnd');
  const navigate = useNavigate();
  const [levelingUp, setLevelingUp] = useState(false);
  const [managing, setManaging] = useState(false);
  const unlocked = useUi((s) => s.sheetUnlocked);
  const diceOpen = useUi((s) => s.dice);

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      {/* The campaign and character are the chips; the breadcrumb says where on the sheet you are. */}
      <TopBar crumbs={['Character', SHEET_TABS.find((t) => t.tab === tab)?.label ?? 'Actions']}>
        <SelectField
          label="The campaign they're in"
          variant="chip"
          value={pc.worldId}
          onChange={(worldId) => set({ worldId })}
          options={[{ value: null as string | null, label: 'No Campaign' }, ...campaigns.map((w) => ({ value: w.id as string | null, label: w.name || 'Untitled Campaign' }))]}
        />
        <SelectField
          label="The character you play"
          variant="chip"
          value={pc.id}
          onChange={(id) => {
            if (id === NEW) void navigate({ to: '/create' });
            else if (id === MANAGE) setManaging(true);
            else if (id === ARCHIVE) archiveCharacter(pc);
            else if (id === DELETE) deleteCharacter(pc);
            else pickCharacter(id);
          }}
          options={[
            ...characters.map((p) => ({ value: p.id, label: p.name || 'Unnamed Character' })),
            { value: NEW, label: <MenuLabel icon={PlusIcon}>New Character</MenuLabel>, divider: true },
            { value: MANAGE, label: <MenuLabel icon={UsersIcon}>Manage Characters…</MenuLabel> },
            { value: ARCHIVE, label: <MenuLabel icon={ArchiveIcon}>Archive {pc.name || 'This Character'}</MenuLabel> },
            { value: DELETE, label: <MenuLabel icon={Trash2Icon} destructive>Delete {pc.name || 'This Character'}…</MenuLabel> },
          ]}
        />
        <ToolbarGroup label="Sheet">
          <LockButton />
          <ToolbarButton icon={MoonIcon} label="Long Rest" hint="Long rest: hit points, slots, uses and death saves back" onClick={() => takeLongRest(pc)} />
          <ToolbarButton icon={DicesIcon} label="Dice" hint="Dice (Ctrl+D)" pressed={diceOpen} onClick={() => useUi.getState().setDice(!diceOpen)} />
        </ToolbarGroup>
      </TopBar>

      <SheetEditable.Provider value={unlocked}>
      <div className="@container min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-7 pt-6 pb-10">
          {/* Who they are. */}
          <CharacterPlate pc={pc} set={set} onLevelUp={() => setLevelingUp(true)} />

          {/* The six abilities and every turn's numbers, beside hit points. */}
          {/* Narrower (the dice pinned beside it): hit points below the abilities, the tabs below the skills. */}
          <section className="grid grid-cols-1 gap-3 @6xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="@container/abilities grid grid-cols-4 gap-2 @3xl:grid-cols-8">
              {ABILITIES.map((ability) => (
                <div key={ability} className="flex flex-col items-center justify-between gap-1 rounded-2xl border px-1 py-2.5">
                  <span className="label max-w-full truncate text-[9px]" title={ABILITY_NAME[ability]}>
                    {/* Full names once each box has room for them (the row's own width, not the window's). */}
                    <span className="@5xl/abilities:hidden">{ABILITY_NAME[ability].slice(0, 3)}</span>
                    <span className="hidden @5xl/abilities:inline">{ABILITY_NAME[ability]}</span>
                  </span>
                  <RollValue bonus={modifier(pc.abilities[ability])} label={`${ABILITY_NAME[ability]} Check`} big />
                  <NumberInput
                    label={`${ABILITY_NAME[ability]} score`}
                    value={pc.abilities[ability]}
                    min={1}
                    max={30}
                    onChange={(score) => set({ abilities: { ...pc.abilities, [ability]: score } })}
                    className="w-11 rounded-full border bg-background text-center font-mono text-[12px]"
                  />
                </div>
              ))}
              <BonusBox label="Proficiency" value={signed(proficiencyBonus(pc.level))} />
              <div className="flex flex-col items-center justify-between gap-1 rounded-2xl border px-1 py-2.5">
                <span className="label text-[9px]">Speed</span>
                <NumberInput label="Speed" value={pc.speed} step={5} onChange={(speed) => set({ speed })} className="w-12 text-center font-display text-[30px] font-black" />
                <span className="font-mono text-[10.5px] text-muted-foreground">ft.</span>
              </div>
            </div>
            <HitPointsCard pc={pc} />
          </section>

          {pc.hp.current === 0 && <DeathSaves pc={pc} />}

          <div className="grid grid-cols-[250px_minmax(0,1fr)] items-start gap-4 @6xl:grid-cols-[250px_270px_minmax(0,1fr)]">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col items-center gap-1 rounded-2xl border py-2.5">
                  <span className="label text-[9px]">Initiative</span>
                  <RollValue bonus={initiative(pc)} label={`${pc.name || 'Character'} · Initiative`} big />
                </div>
                <div className="flex flex-col items-center gap-1 rounded-2xl border py-2.5">
                  <span className="label text-[9px]">Armor Class</span>
                  <NumberInput label="Armor class" value={pc.ac} onChange={(ac) => set({ ac })} className="w-12 text-center font-display text-[30px] font-black" />
                </div>
              </div>
              <SavesCard pc={pc} />
              <Card title="Senses">
                <ul className="flex flex-col">
                  {['Perception', 'Investigation', 'Insight'].map((skill) => (
                    <li key={skill} className="flex items-center gap-2.5 border-t border-border/60 py-1.5 first:border-t-0">
                      <span className="w-8 text-center font-display text-[20px] leading-none font-black">{passive(pc, skill)}</span>
                      <span className="text-[13px]">Passive {skill}</span>
                    </li>
                  ))}
                </ul>
              </Card>
              <ProficienciesCard pc={pc} />
            </div>

            <SkillsCard pc={pc} />

            <section className="col-span-2 flex min-w-0 flex-col gap-4 @6xl:col-span-1">
              <nav aria-label="Sheet" className="flex gap-1 border-b">
                {SHEET_TABS.map(({ tab: t, label, icon: Icon }) => (
                  <Link
                    key={t}
                    to="/sheet/$tab"
                    params={{ tab: t }}
                    aria-current={t === tab ? 'page' : undefined}
                    className={cn(
                      '-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 font-mono text-[11px] tracking-[0.1em] whitespace-nowrap text-muted-foreground uppercase hover:text-foreground',
                      t === tab && 'border-primary text-foreground',
                    )}
                  >
                    <Icon className="size-3.5" /> {label}
                  </Link>
                ))}
              </nav>
              {tab === 'actions' && (
                <>
                  <Attacks pc={pc} />
                  <CombatActions pc={pc} />
                  <ConditionsCard pc={pc} />
                </>
              )}
              {tab === 'spells' && <Spells pc={pc} />}
              {tab === 'inventory' && <InventoryPanel pc={pc} />}
              {tab === 'features' && <FeaturesPanel pc={pc} />}
              {tab === 'notes' && (
                <Card title="Notes">
                  <Textarea aria-label="Notes" rows={18} value={pc.notes} placeholder="Backstory, bonds, the debt they owe…" onChange={(e) => set({ notes: e.target.value })} className={cn(AREA, 'resize-y text-[13.5px] leading-relaxed')} />
                </Card>
              )}
            </section>
          </div>
        </div>
      </div>
      </SheetEditable.Provider>
      {levelingUp && <LevelUpDialog pc={pc} onClose={() => setLevelingUp(false)} />}
      {managing && <CharactersDialog onClose={() => setManaging(false)} />}
    </main>
  );
}

/** An action in the character chip's menu, with its icon (as in the app menu). */
function MenuLabel({ icon: Icon, destructive, children }: { icon: LucideIcon; destructive?: boolean; children: ReactNode }) {
  return (
    <span className={cn('flex items-center gap-2', destructive && 'text-destructive')}>
      <Icon className={cn('size-4', destructive ? 'text-destructive' : 'text-muted-foreground')} />
      {children}
    </span>
  );
}

function BonusBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-between gap-1 rounded-2xl border px-1 py-2.5">
      <span className="label text-[9px]">{label}</span>
      <span className="font-display text-[30px] leading-none font-black">{value}</span>
      <span className="font-mono text-[10.5px] text-muted-foreground">Bonus</span>
    </div>
  );
}

const NEW = '__new';
const MANAGE = '__manage';
const ARCHIVE = '__archive';
const DELETE = '__delete';

/**
 * No characters of your own yet: make one (no campaign needed: put them in
 * one later, from the sheet), or take over one from a campaign's party.
 */
function PickCharacter() {
  const navigate = useNavigate();
  const others = useLive('pcs').filter((pc) => !pc.mine);
  const campaigns = useLive('worlds');
  return (
    <main className="flex min-w-0 flex-1 items-center justify-center bg-background">
      <Empty
        title="Your First Character"
        action={
          <div className="flex max-w-lg flex-col items-center gap-4">
            <Button onClick={() => void navigate({ to: '/create' })}>
              <UserRoundPlusIcon /> Make A Character
            </Button>
            {others.length > 0 && (
              <div className="flex flex-col items-center gap-2">
                <span className="label text-[9.5px]">Or Play One From A Party</span>
                <div className="flex flex-wrap justify-center gap-2">
                  {others.map((pc) => (
                    <Button
                      key={pc.id}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        updateRecord('pcs', pc.id, { mine: true });
                        pickCharacter(pc.id);
                      }}
                    >
                      <ShieldIcon /> {pc.name || 'Unnamed Character'}
                      <span className="font-mono text-[10px] text-muted-foreground">{campaigns.find((w) => w.id === pc.worldId)?.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        }
      >
        A character sheet of your own. It needn’t be in a campaign: pick one for them on the sheet whenever they join a table.
      </Empty>
    </main>
  );
}

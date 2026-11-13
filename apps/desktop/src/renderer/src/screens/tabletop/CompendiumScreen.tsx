import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  BackpackIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleIcon,
  EyeIcon,
  EyeOffIcon,
  GemIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { RulesText } from '@/components/tabletop/RulesText';
import { Empty, Label } from '@/components/shared/bits';
import { AREA } from '@/components/shared/Field';
import { Hint } from '@/components/shared/Hint';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { openNew } from '@/components/dialogs/NewDialog';
import { SIDEBAR_ROW, SIDEBAR_ROW_ON, Sidebar, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { confirmDelete } from '@/components/tabletop/Sharing';
import { Textarea } from '@/components/ui/textarea';
import { updateRecord } from '@/lib/actions';
import {
  CLASSES,
  createEntry,
  editEntry,
  levelLabel,
  matches,
  nameRank,
  removeEntry,
  resetEntry,
  sameName,
  SCHOOLS,
  SRD_CREDIT,
  spellLine,
  unhideEntry,
  useItems,
  useSpells,
  type Listed,
} from '@/lib/compendium';
import { useCharacter } from '@/lib/hooks';
import { sourceName } from '@/lib/library';
import { ITEM_CATEGORIES, RARITIES, type Item, type ItemInfo, type PlayerCharacter, type SpellInfo } from '@/lib/model';
import { cn } from '@/lib/utils';
import { NumberInput } from './CharacterSheet';
import { HeaderPicture, pictureKey, RowPicture, usePictures } from '@/components/shared/Portrait';

/**
 * The compendium's two pages (Player view's Spells and Inventory): every spell
 * or item in the SRD and your own homebrew, not only your character's.
 *
 *   sidebar  what to show (everything, your character's, homebrew, edited, hidden), then filters
 *   list     search (every word must match the name or text; ↑↓ move, Enter adds), one row each
 *   detail   the whole entry: add it to your character (or change how many), edit it, hide or delete it
 *
 * Editing an SRD entry keeps your version (Reset brings the SRD's back);
 * hiding one takes it off the lists until Hidden → Show Again. The sheet's own
 * Spells and Inventory tabs are unchanged: they hold what the character has.
 */

type Show = 'all' | 'mine' | 'homebrew' | 'edited' | 'hidden';
type SpellSort = 'name' | 'level';

/** "Kael’s" (their first name), or "Your" for a character with no name yet. */
const whose = (name: string) => (name.trim() ? `${name.trim().split(' ')[0]}’s` : 'Your');
/** "Kael knows it", or "You know it". */
const knows = (name: string) => (name.trim() ? `${name.trim().split(' ')[0]} Knows It` : 'You Know It');

// ── Spells ──────────────────────────────────────────────────────────────

/** /spells?id=… — every spell. */
export function SpellsScreen() {
  const pictures = usePictures();
  const { id } = useSearch({ from: '/spells' });
  const navigate = useNavigate();
  const pc = useCharacter();
  const all = useSpells();
  const [show, setShow] = useState<Show>('all');
  const [query, setQuery] = useState('');
  const [levels, setLevels] = useState<number[]>([]);
  const [school, setSchool] = useState<string | null>(null);
  const [klass, setKlass] = useState<string | null>(null);
  const [book, setBook] = useState<string | null>(null);
  const [sort, setSort] = useState<SpellSort>('name');
  const [editing, setEditing] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

  const known = (spell: { name: string }) => Boolean(pc?.spells.some((s) => sameName(s.name, spell.name)));
  const inView = (s: Listed<SpellInfo>) =>
    show === 'hidden' ? s.hidden : !s.hidden && (show === 'all' || (show === 'mine' && known(s)) || (show === 'homebrew' && s.source === 'homebrew') || (show === 'edited' && s.source === 'edited'));
  const base = all.filter(inView);
  const list = base
    .filter((s) => !levels.length || levels.includes(s.level))
    .filter((s) => !school || s.school === school)
    .filter((s) => !klass || s.classes.includes(klass))
    .filter((s) => !book || (s.book ?? 'homebrew') === book)
    .filter((s) => matches(query, s.name, s.school, s.text, s.classes.join(' ')))
    .sort((a, b) => nameRank(query, a.name) - nameRank(query, b.name) || (sort === 'level' ? a.level - b.level : 0) || a.name.localeCompare(b.name));
  const selected = all.find((s) => s.id === id) ?? list[0];
  const select = (spellId: string) => void navigate({ to: '/spells', search: { id: spellId }, replace: true });
  const counts = {
    all: all.filter((s) => !s.hidden).length,
    mine: all.filter((s) => !s.hidden && known(s)).length,
    homebrew: all.filter((s) => s.source === 'homebrew').length,
    edited: all.filter((s) => s.source === 'edited' && !s.hidden).length,
    hidden: all.filter((s) => s.hidden).length,
  };
  const create = () => {
    const newId = createEntry('spells');
    setShow('all');
    setEditing(newId);
    setFresh(newId);
    select(newId);
  };
  // The character's spells that aren't in the compendium (typed on the sheet).
  const unlisted = show === 'mine' && pc ? pc.spells.filter((s) => s.name.trim() && !all.some((x) => sameName(x.name, s.name))) : [];

  return (
    <>
      <Sidebar title="Spells" addLabel="New Spell" onAdd={create} footer={<Credit />}>
        <ShowList
          show={show}
          onShow={setShow}
          rows={[
            { value: 'all', label: 'All Spells', icon: SparklesIcon, count: counts.all },
            ...(pc ? [{ value: 'mine' as Show, label: `${whose(pc.name)} Spells`, icon: CircleCheckIcon, count: counts.mine }] : []),
            { value: 'homebrew', label: 'Homebrew', icon: PencilIcon, count: counts.homebrew },
            { value: 'edited', label: 'Edited', icon: RotateCcwIcon, count: counts.edited },
            { value: 'hidden', label: 'Hidden', icon: EyeOffIcon, count: counts.hidden },
          ]}
        />
        <SidebarSection title="Level" action={levels.length > 0 && <ClearButton onClick={() => setLevels([])} />}>
          <div className="grid grid-cols-5 gap-1 px-1.5">
            {Array.from({ length: 10 }, (_, level) => (
              <Chip key={level} on={levels.includes(level)} onClick={() => setLevels(levels.includes(level) ? levels.filter((l) => l !== level) : [...levels, level])} className={level === 0 ? 'col-span-2' : ''}>
                {level === 0 ? 'Cantrip' : level}
              </Chip>
            ))}
          </div>
        </SidebarSection>
        <BookRows value={book} onChange={setBook} entries={base} />
        <FilterRows title="School" value={school} onChange={setSchool} options={SCHOOLS.map((s) => ({ value: s, count: base.filter((x) => x.school === s).length }))} />
        <FilterRows title="Class" value={klass} onChange={setKlass} options={CLASSES.map((c) => ({ value: c, count: base.filter((x) => x.classes.includes(c)).length }))} />
      </Sidebar>

      <main data-surface="page" className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Spells', selected?.name || 'Untitled Spell']}>
          <Button variant="outline" size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={create}>
            <PlusIcon /> New Spell
          </Button>
        </TopBar>
        <div className="flex min-h-0 flex-1">
          <ListColumn
            query={query}
            onQuery={setQuery}
            placeholder="Search spells: fire, healing, ritual…"
            count={list.length}
            sort={<SelectField label="Sort" variant="inline" align="end" value={sort} onChange={setSort} options={[{ value: 'name' as SpellSort, label: 'A–Z' }, { value: 'level' as SpellSort, label: 'By Level' }]} className="font-mono text-[11px] text-muted-foreground data-[size=default]:h-auto" />}
            ids={list.map((s) => s.id)}
            selected={selected?.id}
            onSelect={select}
            onEnter={() => selected && pc && !known(selected) && learn(pc, selected)}
          >
            {list.map((spell) => (
              <Row key={spell.id} id={spell.id} selected={spell.id === selected?.id} onSelect={select} lead={pc && <KnownToggle pc={pc} spell={spell} />} trail={<RowPicture image={pictures.get(pictureKey('spells', spell.id))} />}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[13.5px] font-medium">{spell.name || 'Untitled Spell'}</span>
                  {spell.concentration && <Badge title="Concentration">C</Badge>}
                  {spell.ritual && <Badge title="Ritual">R</Badge>}
                  {spell.source !== 'srd' && <Badge title={spell.source === 'homebrew' ? 'Homebrew' : 'Edited'}>{spell.source === 'homebrew' ? 'HB' : 'ED'}</Badge>}
                </span>
                <span className="truncate text-[11.5px] text-muted-foreground">
                  {levelLabel(spell.level)} · {spell.school} · {spell.castingTime}
                  {spell.book && spell.book !== 'srd-2014' && ` · ${sourceName(spell.book)}`}
                </span>
              </Row>
            ))}
            {unlisted.map((s) => (
              <Unlisted key={s.name} name={s.name} what="spell" onAdd={() => {
                const newId = createEntry('spells');
                editEntry('spells', { ...blankSpell, id: newId, source: 'homebrew', hidden: false, recordId: newId }, { name: s.name, level: s.level });
                setShow('all');
                setEditing(newId);
                setFresh(newId);
                select(newId);
              }} />
            ))}
            {!list.length && !unlisted.length && <NoMatch show={show} onReset={() => { setQuery(''); setLevels([]); setSchool(null); setKlass(null); setBook(null); setShow('all'); }} />}
          </ListColumn>
          <DetailColumn>
            {selected ? (
              editing === selected.id ? (
                <SpellEditor key={selected.id} spell={selected} fresh={fresh === selected.id} onDone={() => { setEditing(null); setFresh(null); }} />
              ) : (
                <SpellDetail key={selected.id} spell={selected} pc={pc} onEdit={() => setEditing(selected.id)} />
              )
            ) : (
              <Empty title="No Spell">Pick one from the list, or make your own with New Spell.</Empty>
            )}
          </DetailColumn>
        </div>
      </main>
    </>
  );
}

const blankSpell: SpellInfo = { name: '', level: 1, school: 'Evocation', castingTime: '', range: '', components: '', duration: '', concentration: false, ritual: false, classes: [], text: '', higher: '' };

function learn(pc: PlayerCharacter, spell: Listed<SpellInfo>) {
  updateRecord('pcs', pc.id, { spells: [...pc.spells, { name: spell.name, level: spell.level, prepared: spell.level === 0 }] });
  toast(`Added To ${whose(pc.name)} Spells`, { description: spell.name });
}

/** Takes a spell off the character's sheet, after a confirmation. */
function forget(pc: PlayerCharacter, spell: { name: string }) {
  const had = pc.spells;
  confirmDelete({
    noun: 'Spell',
    verb: 'Remove',
    name: spell.name,
    area: 'tabletop:party',
    extra: `It comes off ${whose(pc.name).toLowerCase() === 'your' ? 'your' : whose(pc.name)} spells.`,
    remove: () => {
      updateRecord('pcs', pc.id, { spells: had.filter((s) => !sameName(s.name, spell.name)) });
      return () => updateRecord('pcs', pc.id, { spells: had });
    },
  });
}

function KnownToggle({ pc, spell }: { pc: PlayerCharacter; spell: Listed<SpellInfo> }) {
  const known = pc.spells.some((s) => sameName(s.name, spell.name));
  return (
    <Hint label={known ? `${knows(pc.name)}: remove` : `Add to ${whose(pc.name)} spells`}>
      <button
        type="button"
        aria-label={known ? `Remove ${spell.name}` : `Add ${spell.name}`}
        aria-pressed={known}
        onClick={(e) => {
          e.stopPropagation();
          if (known) forget(pc, spell);
          else learn(pc, spell);
        }}
        className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border', known ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:border-foreground/40 hover:text-foreground')}
      >
        {known ? <CheckIcon className="size-3.5" strokeWidth={3} /> : <PlusIcon className="size-3.5" />}
      </button>
    </Hint>
  );
}

export function SpellDetail({ spell, pc, onEdit }: { spell: Listed<SpellInfo>; pc: PlayerCharacter | undefined; onEdit: () => void }) {
  const mine = pc?.spells.find((s) => sameName(s.name, spell.name));
  return (
    <article className="flex flex-col gap-5">
      <DetailHead name={spell.name || 'Untitled Spell'} line={spellLine(spell)} entry={spell} picture={pictureKey('spells', spell.id)} />
      <Actions kind="spells" entry={spell} onEdit={onEdit}>
        {pc &&
          (mine ? (
            <>
              <Button size="sm" variant="outline" onClick={() => forget(pc, spell)}>
                <CheckIcon /> {knows(pc.name)}
              </Button>
              {spell.level > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  aria-pressed={mine.prepared}
                  className={cn(mine.prepared && 'border-primary')}
                  onClick={() => updateRecord('pcs', pc.id, { spells: pc.spells.map((s) => (sameName(s.name, spell.name) ? { ...s, prepared: !s.prepared } : s)) })}
                >
                  {mine.prepared ? <CircleCheckIcon className="text-primary" /> : <CircleIcon />} {mine.prepared ? 'Prepared' : 'Not Prepared'}
                </Button>
              )}
            </>
          ) : (
            <Button size="sm" onClick={() => learn(pc, spell)}>
              <PlusIcon /> Add To {whose(pc.name)} Spells
            </Button>
          ))}
      </Actions>
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
        <Fact label="Casting Time">{spell.castingTime || '—'}</Fact>
        <Fact label="Range">{spell.range || '—'}</Fact>
        <Fact label="Components">{spell.components || '—'}</Fact>
        <Fact label="Duration">
          {spell.concentration && <span className="mr-1 rounded bg-primary/15 px-1 font-mono text-[10px] text-primary">CONC.</span>}
          {spell.duration || '—'}
        </Fact>
      </div>
      {spell.classes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Label className="mr-1">Classes</Label>
          {spell.classes.map((c) => (
            <span key={c} className="rounded-full border px-2.5 py-0.5 text-[12px]">
              {c}
            </span>
          ))}
        </div>
      )}
      {spell.text ? <RulesText text={spell.text} /> : <p className="text-[14px] text-muted-foreground">No description yet. Edit to write one.</p>}
      {spell.higher && (
        <section className="flex flex-col gap-1.5 rounded-xl border bg-muted/30 px-4 py-3">
          <Label>At Higher Levels</Label>
          <RulesText text={spell.higher} />
        </section>
      )}
    </article>
  );
}

function SpellEditor({ spell: entry, fresh, onDone }: { spell: Listed<SpellInfo>; fresh: boolean; onDone: () => void }) {
  // Edits wait in a draft: Save writes what changed, Cancel drops it (and a new entry with it).
  const [spell, setDraft] = useState(entry);
  const set = (changes: Partial<SpellInfo>) => setDraft((d) => ({ ...d, ...changes }));
  const save = () => {
    const changed = Object.fromEntries(Object.entries(spell).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify((entry as Record<string, unknown>)[key]))) as Partial<SpellInfo>;
    if (Object.keys(changed).length) editEntry('spells', entry, changed);
    onDone();
  };
  const cancel = () => {
    if (fresh) removeEntry('spells', entry as Listed<SpellInfo & ItemInfo>);
    onDone();
  };
  return (
    <article className="flex flex-col gap-4">
      <EditorHead name={spell.name} placeholder="UNTITLED SPELL" onName={(name) => set({ name })} onSave={save} onCancel={cancel} fresh={fresh} source={entry} />
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
        <EditField label="Level">
          <SelectField label="Level" variant="inline" value={spell.level} onChange={(level) => set({ level })} options={Array.from({ length: 10 }, (_, l) => ({ value: l, label: levelLabel(l) }))} className="data-[size=default]:h-auto" />
        </EditField>
        <EditField label="School">
          <SelectField label="School" variant="inline" value={spell.school} onChange={(school) => set({ school })} options={SCHOOLS.map((s) => ({ value: s, label: s }))} className="data-[size=default]:h-auto" />
        </EditField>
        <EditText label="Casting Time" value={spell.castingTime} placeholder="1 action" onChange={(castingTime) => set({ castingTime })} />
        <EditText label="Range" value={spell.range} placeholder="60 feet" onChange={(range) => set({ range })} />
        <EditText label="Components" value={spell.components} placeholder="V, S, M (a feather)" onChange={(components) => set({ components })} wide />
        <EditText label="Duration" value={spell.duration} placeholder="1 minute" onChange={(duration) => set({ duration })} wide />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip on={spell.concentration} onClick={() => set({ concentration: !spell.concentration })}>
          Concentration
        </Chip>
        <Chip on={spell.ritual} onClick={() => set({ ritual: !spell.ritual })}>
          Ritual
        </Chip>
        <span className="mx-1 w-px self-stretch bg-border" />
        {CLASSES.map((c) => (
          <Chip key={c} on={spell.classes.includes(c)} onClick={() => set({ classes: spell.classes.includes(c) ? spell.classes.filter((x) => x !== c) : [...spell.classes, c].sort() })}>
            {c}
          </Chip>
        ))}
      </div>
      <EditArea label="Description" value={spell.text} placeholder="What it does. ***Bold headings.*** and **bold** work, as do | tables |." onChange={(text) => set({ text })} rows={10} />
      <EditArea label="At Higher Levels" value={spell.higher} placeholder="When you cast this spell using a spell slot of 2nd level or higher…" onChange={(higher) => set({ higher })} rows={3} />
    </article>
  );
}

// ── Items ───────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = { Weapon: 'Weapons', Armor: 'Armor', Gear: 'Adventuring Gear', Tools: 'Tools', 'Mounts & Vehicles': 'Mounts & Vehicles', 'Magic Item': 'Magic Items' };

/** An item's kind within its category: "Martial Melee", "Light", "Potion", "Artisan's Tools". */
function subtype(item: ItemInfo): string {
  if (item.category === 'Weapon') return item.type.replace(/ Weapon$/, '');
  if (item.category === 'Armor') return item.type.replace(/ Armor$/, '');
  if (item.category === 'Magic Item') return item.type.split(/[,(]/)[0]!.trim().replace(/^./, (c) => c.toUpperCase());
  return item.type;
}

const PROPERTIES = ['Finesse', 'Light', 'Heavy', 'Two-Handed', 'Versatile', 'Thrown', 'Reach', 'Ammunition', 'Loading'];
const DAMAGE = ['Bludgeoning', 'Piercing', 'Slashing'];
const COIN_GP: Record<string, number> = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };
/** "15 gp" → 15, "5 sp" → 0.5; unpriced: null. */
const costInGold = (cost: string) => {
  const m = /([\d,.]+)\s*(cp|sp|ep|gp|pp)/i.exec(cost);
  return m ? Number(m[1]!.replace(/,/g, '')) * (COIN_GP[m[2]!.toLowerCase()] ?? 1) : null;
};
const COSTS: { label: string; test: (gp: number | null) => boolean }[] = [
  { label: 'Under 1 gp', test: (gp) => gp !== null && gp < 1 },
  { label: '1–10 gp', test: (gp) => gp !== null && gp >= 1 && gp <= 10 },
  { label: '10–100 gp', test: (gp) => gp !== null && gp > 10 && gp <= 100 },
  { label: 'Over 100 gp', test: (gp) => gp !== null && gp > 100 },
  { label: 'No Price', test: (gp) => gp === null },
];
const WEIGHTS: { label: string; test: (lb: number) => boolean }[] = [
  { label: 'Weightless', test: (lb) => lb === 0 },
  { label: 'Up To 2 lb', test: (lb) => lb > 0 && lb <= 2 },
  { label: 'Up To 10 lb', test: (lb) => lb > 2 && lb <= 10 },
  { label: 'Over 10 lb', test: (lb) => lb > 10 },
];
type ItemSort = 'name' | 'cost' | 'weight' | 'rarity';
const RARITY_ORDER = ['', 'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact', 'Varies'];

/** /items?id=… — every item. */
export function ItemsScreen() {
  const pictures = usePictures();
  const { id } = useSearch({ from: '/items' });
  const navigate = useNavigate();
  const pc = useCharacter();
  const all = useItems();
  const [show, setShow] = useState<Show>('all');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [book, setBook] = useState<string | null>(null);
  const [rarities, setRarities] = useState<string[]>([]);
  const [attunement, setAttunement] = useState(false);
  const [kind, setKind] = useState<string | null>(null);
  const [properties, setProperties] = useState<string[]>([]);
  const [damage, setDamage] = useState<string | null>(null);
  const [cost, setCost] = useState<string | null>(null);
  const [weight, setWeight] = useState<string | null>(null);
  const [sort, setSort] = useState<ItemSort>('name');
  const [editing, setEditing] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const pickCategory = (next: string | null) => {
    setCategory(next);
    setKind(null);
    setProperties([]);
    setDamage(null);
  };
  const clearAll = () => {
    setQuery('');
    pickCategory(null);
    setRarities([]);
    setAttunement(false);
    setCost(null);
    setWeight(null);
    setBook(null);
    setShow('all');
  };

  const carried = (item: { name: string }) => pc?.inventory.find((it) => sameName(it.name, item.name));
  const inView = (s: Listed<ItemInfo>) =>
    show === 'hidden' ? s.hidden : !s.hidden && (show === 'all' || (show === 'mine' && Boolean(carried(s))) || (show === 'homebrew' && s.source === 'homebrew') || (show === 'edited' && s.source === 'edited'));
  const base = all.filter(inView);
  const inCategory = base.filter((s) => (!category || s.category === category) && (!book || (s.book ?? 'homebrew') === book));
  const kinds = category ? [...new Set(inCategory.map(subtype))].sort() : [];
  const costTest = COSTS.find((c) => c.label === cost)?.test;
  const weightTest = WEIGHTS.find((w) => w.label === weight)?.test;
  const list = inCategory
    .filter((s) => !kind || subtype(s) === kind)
    .filter((s) => properties.every((p) => s.stats.includes(p)))
    .filter((s) => !damage || s.stats.toLowerCase().includes(damage.toLowerCase()))
    .filter((s) => !rarities.length || rarities.includes(s.rarity))
    .filter((s) => !attunement || s.attunement)
    .filter((s) => !costTest || costTest(costInGold(s.cost)))
    .filter((s) => !weightTest || weightTest(s.weight))
    .filter((s) => matches(query, s.name, s.type, s.stats, s.text))
    .sort(
      (a, b) =>
        nameRank(query, a.name) - nameRank(query, b.name) ||
        (sort === 'cost' ? (costInGold(a.cost) ?? Infinity) - (costInGold(b.cost) ?? Infinity) : 0) ||
        (sort === 'weight' ? a.weight - b.weight : 0) ||
        (sort === 'rarity' ? RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) : 0) ||
        a.name.localeCompare(b.name),
    );
  const selected = all.find((s) => s.id === id) ?? list[0];
  const select = (itemId: string) => void navigate({ to: '/items', search: { id: itemId }, replace: true });
  const counts = {
    all: all.filter((s) => !s.hidden).length,
    mine: all.filter((s) => !s.hidden && carried(s)).length,
    homebrew: all.filter((s) => s.source === 'homebrew').length,
    edited: all.filter((s) => s.source === 'edited' && !s.hidden).length,
    hidden: all.filter((s) => s.hidden).length,
  };
  const create = () => {
    const newId = createEntry('items');
    setShow('all');
    setEditing(newId);
    setFresh(newId);
    select(newId);
  };
  const unlisted = show === 'mine' && pc ? pc.inventory.filter((it) => it.name.trim() && !all.some((x) => sameName(x.name, it.name))) : [];

  const newItem = () =>
    openNew('item', create, (made) => {
      setShow('all');
      setEditing(made);
      setFresh(made);
      select(made);
    });

  return (
    <>
      <Sidebar title="Inventory" addLabel="New Item" onAdd={newItem} footer={<Credit />}>
        <ShowList
          show={show}
          onShow={setShow}
          rows={[
            { value: 'all', label: 'All Items', icon: GemIcon, count: counts.all },
            ...(pc ? [{ value: 'mine' as Show, label: `${whose(pc.name)} Pack`, icon: BackpackIcon, count: pc.inventory.length }] : []),
            { value: 'homebrew', label: 'Homebrew', icon: PencilIcon, count: counts.homebrew },
            { value: 'edited', label: 'Edited', icon: RotateCcwIcon, count: counts.edited },
            { value: 'hidden', label: 'Hidden', icon: EyeOffIcon, count: counts.hidden },
          ]}
        />
        <BookRows value={book} onChange={setBook} entries={base} />
        <FilterRows title="Category" value={category} onChange={pickCategory} options={ITEM_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c], count: base.filter((x) => x.category === c).length }))} />
        {kinds.length > 1 && <FilterRows title="Type" value={kind} onChange={setKind} options={kinds.map((k) => ({ value: k, count: inCategory.filter((x) => subtype(x) === k).length }))} />}
        {category === 'Weapon' && (
          <SidebarSection title="Properties" action={(properties.length > 0 || damage) && <ClearButton onClick={() => { setProperties([]); setDamage(null); }} />}>
            <div className="flex flex-wrap gap-1 px-1.5">
              {PROPERTIES.map((p) => (
                <Chip key={p} on={properties.includes(p)} onClick={() => setProperties(properties.includes(p) ? properties.filter((x) => x !== p) : [...properties, p])}>
                  {p}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 px-1.5 pt-1.5">
              {DAMAGE.map((d) => (
                <Chip key={d} on={damage === d} onClick={() => setDamage(damage === d ? null : d)}>
                  {d}
                </Chip>
              ))}
            </div>
          </SidebarSection>
        )}
        {(!category || category === 'Magic Item' || category === 'Weapon' || category === 'Armor') && (
          <SidebarSection title="Rarity" action={(rarities.length > 0 || attunement) && <ClearButton onClick={() => { setRarities([]); setAttunement(false); }} />}>
            <div className="flex flex-wrap gap-1 px-1.5">
              {RARITIES.map((r) => (
                <Chip key={r} on={rarities.includes(r)} onClick={() => setRarities(rarities.includes(r) ? rarities.filter((x) => x !== r) : [...rarities, r])}>
                  {r}
                </Chip>
              ))}
              <Chip on={attunement} onClick={() => setAttunement(!attunement)}>
                Needs Attunement
              </Chip>
            </div>
          </SidebarSection>
        )}
        <SidebarSection title="Cost" action={cost && <ClearButton onClick={() => setCost(null)} />}>
          <div className="flex flex-wrap gap-1 px-1.5">
            {COSTS.map((c) => (
              <Chip key={c.label} on={cost === c.label} onClick={() => setCost(cost === c.label ? null : c.label)}>
                {c.label}
              </Chip>
            ))}
          </div>
        </SidebarSection>
        <SidebarSection title="Weight" action={weight && <ClearButton onClick={() => setWeight(null)} />}>
          <div className="flex flex-wrap gap-1 px-1.5">
            {WEIGHTS.map((w) => (
              <Chip key={w.label} on={weight === w.label} onClick={() => setWeight(weight === w.label ? null : w.label)}>
                {w.label}
              </Chip>
            ))}
          </div>
        </SidebarSection>
      </Sidebar>

      <main data-surface="page" className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Inventory', selected?.name || 'Untitled Item']}>
          <Button variant="outline" size="sm" className="rounded-full font-mono text-xs tracking-[0.08em] uppercase" onClick={newItem}>
            <PlusIcon /> New Item
          </Button>
        </TopBar>
        <div className="flex min-h-0 flex-1">
          <ListColumn
            query={query}
            onQuery={setQuery}
            placeholder="Search items: rope, longsword, +1…"
            count={list.length}
            sort={
              <SelectField
                label="Sort"
                variant="inline"
                align="end"
                value={sort}
                onChange={setSort}
                options={[
                  { value: 'name' as ItemSort, label: 'A–Z' },
                  { value: 'cost' as ItemSort, label: 'By Cost' },
                  { value: 'weight' as ItemSort, label: 'By Weight' },
                  { value: 'rarity' as ItemSort, label: 'By Rarity' },
                ]}
                className="font-mono text-[11px] text-muted-foreground data-[size=default]:h-auto"
              />
            }
            ids={list.map((s) => s.id)}
            selected={selected?.id}
            onSelect={select}
            onEnter={() => selected && pc && carry(pc, selected, 1)}
          >
            {list.map((item) => {
              const have = carried(item);
              return (
                <ContextMenu key={item.id}>
                  <ContextMenuTrigger className="block">
                <Row id={item.id} selected={item.id === selected?.id} onSelect={select} lead={pc && <CarryButton pc={pc} item={item} qty={have?.qty ?? 0} />} trail={<RowPicture image={pictures.get(pictureKey('items', item.id))} />}>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[13.5px] font-medium">{item.name || 'Untitled Item'}</span>
                    {item.attunement && <Badge title="Requires attunement">A</Badge>}
                    {item.source !== 'srd' && <Badge title={item.source === 'homebrew' ? 'Homebrew' : 'Edited'}>{item.source === 'homebrew' ? 'HB' : 'ED'}</Badge>}
                  </span>
                  <span className="truncate text-[11.5px] text-muted-foreground">
                    {[item.rarity ? `${item.rarity} ${item.type.split(',')[0]}` : item.type, item.cost, item.weight ? `${item.weight} lb` : '', item.book && item.book !== 'srd-2014' ? sourceName(item.book) : ''].filter(Boolean).join(' · ')}
                  </span>
                </Row>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem disabled className="max-w-56 truncate font-medium opacity-100">
                      {item.name || 'Untitled Item'}
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    {item.source === 'homebrew' ? (
                      <ContextMenuItem variant="destructive" onSelect={() => confirmDelete({ noun: 'Item', name: item.name || 'Untitled Item', area: 'tabletop:homebrew', remove: () => removeEntry('items', item) })}>
                        <Trash2Icon /> Delete Item
                      </ContextMenuItem>
                    ) : (
                      !item.hidden && (
                        <ContextMenuItem
                          onSelect={() => {
                            const undo = removeEntry('items', item);
                            toast('Item Hidden', { description: `${item.name}: it’s the Library’s, so it’s hidden, not deleted. Show → Hidden brings it back.`, action: { label: 'Undo', onClick: undo } });
                          }}
                        >
                          <EyeOffIcon /> Hide Item
                        </ContextMenuItem>
                      )
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
            {unlisted.map((it) => (
              <Unlisted key={it.name} name={it.name} what="item" onAdd={() => {
                const newId = createEntry('items');
                editEntry('items', { ...blankItem, id: newId, source: 'homebrew', hidden: false, recordId: newId }, { name: it.name, weight: it.weight ?? 0, text: it.notes ?? '' });
                setShow('all');
                setEditing(newId);
                setFresh(newId);
                select(newId);
              }} />
            ))}
            {!list.length && !unlisted.length && <NoMatch show={show} onReset={clearAll} />}
          </ListColumn>
          <DetailColumn>
            {selected ? (
              editing === selected.id ? (
                <ItemEditor key={selected.id} item={selected} fresh={fresh === selected.id} onDone={() => { setEditing(null); setFresh(null); }} />
              ) : (
                <ItemDetail key={selected.id} item={selected} pc={pc} onEdit={() => setEditing(selected.id)} />
              )
            ) : (
              <Empty title="No Item">Pick one from the list, or make your own with New Item.</Empty>
            )}
          </DetailColumn>
        </div>
      </main>
    </>
  );
}

const blankItem: ItemInfo = { name: '', category: 'Gear', type: '', rarity: '', attunement: false, cost: '', weight: 0, stats: '', text: '' };

/** Adds (or takes away) some of an item in the character's pack; at 0 it's gone. */
function carry(pc: PlayerCharacter, item: Listed<ItemInfo>, by: number) {
  const have = pc.inventory.find((it) => sameName(it.name, item.name));
  let inventory: Item[];
  if (have) {
    const qty = have.qty + by;
    // The last one: taking it off the sheet asks first.
    if (qty <= 0) {
      const had = pc.inventory;
      confirmDelete({
        noun: 'Item',
        verb: 'Remove',
        name: item.name,
        area: 'tabletop:party',
        extra: 'It comes out of the inventory.',
        remove: () => {
          updateRecord('pcs', pc.id, { inventory: had.filter((it) => it !== have) });
          return () => updateRecord('pcs', pc.id, { inventory: had });
        },
      });
      return;
    }
    inventory = pc.inventory.map((it) => (it === have ? { ...it, qty } : it));
  } else if (by > 0) {
    inventory = [...pc.inventory, { name: item.name, qty: by, weight: item.weight || undefined }];
  } else return;
  const before = pc.inventory;
  updateRecord('pcs', pc.id, { inventory });
  if (!have) toast(`Added To ${whose(pc.name)} Pack`, { description: item.name, action: { label: 'Undo', onClick: () => updateRecord('pcs', pc.id, { inventory: before }) } });
}

function CarryButton({ pc, item, qty }: { pc: PlayerCharacter; item: Listed<ItemInfo>; qty: number }) {
  return (
    <Hint label={qty ? `${qty} in ${whose(pc.name)} pack: add one more` : `Add to ${whose(pc.name)} pack`}>
      <button
        type="button"
        aria-label={qty ? `Add another ${item.name}` : `Add ${item.name}`}
        onClick={(e) => {
          e.stopPropagation();
          carry(pc, item, 1);
        }}
        className={cn('flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full border px-1 font-mono text-[11px]', qty ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:border-foreground/40 hover:text-foreground')}
      >
        {qty ? `×${qty}` : <PlusIcon className="size-3.5" />}
      </button>
    </Hint>
  );
}

export function ItemDetail({ item, pc, onEdit }: { item: Listed<ItemInfo>; pc: PlayerCharacter | undefined; onEdit: () => void }) {
  const have = pc?.inventory.find((it) => sameName(it.name, item.name));
  const change = (changes: Partial<Item>) => pc && have && updateRecord('pcs', pc.id, { inventory: pc.inventory.map((it) => (it === have ? { ...it, ...changes } : it)) });
  const line = [item.type, item.attunement && !/attunement/i.test(item.stats) ? 'requires attunement' : ''].filter(Boolean).join(' · ');
  return (
    <article className="flex flex-col gap-5">
      <DetailHead name={item.name || 'Untitled Item'} line={line} entry={item} picture={pictureKey('items', item.id)} />
      <Actions kind="items" entry={item} onEdit={onEdit}>
        {pc &&
          (have ? (
            <span className="flex items-center gap-1 rounded-lg border px-1 py-0.5">
              <Button size="icon-xs" variant="ghost" aria-label="One fewer" onClick={() => carry(pc, item, -1)}>
                <MinusIcon />
              </Button>
              <span className="flex items-center gap-1 px-1 text-[13px]">
                <BackpackIcon className="size-3.5 text-muted-foreground" />
                <NumberInput label="How many" value={have.qty} min={1} max={9999} onChange={(qty) => change({ qty })} className="w-9 text-center font-mono text-[13px]" />
              </span>
              <Button size="icon-xs" variant="ghost" aria-label="One more" onClick={() => carry(pc, item, 1)}>
                <PlusIcon />
              </Button>
            </span>
          ) : (
            <Button size="sm" onClick={() => carry(pc, item, 1)}>
              <BackpackIcon /> Add To {whose(pc.name)} Pack
            </Button>
          ))}
        {pc && have && (
          <Button size="sm" variant="outline" aria-pressed={Boolean(have.equipped)} className={cn(have.equipped && 'border-primary')} onClick={() => change({ equipped: !have.equipped })}>
            {have.equipped ? <ShieldCheckIcon className="text-primary" /> : <CircleIcon />} {have.equipped ? 'Equipped' : 'In The Pack'}
          </Button>
        )}
        {pc && have && item.attunement && (
          <Button size="sm" variant="outline" aria-pressed={Boolean(have.attuned)} className={cn(have.attuned && 'border-primary')} onClick={() => change({ attuned: !have.attuned })}>
            <GemIcon className={cn(have.attuned && 'text-primary')} /> {have.attuned ? 'Attuned' : 'Attune'}
          </Button>
        )}
      </Actions>
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
        <Fact label="Category">{CATEGORY_LABEL[item.category] ?? item.category}</Fact>
        <Fact label={item.rarity ? 'Rarity' : 'Cost'}>{item.rarity || item.cost || '—'}</Fact>
        <Fact label="Weight">{item.weight ? `${item.weight} lb` : '—'}</Fact>
        <Fact label="Attunement">{item.attunement ? 'Required' : 'No'}</Fact>
      </div>
      {item.stats && (
        <div className="rounded-xl border bg-muted/30 px-4 py-3">
          <Label>{item.category === 'Weapon' ? 'Damage & Properties' : item.category === 'Armor' ? 'Armor Class' : 'Details'}</Label>
          <p className="mt-1 font-mono text-[13.5px]">{item.stats}</p>
        </div>
      )}
      {item.text ? <RulesText text={item.text} /> : <p className="text-[14px] text-muted-foreground">No description. Edit to write one.</p>}
    </article>
  );
}

function ItemEditor({ item: entry, fresh, onDone }: { item: Listed<ItemInfo>; fresh: boolean; onDone: () => void }) {
  // Edits wait in a draft: Save writes what changed, Cancel drops it (and a new entry with it).
  const [item, setDraft] = useState(entry);
  const set = (changes: Partial<ItemInfo>) => setDraft((d) => ({ ...d, ...changes }));
  const save = () => {
    const changed = Object.fromEntries(Object.entries(item).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify((entry as Record<string, unknown>)[key]))) as Partial<ItemInfo>;
    if (Object.keys(changed).length) editEntry('items', entry, changed);
    onDone();
  };
  const cancel = () => {
    if (fresh) removeEntry('items', entry as Listed<SpellInfo & ItemInfo>);
    onDone();
  };
  return (
    <article className="flex flex-col gap-4">
      <EditorHead name={item.name} placeholder="UNTITLED ITEM" onName={(name) => set({ name })} onSave={save} onCancel={cancel} fresh={fresh} source={entry} />
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
        <EditField label="Category">
          <SelectField label="Category" variant="inline" value={item.category} onChange={(category) => set({ category })} options={ITEM_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} className="data-[size=default]:h-auto" />
        </EditField>
        <EditField label="Rarity">
          <SelectField label="Rarity" variant="inline" value={item.rarity} onChange={(rarity) => set({ rarity })} options={[{ value: '', label: 'Mundane' }, ...RARITIES.map((r) => ({ value: r as string, label: r }))]} className="data-[size=default]:h-auto" />
        </EditField>
        <EditText label="Cost" value={item.cost} placeholder="15 gp" onChange={(cost) => set({ cost })} />
        <EditField label="Weight (lb)">
          <NumberInput label="Weight" value={item.weight} max={9999} onChange={(weight) => set({ weight })} className="w-full text-[13.5px]" />
        </EditField>
        <EditText label="Type" value={item.type} placeholder="Wondrous item, rare" onChange={(type) => set({ type })} wide />
        <EditText label={item.category === 'Weapon' ? 'Damage & Properties' : item.category === 'Armor' ? 'Armor Class' : 'Stats'} value={item.stats} placeholder={item.category === 'Armor' ? 'AC 14 + Dex (max 2)' : '1d8 slashing · Versatile (1d10)'} onChange={(stats) => set({ stats })} wide />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip on={item.attunement} onClick={() => set({ attunement: !item.attunement })}>
          Requires Attunement
        </Chip>
      </div>
      <EditArea label="Description" value={item.text} placeholder="What it is and what it does." onChange={(text) => set({ text })} rows={12} />
    </article>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────

function ShowList({ show, onShow, rows }: { show: Show; onShow: (show: Show) => void; rows: { value: Show; label: string; icon: LucideIcon; count: number }[] }) {
  return (
    <SidebarSection title="Show">
      {rows.map(({ value, label, icon: Icon, count }) => (
        <button key={value} type="button" aria-pressed={show === value} onClick={() => onShow(value)} className={cn(SIDEBAR_ROW, show === value && SIDEBAR_ROW_ON)}>
          <Icon className="size-4 shrink-0" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{count}</span>
        </button>
      ))}
    </SidebarSection>
  );
}

/** Rows to filter by one value (click again to clear). */
export function FilterRows({ title, value, onChange, options }: { title: string; value: string | null; onChange: (value: string | null) => void; options: { value: string; label?: string; count: number }[] }) {
  return (
    <SidebarSection title={title} action={value && <ClearButton onClick={() => onChange(null)} />}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(value === option.value ? null : option.value)}
          className={cn(SIDEBAR_ROW, 'min-h-[28px] text-[13px]', value === option.value && SIDEBAR_ROW_ON, !option.count && 'opacity-45')}
        >
          <span className="min-w-0 flex-1 truncate">{option.label ?? option.value}</span>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{option.count}</span>
        </button>
      ))}
    </SidebarSection>
  );
}

function ClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase hover:text-foreground">
      Clear
    </button>
  );
}

export function Chip({ on, onClick, className, children }: { on: boolean; onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn('h-7 rounded-full border bg-background px-2.5 text-[12px] text-muted-foreground hover:text-foreground', on && 'border-primary bg-primary/12 font-medium text-foreground', className)}
    >
      {children}
    </button>
  );
}

export function Badge({ title, children }: { title: string; children: ReactNode }) {
  return (
    <span title={title} className="shrink-0 rounded border px-1 font-mono text-[9.5px] leading-[15px] text-muted-foreground">
      {children}
    </span>
  );
}

/** The middle column: search, a count, and the rows. ↑↓ in the search move through them; Enter adds the selected one. */
export function ListColumn({
  query,
  onQuery,
  placeholder,
  count,
  sort,
  ids,
  selected,
  onSelect,
  onEnter,
  children,
}: {
  query: string;
  onQuery: (query: string) => void;
  placeholder: string;
  count: number;
  sort?: ReactNode;
  ids: string[];
  selected: string | undefined;
  onSelect: (id: string) => void;
  onEnter: () => void;
  children: ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selected) return;
    scroller.current?.querySelector(`[data-row="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);
  const move = (by: number) => {
    const at = selected ? ids.indexOf(selected) : -1;
    const next = ids[Math.max(0, Math.min(ids.length - 1, at + by))];
    if (next) onSelect(next);
  };
  return (
    <section className="flex w-[400px] shrink-0 flex-col border-r xl:w-[440px]">
      <div className="flex flex-col gap-2 border-b px-4 py-3">
        <div className="flex h-9 items-center gap-2 rounded-lg border bg-background px-2.5 focus-within:border-primary">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            aria-label="Search"
            autoFocus
            value={query}
            placeholder={placeholder}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                move(e.key === 'ArrowDown' ? 1 : -1);
              } else if (e.key === 'Enter') onEnter();
              else if (e.key === 'Escape') onQuery('');
            }}
            className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => onQuery('')} className="text-muted-foreground hover:text-foreground">
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10.5px] tracking-[0.08em] text-muted-foreground uppercase">{count} Shown</span>
          {sort}
        </div>
      </div>
      <div ref={scroller} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
        {children}
      </div>
    </section>
  );
}

export function Row({ id, selected, onSelect, lead, trail, children }: { id: string; selected: boolean; onSelect: (id: string) => void; lead?: ReactNode; trail?: ReactNode; children: ReactNode }) {
  return (
    <div
      role="option"
      aria-selected={selected}
      data-row={id}
      tabIndex={-1}
      onClick={() => onSelect(id)}
      className={cn('flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-muted/60', selected && 'bg-muted')}
    >
      {lead}
      <span className="flex min-w-0 flex-1 flex-col">{children}</span>
      {trail}
    </div>
  );
}

function Unlisted({ name, what, onAdd }: { name: string; what: string; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed text-muted-foreground">?</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13.5px] font-medium">{name}</span>
        <span className="text-[11.5px] text-muted-foreground">On the sheet, not in the compendium</span>
      </span>
      <Button size="xs" variant="outline" onClick={onAdd}>
        Write Up This {what === 'spell' ? 'Spell' : 'Item'}
      </Button>
    </div>
  );
}

function NoMatch({ show, onReset }: { show: Show; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[13px] text-muted-foreground">
      {show === 'hidden' ? 'Nothing hidden.' : show === 'homebrew' ? 'No homebrew yet: make one with the + button.' : show === 'edited' ? 'You haven’t edited any SRD entries.' : 'Nothing matches.'}
      <Button size="xs" variant="ghost" onClick={onReset}>
        Clear Filters
      </Button>
    </div>
  );
}

export function DetailColumn({ children }: { children: ReactNode }) {
  return (
    <div className="@container min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[760px] px-8 pt-7 pb-16">{children}</div>
    </div>
  );
}

/** Where an entry is from: its book ("Deep Magic"), edited if you changed it, or Homebrew. */
const fromLabel = (entry: { source: Listed<unknown>['source']; book?: string }, editing = false) =>
  entry.source === 'homebrew' ? 'Homebrew' : `${sourceName(entry.book ?? 'srd-2014')}${entry.source === 'edited' || editing ? ' · Edited' : ''}`;

/** Filters by the book an entry comes from (the SRD, Kobold Press, Level Up…, Homebrew). */
function BookRows({ value, onChange, entries }: { value: string | null; onChange: (value: string | null) => void; entries: { book?: string }[] }) {
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.book ?? 'homebrew', (counts.get(e.book ?? 'homebrew') ?? 0) + 1);
  if (counts.size < 2) return null;
  const books = [...counts.keys()].sort((a, b) => (a === 'srd-2014' ? -1 : b === 'srd-2014' ? 1 : a === 'homebrew' ? 1 : b === 'homebrew' ? -1 : sourceName(a).localeCompare(sourceName(b))));
  return <FilterRows title="Book" value={value} onChange={onChange} options={books.map((b) => ({ value: b, label: b === 'homebrew' ? 'Homebrew' : sourceName(b), count: counts.get(b)! }))} />;
}

function DetailHead({ name, line, entry, picture }: { name: string; line: string; entry: { source: Listed<unknown>['source']; book?: string }; picture: string }) {
  const image = usePictures().get(picture);
  return (
    <header className="flex items-start gap-5 border-b pb-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="font-mono text-[11px] tracking-[0.1em] text-link uppercase">{fromLabel(entry)}</span>
        <h1 className="font-display text-[38px] leading-[1.05] font-black break-words uppercase">{name}</h1>
        {line && <p className="text-[14.5px] text-muted-foreground italic first-letter:uppercase">{line}</p>}
      </div>
      <HeaderPicture id={picture} image={image} label={name} />
    </header>
  );
}

/** Add-to-character buttons (children), then Edit, Hide / Delete, Reset and Show Again. */
function Actions({ kind, entry, onEdit, children }: { kind: 'spells' | 'items'; entry: Listed<SpellInfo> | Listed<ItemInfo>; onEdit: () => void; children?: ReactNode }) {
  const navigate = useNavigate();
  const noun = kind === 'spells' ? 'Spell' : 'Item';
  const remove = () => {
    const leave = () => void navigate({ to: kind === 'spells' ? '/spells' : '/items', search: {}, replace: true });
    // Homebrew is deleted (asked first); the Library's is only hidden.
    if (entry.source === 'homebrew') {
      confirmDelete({ noun, name: entry.name || `Untitled ${noun}`, area: 'tabletop:homebrew', remove: () => removeEntry(kind, entry as Listed<SpellInfo & ItemInfo>), after: leave });
      return;
    }
    const undo = removeEntry(kind, entry as Listed<SpellInfo & ItemInfo>);
    leave();
    toast(`${noun} Hidden`, { description: `${entry.name}: Show → Hidden brings it back.`, action: { label: 'Undo', onClick: undo } });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!entry.hidden && children}
      <span className="flex-1" />
      {entry.hidden ? (
        <Button size="sm" variant="outline" onClick={() => unhideEntry(kind, entry.id)}>
          <EyeIcon /> Show Again
        </Button>
      ) : (
        <>
          <Button size="sm" variant="outline" onClick={onEdit}>
            <PencilIcon /> Edit
          </Button>
          {entry.source === 'edited' && (
            <Hint label="Drop your changes and use the SRD's text again">
              <Button size="sm" variant="ghost" onClick={() => resetEntry(kind, entry)}>
                <RotateCcwIcon /> Reset
              </Button>
            </Hint>
          )}
          <Hint label={entry.source === 'homebrew' ? `Delete ${noun}` : `Hide ${noun} (it's the SRD's: Hidden brings it back)`}>
            <Button size="icon-sm" variant="ghost" aria-label={entry.source === 'homebrew' ? `Delete ${noun}` : `Hide ${noun}`} onClick={remove} className="text-muted-foreground hover:text-destructive">
              {entry.source === 'homebrew' ? <Trash2Icon /> : <EyeOffIcon />}
            </Button>
          </Hint>
        </>
      )}
    </div>
  );
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border px-3 py-2">
      <span className="label text-[9.5px]">{label}</span>
      <span className="text-[13.5px] leading-snug">{children}</span>
    </div>
  );
}

function EditorHead({ name, placeholder, onName, onSave, onCancel, fresh, source }: { name: string; placeholder: string; onName: (name: string) => void; onSave: () => void; onCancel: () => void; fresh: boolean; source: { source: Listed<unknown>['source']; book?: string } }) {
  return (
    <header className="flex flex-col gap-1.5 border-b pb-4">
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] tracking-[0.1em] text-link uppercase">Editing · {fromLabel(source, true)}</span>
        <span className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {fresh ? 'Discard' : 'Cancel'}
          </Button>
          <Button size="sm" onClick={onSave}>
            <CheckIcon /> Save
          </Button>
        </span>
      </span>
      <input
        aria-label="Name"
        autoFocus={!name}
        value={name}
        placeholder={placeholder}
        onChange={(e) => onName(e.target.value)}
        className="w-full bg-transparent font-display text-[38px] leading-[1.05] font-black uppercase outline-none placeholder:text-muted-foreground/40"
      />
    </header>
  );
}

function EditField({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={cn('flex flex-col gap-0.5 rounded-xl border px-3 py-2 text-[13.5px] focus-within:border-primary', wide && 'col-span-2')}>
      <span className="label text-[9.5px]">{label}</span>
      {children}
    </label>
  );
}

function EditText({ label, value, placeholder, onChange, wide }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; wide?: boolean }) {
  return (
    <EditField label={label} wide={wide}>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground/60" />
    </EditField>
  );
}

function EditArea({ label, value, placeholder, onChange, rows }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; rows: number }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      <Textarea rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cn(AREA, 'resize-y text-[14px] leading-relaxed')} />
    </label>
  );
}

/** The SRD's credit (CC-BY-4.0 asks for it wherever its text is shown). */
export function Credit() {
  return (
    <Hint label={SRD_CREDIT}>
      <p className="px-2.5 text-[10.5px] leading-snug text-muted-foreground">SRD text by Wizards of the Coast (CC-BY-4.0); other books as credited in Library → Sources.</p>
    </Hint>
  );
}

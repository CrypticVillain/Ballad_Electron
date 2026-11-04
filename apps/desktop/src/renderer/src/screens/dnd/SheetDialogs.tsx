import { SearchIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { RulesText } from '@/components/dnd/RulesText';
import { AREA } from '@/components/shared/Field';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { updateRecord } from '@/lib/actions';
import { levelLabel, matches, nameRank, sameName, spellLine, useItems, useSpells } from '@/lib/compendium';
import { ALL_FEATURES, classOf, toFeature } from '@/lib/compendium/classes';
import { modifier, proficiencyBonus, signed } from '@/lib/dnd';
import { newId, type Feature, type Item, type PlayerCharacter } from '@/lib/model';
import { cn } from '@/lib/utils';

/**
 * The sheet's add and edit dialogs for items, spells, features and attacks.
 * Adding opens on Find: search the library (the SRD's and your homebrew) and
 * pick one to fill in the details, or go to Custom and type it all. Editing
 * opens on the details. Nothing changes on the sheet until Save.
 */

type Row = { id: string; name: string; meta: string; text: string };

function SheetDialog({
  title,
  adding,
  rows,
  onPick,
  filters,
  preview,
  children,
  saveLabel,
  canSave,
  onSave,
  onClose,
}: {
  title: string;
  adding: boolean;
  /** The library's entries for a search. */
  rows: (query: string) => Row[];
  onPick: (id: string) => void;
  filters?: ReactNode;
  /** The library's text for what's being edited, beside the form. */
  preview?: string;
  children: ReactNode;
  saveLabel: string;
  canSave: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'find' | 'details'>(adding ? 'find' : 'details');
  const [query, setQuery] = useState('');
  const [hover, setHover] = useState<Row | null>(null);
  const list = useMemo(() => rows(query).slice(0, 250), [rows, query]);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[min(82vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[860px]">
        <header className="flex flex-col gap-3 border-b px-6 pt-5 pb-3">
          <DialogTitle className="font-display text-[26px] leading-none font-black uppercase">{title}</DialogTitle>
          <DialogDescription className="sr-only">{adding ? 'Pick one from the library or make your own.' : 'Change the details, or pick another from the library, then save.'}</DialogDescription>
          {/* Adding opens on Find; editing on the details, with Find a click away to swap it for another. */}
          <div role="tablist" className="flex w-fit rounded-lg border p-0.5">
            {(
              (adding
                ? [
                    ['find', 'Find In The Library'],
                    ['details', 'Custom'],
                  ]
                : [
                    ['details', 'Custom'],
                    ['find', 'Swap From The Library'],
                  ]) as ['find' | 'details', string][]
            ).map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={cn('rounded-md px-3 py-1 text-[13px] text-muted-foreground', tab === value && 'bg-muted font-medium text-foreground')}>
                {label}
              </button>
            ))}
          </div>
        </header>

        {tab === 'find' ? (
          <div className="flex min-h-0 flex-1">
            <div className="flex w-[380px] shrink-0 flex-col border-r">
              <div className="flex flex-col gap-2 border-b px-4 py-3">
                <div className="flex h-9 items-center gap-2 rounded-lg border px-2.5 focus-within:border-primary">
                  <SearchIcon className="size-4 text-muted-foreground" />
                  <input autoFocus aria-label="Search the library" value={query} placeholder="Search" onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none" />
                </div>
                {filters}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
                {list.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onMouseEnter={() => setHover(row)}
                    onFocus={() => setHover(row)}
                    onClick={() => {
                      onPick(row.id);
                      setTab('details');
                    }}
                    className="flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <span className="truncate text-[13.5px] font-medium">{row.name}</span>
                    <span className="truncate text-[11.5px] text-muted-foreground">{row.meta}</span>
                  </button>
                ))}
                {!list.length && <p className="px-2.5 py-6 text-center text-[13px] text-muted-foreground">Nothing matches. Try Custom to make your own.</p>}
              </div>
            </div>
            <div className="min-w-0 flex-1 overflow-y-auto px-6 py-4">
              {hover ? (
                <div className="flex flex-col gap-2">
                  <span className="text-[16px] font-semibold">{hover.name}</span>
                  <span className="text-[12.5px] text-muted-foreground italic">{hover.meta}</span>
                  {hover.text ? <RulesText text={hover.text} className="text-[13px]" /> : <p className="text-[13px] text-muted-foreground">No description.</p>}
                </div>
              ) : (
                <p className="pt-8 text-center text-[13px] text-muted-foreground">Point at one to read it; click to pick it.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">{children}</div>
            {preview && (
              <aside className="w-[300px] shrink-0 overflow-y-auto border-l bg-muted/30 px-5 py-4">
                <span className="label text-[9.5px]">From The Library</span>
                <RulesText text={preview} className="mt-2 text-[12.5px]" />
              </aside>
            )}
          </div>
        )}

        <footer className="flex items-center justify-end gap-2 border-t px-6 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSave || tab === 'find'} onClick={onSave}>
            {saveLabel}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={cn('flex flex-col gap-0.5 rounded-lg border px-3 py-1.5 text-[13.5px] focus-within:border-primary', wide && 'col-span-2')}>
      <span className="label text-[9px]">{label}</span>
      {children}
    </label>
  );
}

const TEXT = 'w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground/60';
const num = (value: string, min = 0, max = 9999) => Math.max(min, Math.min(max, Number(value.replace(/[^\d.-]/g, '')) || 0));

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn('h-8 rounded-full border px-3 text-[12.5px] text-muted-foreground', on && 'border-primary bg-primary/12 font-medium text-foreground')}>
      {children}
    </button>
  );
}

// ── Items ───────────────────────────────────────────────────────────────

export function ItemDialog({ pc, index, onClose }: { pc: PlayerCharacter; index?: number; onClose: () => void }) {
  const items = useItems();
  const adding = index === undefined;
  const [draft, setDraft] = useState<Item>(() => (adding ? { name: '', qty: 1, weight: 0 } : { ...pc.inventory[index]! }));
  const set = (changes: Partial<Item>) => setDraft((d) => ({ ...d, ...changes }));
  const info = items.find((i) => !i.hidden && sameName(i.name, draft.name));
  const rows = (query: string) =>
    items
      .filter((i) => !i.hidden && matches(query, i.name, i.type, i.stats))
      .sort((a, b) => nameRank(query, a.name) - nameRank(query, b.name) || a.name.localeCompare(b.name))
      .map((i) => ({ id: i.id, name: i.name, meta: [i.rarity ? `${i.rarity} ${i.type.split(',')[0]}` : i.type, i.cost, i.weight ? `${i.weight} lb` : ''].filter(Boolean).join(' · '), text: [i.stats, i.text].filter(Boolean).join('\n\n') }));
  const save = () => {
    const item = { ...draft, name: draft.name.trim() };
    updateRecord('pcs', pc.id, { inventory: adding ? [...pc.inventory, item] : pc.inventory.map((it, i) => (i === index ? item : it)) });
    if (adding) toast('Added To Inventory', { description: item.name });
    onClose();
  };
  return (
    <SheetDialog
      title={adding ? 'Add An Item' : 'Edit Item'}
      adding={adding}
      rows={rows}
      onPick={(id) => {
        const i = items.find((x) => x.id === id)!;
        setDraft((d) => (adding ? { name: i.name, qty: 1, weight: i.weight || undefined, equipped: i.category === 'Weapon' || i.category === 'Armor' ? true : undefined } : { ...d, name: i.name, weight: i.weight || undefined }));
      }}
      preview={info ? [info.type, info.stats, info.text].filter(Boolean).join('\n\n') : undefined}
      saveLabel={adding ? 'Add To Inventory' : 'Save'}
      canSave={Boolean(draft.name.trim())}
      onSave={save}
      onClose={onClose}
    >
      <Field label="Item">
        <input autoFocus value={draft.name} placeholder="Rope, hempen (50 feet)" onChange={(e) => set({ name: e.target.value })} className={cn(TEXT, 'text-[15px] font-semibold')} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="How Many">
          <input inputMode="numeric" value={draft.qty} onChange={(e) => set({ qty: num(e.target.value, 0) })} className={TEXT} />
        </Field>
        <Field label="Pounds Each">
          <input inputMode="decimal" value={draft.weight ?? ''} placeholder="—" onChange={(e) => set({ weight: num(e.target.value) || undefined })} className={TEXT} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Toggle on={Boolean(draft.equipped)} onClick={() => set({ equipped: !draft.equipped })}>
          Equipped
        </Toggle>
        <Toggle on={Boolean(draft.attuned)} onClick={() => set({ attuned: !draft.attuned })}>
          Attuned
        </Toggle>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="label text-[9.5px]">Notes</span>
        <Textarea rows={4} value={draft.notes ?? ''} placeholder="Where it came from, charges left, what it's for…" onChange={(e) => set({ notes: e.target.value })} className={cn(AREA, 'text-[13.5px]')} />
      </label>
    </SheetDialog>
  );
}

// ── Spells ──────────────────────────────────────────────────────────────

export function SpellDialog({ pc, index, onClose }: { pc: PlayerCharacter; index?: number; onClose: () => void }) {
  const spells = useSpells();
  const cls = classOf(pc);
  const adding = index === undefined;
  const [draft, setDraft] = useState(() => (adding ? { name: '', level: 1, prepared: true } : { ...pc.spells[index]! }));
  const [onlyClass, setOnlyClass] = useState(Boolean(cls));
  const set = (changes: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...changes }));
  const info = spells.find((s) => !s.hidden && sameName(s.name, draft.name));
  const rows = (query: string) =>
    spells
      .filter((s) => !s.hidden && (!onlyClass || !cls || s.classes.includes(cls.name)) && matches(query, s.name, s.school))
      .sort((a, b) => nameRank(query, a.name) - nameRank(query, b.name) || a.level - b.level || a.name.localeCompare(b.name))
      .map((s) => ({ id: s.id, name: s.name, meta: `${spellLine(s)} · ${s.castingTime}`, text: [s.text, s.higher && `***At Higher Levels.*** ${s.higher}`].filter(Boolean).join('\n\n') }));
  const save = () => {
    const spell = { ...draft, name: draft.name.trim() };
    updateRecord('pcs', pc.id, { spells: adding ? [...pc.spells, spell] : pc.spells.map((s, i) => (i === index ? spell : s)) });
    if (adding) toast('Spell Added', { description: spell.name });
    onClose();
  };
  return (
    <SheetDialog
      title={adding ? 'Add A Spell' : 'Edit Spell'}
      adding={adding}
      rows={rows}
      filters={
        cls && (
          <span className="flex gap-1.5">
            <Toggle on={onlyClass} onClick={() => setOnlyClass(true)}>
              {cls.name} Spells
            </Toggle>
            <Toggle on={!onlyClass} onClick={() => setOnlyClass(false)}>
              Every Spell
            </Toggle>
          </span>
        )
      }
      onPick={(id) => {
        const s = spells.find((x) => x.id === id)!;
        setDraft((d) => ({ name: s.name, level: s.level, prepared: adding ? true : d.prepared }));
      }}
      preview={info ? [spellLine(info), `${info.castingTime} · ${info.range} · ${info.components} · ${info.duration}`, info.text].join('\n\n') : undefined}
      saveLabel={adding ? 'Add Spell' : 'Save'}
      canSave={Boolean(draft.name.trim())}
      onSave={save}
      onClose={onClose}
    >
      <Field label="Spell">
        <input autoFocus value={draft.name} placeholder="Healing Word" onChange={(e) => set({ name: e.target.value })} className={cn(TEXT, 'text-[15px] font-semibold')} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Level">
          <SelectField label="Level" variant="inline" value={draft.level} onChange={(level) => set({ level })} options={Array.from({ length: 10 }, (_, l) => ({ value: l, label: levelLabel(l) }))} className="data-[size=default]:h-auto" />
        </Field>
        <div className="flex items-center">
          <Toggle on={draft.prepared} onClick={() => set({ prepared: !draft.prepared })}>
            {draft.prepared ? 'Prepared' : 'Not Prepared'}
          </Toggle>
        </div>
      </div>
    </SheetDialog>
  );
}

// ── Attacks ─────────────────────────────────────────────────────────────

type Attack = PlayerCharacter['attacks'][number];

/** A weapon's attack for a character: proficiency plus STR (DEX for ranged; the better for finesse). */
export function weaponAttack(pc: PlayerCharacter, weapon: { name: string; stats: string; type: string }): Attack {
  const dice = /^(\d+d\d+)/.exec(weapon.stats)?.[1] ?? '1d4';
  const mod = /Finesse/.test(weapon.stats) ? Math.max(modifier(pc.abilities.str), modifier(pc.abilities.dex)) : /Ranged/.test(weapon.type) ? modifier(pc.abilities.dex) : modifier(pc.abilities.str);
  return { name: weapon.name, bonus: proficiencyBonus(pc.level) + mod, damage: `${dice}${mod ? signed(mod) : ''}` };
}

export function AttackDialog({ pc, index, onClose }: { pc: PlayerCharacter; index?: number; onClose: () => void }) {
  const items = useItems();
  const adding = index === undefined;
  const [draft, setDraft] = useState<Attack>(() => (adding ? { name: '', bonus: proficiencyBonus(pc.level) + modifier(pc.abilities.str), damage: '1d8' } : { ...pc.attacks[index]! }));
  const set = (changes: Partial<Attack>) => setDraft((d) => ({ ...d, ...changes }));
  const weapons = items.filter((i) => !i.hidden && i.category === 'Weapon');
  const carried = (name: string) => pc.inventory.some((it) => sameName(it.name, name));
  const info = weapons.find((w) => sameName(w.name, draft.name));
  const rows = (query: string) =>
    weapons
      .filter((w) => matches(query, w.name, w.type, w.stats))
      .sort((a, b) => Number(carried(b.name)) - Number(carried(a.name)) || nameRank(query, a.name) - nameRank(query, b.name) || a.name.localeCompare(b.name))
      .map((w) => {
        const a = weaponAttack(pc, w);
        return { id: w.id, name: w.name, meta: `${carried(w.name) ? 'Carried · ' : ''}${signed(a.bonus)} to hit · ${a.damage} · ${w.stats.split(' · ').slice(1).join(' · ') || w.type}`, text: [w.type, w.stats, w.text].filter(Boolean).join('\n\n') };
      });
  const save = () => {
    const attack = { ...draft, name: draft.name.trim() };
    updateRecord('pcs', pc.id, { attacks: adding ? [...pc.attacks, attack] : pc.attacks.map((a, i) => (i === index ? attack : a)) });
    onClose();
  };
  return (
    <SheetDialog
      title={adding ? 'Add An Attack' : 'Edit Attack'}
      adding={adding}
      rows={rows}
      onPick={(id) => setDraft(weaponAttack(pc, weapons.find((w) => w.id === id)!))}
      preview={info ? [info.type, info.stats, info.text].filter(Boolean).join('\n\n') : undefined}
      saveLabel={adding ? 'Add Attack' : 'Save'}
      canSave={Boolean(draft.name.trim())}
      onSave={save}
      onClose={onClose}
    >
      <Field label="Attack">
        <input autoFocus value={draft.name} placeholder="Longsword, Fire Bolt, Bite" onChange={(e) => set({ name: e.target.value })} className={cn(TEXT, 'text-[15px] font-semibold')} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="To Hit">
          <input inputMode="numeric" value={draft.bonus} onChange={(e) => set({ bonus: num(e.target.value, -10, 30) })} className={TEXT} />
        </Field>
        <Field label="Damage Roll">
          <input value={draft.damage} placeholder="1d8+3" onChange={(e) => set({ damage: e.target.value })} className={cn(TEXT, 'font-mono')} />
        </Field>
      </div>
    </SheetDialog>
  );
}

// ── Features ────────────────────────────────────────────────────────────

const KIND_LABEL = { action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction', passive: 'Passive' } as const;
const RESET_LABEL = { short: 'Short Rest', long: 'Long Rest', none: 'Never' } as const;
const SOURCES = ['Species', 'Class', 'Subclass', 'Background', 'Feat', 'Other'];

export function FeatureDialog({ pc, id, onClose }: { pc: PlayerCharacter; id?: string; onClose: () => void }) {
  const cls = classOf(pc);
  const adding = id === undefined;
  const [draft, setDraft] = useState<Feature>(() => (adding ? { id: newId(), name: '', source: 'Other', text: '', action: 'passive', uses: null } : { ...(pc.traits ?? []).find((f) => f.id === id)! }));
  const [group, setGroup] = useState<string | null>(null);
  const set = (changes: Partial<Feature>) => setDraft((d) => ({ ...d, ...changes }));
  const rows = (query: string) =>
    ALL_FEATURES.filter((f) => (!group || f.group === group) && matches(query, f.name, f.source))
      .sort((a, b) => nameRank(query, a.name) - nameRank(query, b.name) || Number(b.source === pc.className) - Number(a.source === pc.className) || (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name))
      .map((f, i) => ({ id: String(ALL_FEATURES.indexOf(f)), name: f.name, meta: `${f.source}${f.level ? ` · Level ${f.level}` : ''}`, text: f.text, key: i }));
  const save = () => {
    const feature = { ...draft, name: draft.name.trim() };
    const traits = pc.traits ?? [];
    updateRecord('pcs', pc.id, { traits: adding ? [...traits, feature] : traits.map((f) => (f.id === id ? feature : f)) });
    if (adding) toast('Feature Added', { description: feature.name });
    onClose();
  };
  return (
    <SheetDialog
      title={adding ? 'Add A Feature' : 'Edit Feature'}
      adding={adding}
      rows={rows}
      filters={
        <span className="flex flex-wrap gap-1.5">
          {[null, 'Class', 'Subclass', 'Species', 'Background'].map((g) => (
            <Toggle key={g ?? 'all'} on={group === g} onClick={() => setGroup(g)}>
              {g ?? 'All'}
            </Toggle>
          ))}
        </span>
      }
      onPick={(index) => {
        const f = ALL_FEATURES[Number(index)]!;
        const picked = toFeature(f, f.source, cls, pc.level, pc.abilities);
        setDraft((d) => ({ ...picked, id: d.id, uses: picked.uses ? { ...picked.uses, used: Math.min(d.uses?.used ?? 0, picked.uses.max) } : picked.uses }));
      }}
      saveLabel={adding ? 'Add Feature' : 'Save'}
      canSave={Boolean(draft.name.trim())}
      onSave={save}
      onClose={onClose}
    >
      <Field label="Feature">
        <input autoFocus value={draft.name} placeholder="Darkvision, Lucky, a blessing" onChange={(e) => set({ name: e.target.value })} className={cn(TEXT, 'text-[15px] font-semibold')} />
      </Field>
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
        <Field label="From">
          <SelectField label="Where it's from" variant="inline" value={draft.source} onChange={(source) => set({ source })} options={[...new Set([...SOURCES, draft.source].filter(Boolean))].map((s) => ({ value: s, label: s }))} className="data-[size=default]:h-auto" />
        </Field>
        <Field label="Used As">
          <SelectField label="Used as" variant="inline" value={draft.action ?? 'passive'} onChange={(action) => set({ action })} options={(['action', 'bonus', 'reaction', 'passive'] as const).map((k) => ({ value: k, label: KIND_LABEL[k] }))} className="data-[size=default]:h-auto" />
        </Field>
        <Field label="Uses">
          <span className="flex items-center gap-1.5">
            <input
              inputMode="numeric"
              value={draft.uses?.max ?? ''}
              placeholder="—"
              onChange={(e) => {
                const max = num(e.target.value, 0, 999);
                set({ uses: max ? { max, used: Math.min(draft.uses?.used ?? 0, max), reset: draft.uses?.reset ?? 'long' } : null });
              }}
              className="w-10 bg-transparent outline-none"
            />
            {draft.uses && <SelectField label="Back after" variant="inline" value={draft.uses.reset} onChange={(reset) => set({ uses: { ...draft.uses!, reset } })} options={(['short', 'long', 'none'] as const).map((r) => ({ value: r, label: RESET_LABEL[r] }))} className="text-[12px] text-muted-foreground data-[size=default]:h-auto" />}
          </span>
        </Field>
        <Field label="Roll">
          <input value={draft.roll ?? ''} placeholder="1d10+3" onChange={(e) => set({ roll: e.target.value.trim() || undefined })} className={cn(TEXT, 'font-mono')} />
        </Field>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="label text-[9.5px]">What It Does</span>
        <Textarea rows={9} value={draft.text} placeholder="What it does, and when." onChange={(e) => set({ text: e.target.value })} className={cn(AREA, 'text-[13.5px] leading-relaxed')} />
      </label>
    </SheetDialog>
  );
}

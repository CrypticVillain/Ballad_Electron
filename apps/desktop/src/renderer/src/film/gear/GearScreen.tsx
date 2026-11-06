import { PackageCheckIcon, PlusIcon, ReceiptIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { confirmDelete } from '@/components/tabletop/Sharing';
import { Empty, Label, ProgressBar } from '@/components/shared/bits';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { createBudgetLine } from '@/lib/actions';
import { money } from '@/lib/film';
import { useWorldRecords } from '@/lib/hooks';
import { live, type World } from '@/lib/model';
import { cn } from '@/lib/utils';
import { useVault } from '@/stores/vault';
import { FilmOnly, nextOrder, PILL, stamp } from '@/film/common';
import { GEAR_CATEGORIES, GEAR_SOURCES, type GearItem } from './model';

/**
 * /film/gear — the kit: camera, lenses, grip, lighting, sound… each owned,
 * rented or borrowed (from whom, at what day rate, for how many days), and
 * ticked off as it's packed. Rentals can go straight onto the budget.
 */
export function GearScreen() {
  return <FilmOnly>{(world) => <Gear world={world} />}</FilmOnly>;
}

const store = () => useVault.getState();

function addGear(worldId: string, category: string): GearItem {
  const item: GearItem = { ...stamp(), worldId, name: '', category, qty: 1, source: 'owned', from: '', dayRate: 0, days: 1, notes: '', packed: false, order: nextOrder(live(store().vault.gear).filter((g) => g.worldId === worldId).map((g) => g.order)) };
  store().put('gear', item);
  return item;
}
const update = (id: string, changes: Partial<GearItem>) => store().patch('gear', id, changes);
const cost = (g: GearItem) => (g.source === 'rented' ? g.dayRate * g.days * g.qty : 0);

function Gear({ world }: { world: World }) {
  const gear = useWorldRecords('gear').sort((a, b) => a.order - b.order);
  const packed = gear.filter((g) => g.packed).length;
  const rentals = gear.reduce((n, g) => n + cost(g), 0);
  const categories = [...GEAR_CATEGORIES, ...new Set(gear.map((g) => g.category).filter((c) => !(GEAR_CATEGORIES as readonly string[]).includes(c)))];
  const toBudget = () => {
    const rented = gear.filter((g) => g.source === 'rented' && cost(g) > 0);
    if (!rented.length) return;
    for (const g of rented) createBudgetLine(world.id, 'cost', { category: 'Equipment', item: `${g.qty > 1 ? `${g.qty} × ` : ''}${g.name || 'Rental'}${g.from ? ` (${g.from})` : ''}`, estimate: cost(g) });
    toast('Added To The Budget', { description: `${rented.length} rentals, ${money(rentals)} in all, as Equipment costs.` });
  };
  const remove = (g: GearItem) =>
    confirmDelete({
      noun: 'Gear',
      name: g.name || 'this item',
      area: 'film:gear',
      remove: () => {
        store().remove('gear', g.id);
        return () => store().restore('gear', g.id);
      },
    });
  return (
    <>
      <Sidebar title="Gear" addLabel="Add Gear" onAdd={() => addGear(world.id, 'Camera')}>
        <div className="flex flex-col gap-2 rounded-xl border bg-background p-3">
          <div className="flex items-baseline justify-between">
            <Label>Packed</Label>
            <span className="font-mono text-[11px] text-muted-foreground">
              {packed} / {gear.length}
            </span>
          </div>
          <ProgressBar value={gear.length ? packed / gear.length : 0} />
          <span className="font-mono text-[11px] text-muted-foreground">{money(rentals)} In Rentals</span>
        </div>
        <SidebarSection title="By Source">
          {GEAR_SOURCES.map((s) => (
            <span key={s.id} className="flex min-h-[28px] items-center justify-between px-2.5 text-[13px]">
              {s.label}
              <span className="font-mono text-[11px] text-muted-foreground">{gear.filter((g) => g.source === s.id).length}</span>
            </span>
          ))}
        </SidebarSection>
      </Sidebar>
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Gear', world.name]}>
          <Button variant="outline" size="sm" className={PILL} disabled={!rentals} onClick={toBudget}>
            <ReceiptIcon /> Rentals To Budget
          </Button>
          <Button variant="outline" size="sm" className={PILL} disabled={!packed} onClick={() => gear.forEach((g) => g.packed && update(g.id, { packed: false }))}>
            <PackageCheckIcon /> Unpack All
          </Button>
        </TopBar>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-5 pb-10">
          {!gear.length ? (
            <Empty title="No Gear Yet" action={<Button onClick={() => addGear(world.id, 'Camera')}>Add Gear</Button>}>
              List the kit for the shoot: what you own, what you’re renting and from whom. Tick it off as it’s packed.
            </Empty>
          ) : (
            <div className="flex max-w-[1100px] flex-col gap-5">
              {categories
                .filter((c) => gear.some((g) => g.category === c))
                .map((category) => (
                  <section key={category} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Label>{category}</Label>
                      <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => addGear(world.id, category)}>
                        <PlusIcon /> Add
                      </Button>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border">
                      <table className="w-full border-collapse text-[13px]">
                        <thead>
                          <tr className="text-left">
                            {['', 'Item', 'Qty', 'Source', 'From', 'Day Rate', 'Days', 'Cost', 'Notes', ''].map((h, i) => (
                              <th key={i} className="label px-2 pt-2 pb-1 font-normal">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {gear
                            .filter((g) => g.category === category)
                            .map((g) => (
                              <tr key={g.id} className={cn('group/gear border-t', g.packed && 'text-muted-foreground')}>
                                <td className="w-8 px-2">
                                  <Checkbox aria-label={`${g.name || 'Item'} packed`} checked={g.packed} onCheckedChange={(v) => update(g.id, { packed: v === true })} />
                                </td>
                                <td className="px-2">
                                  <input aria-label="Item" value={g.name} placeholder="Sony FX6" onChange={(e) => update(g.id, { name: e.target.value })} className={cn('h-8 w-full min-w-[140px] bg-transparent outline-none placeholder:text-muted-foreground/50', g.packed && 'line-through')} />
                                </td>
                                <td className="w-14 px-2">
                                  <input aria-label="Quantity" type="number" min={1} value={g.qty} onChange={(e) => update(g.id, { qty: Math.max(1, Number(e.target.value) || 1) })} className="h-8 w-full bg-transparent font-mono text-[12px] outline-none" />
                                </td>
                                <td className="w-[110px] px-2">
                                  <SelectField label="Source" variant="inline" value={g.source} onChange={(source) => update(g.id, { source })} options={GEAR_SOURCES.map((s) => ({ value: s.id, label: s.label }))} className="text-[12.5px]" />
                                </td>
                                <td className="px-2">
                                  <input aria-label="From" value={g.from} disabled={g.source === 'owned'} placeholder={g.source === 'owned' ? '—' : 'Rental house, friend…'} onChange={(e) => update(g.id, { from: e.target.value })} className="h-8 w-full min-w-[110px] bg-transparent outline-none placeholder:text-muted-foreground/50" />
                                </td>
                                <td className="w-20 px-2">
                                  <input aria-label="Day rate" type="number" min={0} value={g.dayRate} disabled={g.source !== 'rented'} onChange={(e) => update(g.id, { dayRate: Math.max(0, Number(e.target.value) || 0) })} className="h-8 w-full bg-transparent font-mono text-[12px] outline-none disabled:opacity-40" />
                                </td>
                                <td className="w-14 px-2">
                                  <input aria-label="Days" type="number" min={1} value={g.days} disabled={g.source !== 'rented'} onChange={(e) => update(g.id, { days: Math.max(1, Number(e.target.value) || 1) })} className="h-8 w-full bg-transparent font-mono text-[12px] outline-none disabled:opacity-40" />
                                </td>
                                <td className="w-20 px-2 font-mono text-[12px] tabular-nums">{cost(g) ? money(cost(g)) : '—'}</td>
                                <td className="px-2">
                                  <input aria-label="Notes" value={g.notes} placeholder="Serial, batteries…" onChange={(e) => update(g.id, { notes: e.target.value })} className="h-8 w-full min-w-[120px] bg-transparent text-muted-foreground outline-none placeholder:text-muted-foreground/50" />
                                </td>
                                <td className="w-8 px-1">
                                  <button type="button" aria-label={`Delete ${g.name || 'item'}`} onClick={() => remove(g)} className="rounded p-1 text-muted-foreground opacity-0 group-hover/gear:opacity-100 hover:text-destructive focus-visible:opacity-100">
                                    <Trash2Icon className="size-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              <div className="flex flex-wrap gap-1.5">
                {GEAR_CATEGORIES.filter((c) => !gear.some((g) => g.category === c)).map((c) => (
                  <Button key={c} variant="outline" size="sm" className="text-muted-foreground" onClick={() => addGear(world.id, c)}>
                    <PlusIcon /> {c}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

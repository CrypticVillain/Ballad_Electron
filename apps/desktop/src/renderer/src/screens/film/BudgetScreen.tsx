import { PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { DotMeter, Label } from '@/components/shared/bits';
import { SelectField } from '@/components/shared/SelectField';
import { TopBar } from '@/components/shared/TopBar';
import { Sidebar, SidebarSection } from '@/components/shell/Sidebar';
import { Button } from '@/components/ui/button';
import { createBudgetLine, restore, trash, updateRecord } from '@/lib/actions';
import { budgetTotals, money } from '@/lib/film';
import { useWorld, useWorldRecords } from '@/lib/hooks';
import { byOrder, COST_CATEGORIES, INCOME_CATEGORIES, type BudgetLine } from '@/lib/model';
import { cn } from '@/lib/utils';

/**
 * /budget — the production's money: what it costs (cast, crew, kit,
 * locations, post…) and what it earns (sponsors, ad revenue, licensing…),
 * each line estimated and then actual, with the totals and what's left.
 */
export function BudgetScreen() {
  const world = useWorld();
  const lines = useWorldRecords('budget');
  if (!world) return null;
  const totals = budgetTotals(lines);
  const costs = lines.filter((l) => l.kind === 'cost').sort(byOrder);
  const income = lines.filter((l) => l.kind === 'income').sort(byOrder);

  /** Each cost category's estimate, biggest first (the sidebar's breakdown). */
  const byCategory = [...new Set(costs.map((l) => l.category))]
    .map((category) => ({ category, estimate: costs.filter((l) => l.category === category).reduce((s, l) => s + l.estimate, 0) }))
    .sort((a, b) => b.estimate - a.estimate);

  return (
    <>
      <Sidebar title="Budget">
        <div className="flex flex-col gap-2 rounded-xl border bg-background p-3">
          <Label>Estimated Net</Label>
          <span className={cn('font-display text-[28px] leading-none font-black', totals.net.estimate < 0 && 'text-destructive')}>{money(totals.net.estimate)}</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {money(totals.income.estimate)} In · {money(totals.cost.estimate)} Out
          </span>
        </div>
        <SidebarSection title="Costs By Category">
          {byCategory.map(({ category, estimate }) => (
            <div key={category} className="flex flex-col gap-1 px-2.5 py-1">
              <div className="flex justify-between text-[13px]">
                <span>{category}</span>
                <span className="font-mono text-[11.5px] text-muted-foreground">{money(estimate)}</span>
              </div>
              <DotMeter value={totals.cost.estimate ? estimate / totals.cost.estimate : 0} total={16} />
            </div>
          ))}
          {!byCategory.length && <p className="px-2.5 text-[13px] text-muted-foreground">No costs yet.</p>}
        </SidebarSection>
      </Sidebar>
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <TopBar crumbs={['Budget', world.name]} />
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-5 pb-10">
          <div className="flex max-w-[1080px] flex-col gap-5">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Costs" estimate={totals.cost.estimate} actual={totals.cost.actual} />
              <Stat label="Income" estimate={totals.income.estimate} actual={totals.income.actual} />
              <Stat label="Net" estimate={totals.net.estimate} actual={totals.net.actual} signed />
            </div>
            <Lines title="Costs" kind="cost" lines={costs} worldId={world.id} categories={COST_CATEGORIES} />
            <Lines title="Income" kind="income" lines={income} worldId={world.id} categories={INCOME_CATEGORIES} />
          </div>
        </div>
      </main>
    </>
  );
}

function Stat({ label, estimate, actual, signed }: { label: string; estimate: number; actual: number; signed?: boolean }) {
  return (
    <section className="flex flex-col gap-1.5 rounded-2xl border px-5 py-4">
      <Label>{label}</Label>
      <span className={cn('font-display text-[30px] leading-none font-black tabular-nums', signed && estimate < 0 && 'text-destructive')}>{money(estimate)}</span>
      <span className="font-mono text-[11px] text-muted-foreground">Estimated · {money(actual)} Actual</span>
    </section>
  );
}

const CELL = 'h-9 border-t border-border/60 px-2 align-middle';
const MONEY = 'h-9 w-full bg-transparent text-right font-mono text-[12.5px] tabular-nums outline-none';

function Lines({ title, kind, lines, worldId, categories }: { title: string; kind: BudgetLine['kind']; lines: BudgetLine[]; worldId: string; categories: readonly string[] }) {
  const totals = budgetTotals(lines);
  const remove = (line: BudgetLine) => {
    trash('budget', line.id);
    toast('Line Deleted', { description: line.item || line.category, action: { label: 'Undo', onClick: () => restore('budget', line.id) } });
  };
  const sum = kind === 'cost' ? totals.cost : totals.income;
  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border px-5 py-4">
      <div className="flex items-baseline justify-between">
        <Label>{title}</Label>
        <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => createBudgetLine(worldId, kind)}>
          <PlusIcon /> Add Line
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left">
              <th className="label px-2 pb-1.5 font-normal">{kind === 'cost' ? 'Category' : 'Source'}</th>
              <th className="label px-2 pb-1.5 font-normal">Item</th>
              <th className="label px-2 pb-1.5 text-right font-normal">Estimate</th>
              <th className="label px-2 pb-1.5 text-right font-normal">Actual</th>
              <th className="label px-2 pb-1.5 text-right font-normal">Diff</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const diff = line.actual - line.estimate;
              const bad = line.actual > 0 && (kind === 'cost' ? diff > 0 : diff < 0);
              return (
                <tr key={line.id} className="group/line">
                  <td className={cn(CELL, 'w-[170px]')}>
                    <SelectField label="Category" variant="inline" value={line.category} onChange={(category) => updateRecord('budget', line.id, { category })} options={categories.map((c) => ({ value: c as string, label: c }))} />
                  </td>
                  <td className={CELL}>
                    <input aria-label="Item" value={line.item} placeholder={kind === 'cost' ? 'Camera rental, 2 days' : 'Sponsor read: Lumen Glassworks'} onChange={(e) => updateRecord('budget', line.id, { item: e.target.value })} className="h-9 w-full bg-transparent outline-none placeholder:text-muted-foreground/50" />
                  </td>
                  <td className={cn(CELL, 'w-[120px]')}>
                    <MoneyInput label="Estimate" value={line.estimate} onChange={(estimate) => updateRecord('budget', line.id, { estimate })} />
                  </td>
                  <td className={cn(CELL, 'w-[120px]')}>
                    <MoneyInput label="Actual" value={line.actual} onChange={(actual) => updateRecord('budget', line.id, { actual })} />
                  </td>
                  <td className={cn(CELL, 'w-[100px] text-right font-mono text-[12px] tabular-nums', bad ? 'text-destructive' : 'text-muted-foreground')}>{line.actual ? money(diff) : '—'}</td>
                  <td className={cn(CELL, 'w-8')}>
                    <button type="button" aria-label={`Delete ${line.item || line.category}`} onClick={() => remove(line)} className="rounded p-1 text-muted-foreground opacity-0 group-hover/line:opacity-100 hover:text-foreground focus-visible:opacity-100">
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            <tr className="font-semibold">
              <td className={CELL} colSpan={2}>
                Total
              </td>
              <td className={cn(CELL, 'text-right font-mono text-[12.5px] tabular-nums')}>{money(sum.estimate)}</td>
              <td className={cn(CELL, 'text-right font-mono text-[12.5px] tabular-nums')}>{money(sum.actual)}</td>
              <td className={CELL} colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** A dollar amount, edited as a plain number. */
function MoneyInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <span className="flex items-center gap-0.5">
      <span className="font-mono text-[12px] text-muted-foreground">$</span>
      <input aria-label={label} type="number" min={0} step={10} value={value || ''} placeholder="0" onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} className={MONEY} />
    </span>
  );
}

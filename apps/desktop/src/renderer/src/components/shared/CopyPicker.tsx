import { SearchIcon, type LucideIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { FIELD } from '@/components/shared/Field';
import { cn } from '@/lib/utils';

/**
 * The pieces of a dialog that copies a world thing by thing: Tabletop's Copy
 * Campaign (tabletop/copy) and Create A Sequel (sequel/). A column of
 * sections on the left (NavRow), a heading and options (Heading, Toggle),
 * and each section's things to tick (ItemPicker).
 */

export type CopyItem = { id: string; name: string; detail?: string };

/** A row of the dialog's left column: a section, its count. */
export function NavRow({ active, onClick, icon: Icon, label, count, dim }: { active: boolean; onClick: () => void; icon: LucideIcon; label: string; count?: string; dim?: boolean }) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex h-[34px] min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-[13.5px] text-sidebar-foreground hover:bg-sidebar-accent',
        active && 'bg-sidebar-accent text-sidebar-accent-foreground',
      )}
    >
      <Icon className={cn('size-4 shrink-0', dim ? 'text-muted-foreground/60' : 'text-muted-foreground')} />
      <span className={cn('min-w-0 flex-1 truncate', dim && 'text-muted-foreground')}>{label}</span>
      {count && <span className="font-mono text-[10.5px] text-muted-foreground">{count}</span>}
    </button>
  );
}

export function Heading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-1">
      <h2 className="font-display text-2xl leading-tight font-black uppercase">{title}</h2>
      {children && <p className="text-[13px] text-muted-foreground">{children}</p>}
    </header>
  );
}

/** An option, ticked or not, with a line on what it does. */
export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <span className="flex flex-col gap-0.5">
        <span className="text-[13.5px]">{label}</span>
        {hint && <span className="text-[12px] text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

/** A section's things, each ticked to copy or not, with All / None (on what the search shows) and the section's own options above. */
export function ItemPicker({
  title,
  note,
  empty,
  noun,
  items,
  chosen,
  onPick,
  options,
}: {
  title: string;
  note?: string;
  /** Said when there's nothing to pick. */
  empty: string;
  /** What the things are called, for the search ("NPCs"). */
  noun: string;
  items: CopyItem[];
  chosen: string[];
  onPick: (ids: string[]) => void;
  options?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const picked = useMemo(() => new Set(chosen), [chosen]);
  const shown = query.trim() ? items.filter((i) => `${i.name} ${i.detail ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())) : items;
  const toggle = (id: string, on: boolean) => onPick(on ? items.filter((i) => i.id === id || picked.has(i.id)).map((i) => i.id) : chosen.filter((x) => x !== id));
  // All / None act on what the search shows.
  const all = () => onPick(items.filter((i) => picked.has(i.id) || shown.includes(i)).map((i) => i.id));
  const none = () => onPick(chosen.filter((id) => !shown.some((i) => i.id === id)));

  return (
    <section className="flex flex-col gap-4">
      <Heading title={title}>{note}</Heading>
      {!items.length ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <>
          {options && <div className="-mx-3 flex flex-col">{options}</div>}
          <div className="flex items-center gap-2">
            {items.length > 8 && (
              <div className="relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label={`Search ${title}`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${noun}`} className={cn(FIELD, 'pl-8')} />
              </div>
            )}
            <span className="mr-auto font-mono text-[11px] text-muted-foreground">
              {chosen.length} of {items.length}
            </span>
            <Button variant="outline" size="sm" onClick={all}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={none}>
              Select None
            </Button>
          </div>
          <ul aria-label={title} className="flex flex-col rounded-xl border">
            {shown.map((item) => (
              <li key={item.id} className="border-b last:border-b-0">
                <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2 hover:bg-muted/50">
                  <Checkbox checked={picked.has(item.id)} onCheckedChange={(v) => toggle(item.id, v === true)} />
                  <span className={cn('min-w-0 flex-1 truncate text-[13.5px]', !picked.has(item.id) && 'text-muted-foreground')}>{item.name}</span>
                  {item.detail && <span className="max-w-48 shrink-0 truncate font-mono text-[11px] text-muted-foreground">{item.detail}</span>}
                </label>
              </li>
            ))}
            {!shown.length && <li className="px-3.5 py-6 text-center text-sm text-muted-foreground">Nothing matches “{query}”.</li>}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * bits.tsx — the small pieces every screen uses, in the suite's Display
 * language: mono labels, status lights, keycaps, dot meters, pill tabs.
 */
import { Fragment, type ReactNode } from 'react';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/** A small uppercase mono label ("TASKS · 3 DUE"). */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('label', className)}>{children}</span>;
}

/** A status light. `tone`: accent (orange), online (green) or off. Glows in Display and Chassis. */
export function Led({ tone = 'accent', className }: { tone?: 'accent' | 'online' | 'off' | 'muted'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-[7px] shrink-0 rounded-full',
        tone === 'accent' && 'led-unread bg-unread',
        tone === 'online' && 'led-online bg-online',
        tone === 'off' && 'bg-input',
        tone === 'muted' && 'bg-muted-foreground/60',
        className,
      )}
    />
  );
}

/** A keyboard key, drawn as a solid keycap (dark on light themes, light on dark). */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] border border-key-border bg-key px-1 font-mono text-[10px] leading-none text-key-foreground shadow-[0_1px_0_0_var(--key-shadow)]">
      {children}
    </kbd>
  );
}

export function KeyHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center gap-0.5">
        {keys.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </span>
      {label}
    </span>
  );
}

/** A dot-matrix progress meter: `total` segments, the first `value` lit. */
export function DotMeter({ value, total = 40, className }: { value: number; total?: number; className?: string }) {
  const lit = Math.round(Math.max(0, Math.min(1, value)) * total);
  return (
    <div className={cn('flex items-center gap-1', className)} role="meter" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn('h-1.5 flex-1 rounded-[2px]', i < lit ? 'led-unread bg-unread' : 'bg-input')} />
      ))}
    </div>
  );
}

/** A thin progress bar (shadcn's Progress) with its percentage. */
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Progress value={pct} aria-label="Progress" className="h-1 flex-1 rounded-sm bg-input" />
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{pct}%</span>
    </div>
  );
}

/** shadcn's TabsTrigger as a pill: ink when selected (or the accent, for an `accent` tab). */
const PILL =
  'h-[26px] flex-none rounded-full border-0 px-3 font-mono text-[10.5px] font-normal tracking-[0.08em] text-muted-foreground uppercase shadow-none hover:text-foreground dark:text-muted-foreground ' +
  'data-[state=active]:bg-foreground data-[state=active]:text-background group-data-[variant=default]/tabs-list:data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-foreground dark:data-[state=active]:text-background';
const ACCENT_PILL =
  'bg-primary/10 font-semibold text-foreground ring-1 ring-primary/60 ring-inset hover:bg-primary/20 dark:text-foreground ' +
  'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground';

/**
 * Pill tabs (Board · List · Timeline): shadcn's Tabs (arrow keys move between
 * them), drawn as Display's pills. An `accent` option is drawn in the style's
 * own accent color (--primary, so each style brings its own) and set apart by
 * a thin rule, for a tab that's different in kind (Help's All). `children`
 * go at the end of the strip (a "+ View" menu).
 */
export function PillTabs<T extends string>({
  value,
  options,
  onChange,
  label,
  children,
}: {
  value: T;
  options: { value: T; label: string; accent?: boolean }[];
  onChange: (value: T) => void;
  label: string;
  children?: ReactNode;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)} className="gap-0">
      <TabsList aria-label={label} className="h-auto gap-1 rounded-full border bg-transparent p-[3px] group-data-[orientation=horizontal]/tabs:h-auto">
        {options.map((option) => (
          <Fragment key={option.value}>
            {option.accent && <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-auto self-stretch" />}
            <TabsTrigger value={option.value} className={cn(PILL, option.accent && ACCENT_PILL)}>
              {option.label}
            </TabsTrigger>
          </Fragment>
        ))}
        {children}
      </TabsList>
    </Tabs>
  );
}

/** A spec-sheet row with a dotted leader ("Status ····· In Progress"). */
export function SpecRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 font-mono text-xs">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <span aria-hidden className="min-w-4 flex-1 border-b border-dotted border-muted-foreground/50" />
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}

/** A labeled stat tile (Progress 42%). */
export function StatTile({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className="flex min-w-[104px] flex-col gap-0.5 rounded-xl border bg-background px-3.5 py-2.5">
      <span className="label text-[9.5px]">{label}</span>
      <span className={cn('font-display text-2xl leading-tight font-black', accent && 'text-primary')}>{value}</span>
    </div>
  );
}

/** The empty state: a big dot-matrix word and a line of help. */
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="font-display text-3xl font-black text-muted-foreground/60 uppercase">{title}</span>
      {children && <p className="max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action}
    </div>
  );
}

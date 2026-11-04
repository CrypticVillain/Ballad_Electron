import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Hint } from '@/components/shared/Hint';
import { cn } from '@/lib/utils';

/**
 * Toolbar — a top bar's actions as one rounded group of buttons (Lock · Long
 * Rest · Dice), so the bar stays one line: each shows its label when the bar
 * has room (the TopBar's `topbar` container, 72rem and up) and just its icon
 * otherwise, with the label on hover.
 */
export function ToolbarGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 items-center gap-0.5 rounded-full border bg-background p-[3px]">
      {children}
    </div>
  );
}

export function ToolbarButton({
  icon: Icon,
  label,
  hint,
  onClick,
  pressed,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  /** What hovering says (the label, by default). */
  hint?: ReactNode;
  onClick: () => void;
  /** A toggle that's on (drawn lit). */
  pressed?: boolean;
  tone?: 'destructive';
}) {
  return (
    <Hint label={hint ?? label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        className={cn(
          'flex h-7 items-center gap-1.5 rounded-full px-2 font-mono text-[11px] tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none @6xl/topbar:px-2.5',
          pressed && 'bg-primary/12 text-primary hover:bg-primary/18 hover:text-primary',
          tone === 'destructive' && 'hover:bg-destructive/10 hover:text-destructive',
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="hidden @6xl/topbar:inline">{label}</span>
      </button>
    </Hint>
  );
}

import { useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * HoverCard — a card of detail under a small button (an action in combat, a
 * condition): it opens when the pointer rests on the button (or it's focused),
 * and closes when the pointer leaves both. `pin`: a click keeps it open (for
 * cards with buttons of their own); otherwise the button's own click is left
 * to it (a condition toggles).
 */
export function HoverCard({ title, pin, children, className, trigger }: { title: string; pin?: boolean; children: ReactNode; className?: string; trigger: ReactElement }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const timer = useRef<number | null>(null);
  const hover = (on: boolean) => {
    if (timer.current) window.clearTimeout(timer.current);
    if (pinned) return;
    // A moment's grace on the way out, so the pointer can reach the card.
    timer.current = window.setTimeout(() => setOpen(on), on ? 250 : 150);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Only Esc and clicks outside close it from here; a click on the button is the button's.
        if (!next) {
          setOpen(false);
          setPinned(false);
        }
      }}
    >
      <PopoverTrigger
        asChild
        onClick={(e) => {
          // The popover's own toggle stays out of it: the button's click is the button's (the card stays open over it).
          e.preventDefault();
          if (!pin) return;
          if (timer.current) window.clearTimeout(timer.current);
          const next = !(pinned && open);
          setPinned(next);
          setOpen(next);
        }}
        onMouseEnter={() => hover(true)}
        onMouseLeave={() => hover(false)}
        onFocus={() => hover(true)}
        onBlur={() => hover(false)}
      >
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        onMouseEnter={() => hover(true)}
        onMouseLeave={() => hover(false)}
        onOpenAutoFocus={(e) => !pinned && e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className={cn('flex max-h-[60vh] w-[340px] flex-col gap-1.5 overflow-y-auto', className)}
      >
        <span className="text-[14px] font-semibold">{title}</span>
        {children}
      </PopoverContent>
    </Popover>
  );
}

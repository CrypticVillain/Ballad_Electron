import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { dayKey, parseDay, shortDate, today, weekdayShort } from '@/lib/dates';
import { cn } from '@/lib/utils';

/**
 * DateField — picks a day with shadcn's date picker (Calendar in a Popover),
 * in the theme's colors, instead of a native date input whose calendar the OS
 * draws. Values are day keys ("2026-11-02"); weeks start on Monday.
 * (Overture's, without its time of day.)
 *
 *   field  a bordered box like the app's text fields (the default)
 *   bare   just the date, for table cells and spec rows
 */
export function DateField({
  value,
  onChange,
  label,
  placeholder = 'No Date',
  clearable = true,
  variant = 'field',
  className,
}: {
  value: string | null;
  onChange: (day: string | null) => void;
  /** The accessible name. */
  label: string;
  placeholder?: string;
  clearable?: boolean;
  variant?: 'field' | 'bare';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const pick = (next: string | null) => {
    onChange(next);
    setOpen(false);
  };
  const text = !value ? placeholder : `${weekdayShort(value)}, ${shortDate(value)}, ${value.slice(0, 4)}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`${label}: ${value ? text : 'not set'}`}
        className={cn(
          'flex items-center gap-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          variant === 'field' && 'h-9 w-full justify-between rounded-lg border border-input bg-background px-2.5 text-sm data-[state=open]:border-primary',
          variant === 'bare' && 'font-mono text-xs hover:text-foreground',
          !value && 'text-muted-foreground',
          className,
        )}
      >
        <span className="truncate">{text}</span>
        {variant === 'field' && <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar mode="single" selected={value ? parseDay(value) : undefined} defaultMonth={value ? parseDay(value) : undefined} weekStartsOn={1} onSelect={(date) => date && pick(dayKey(date))} autoFocus />
        <div className="flex justify-between gap-2 border-t p-2">
          <Button variant="ghost" size="sm" onClick={() => pick(today())}>
            Today
          </Button>
          {clearable && value && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => pick(null)}>
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

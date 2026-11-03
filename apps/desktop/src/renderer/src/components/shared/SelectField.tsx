import type { ReactNode } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type SelectOption<T> = { value: T; label: ReactNode };

/**
 * SelectField — the app's dropdown: shadcn's Select (Radix), so the list is
 * drawn in the theme's colors. Use it instead of a native <select>, whose
 * list the OS draws in its own colors (light text on a light list in dark
 * mode).
 *
 * Values can be anything (null for "None", numbers, ids): options are keyed
 * by position, since Radix reserves the empty string.
 *
 *   field   a bordered box, the size of the app's text fields (the default)
 *   inline  just the value and a chevron, for spec rows and toolbars
 *   chip    a small mono pill, for toolbars (Group: Status)
 */
export function SelectField<T>({
  value,
  options,
  onChange,
  label,
  variant = 'field',
  align = 'start',
  className,
}: {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** The accessible name (shown nowhere: put a visible label beside it). */
  label: string;
  variant?: 'field' | 'inline' | 'chip';
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  const index = options.findIndex((o) => Object.is(o.value, value));
  return (
    <Select value={index < 0 ? undefined : String(index)} onValueChange={(i) => onChange(options[Number(i)]!.value)}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          variant === 'field' && 'h-9 w-full rounded-lg bg-background px-2.5 shadow-none data-[state=open]:border-primary dark:bg-background',
          variant === 'inline' && 'h-auto gap-1 border-0 bg-transparent p-0 text-[length:inherit] [font-family:inherit] shadow-none hover:text-foreground focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent [&_svg]:size-3.5',
          variant === 'chip' && 'h-7 gap-1.5 rounded-lg bg-card px-2.5 font-mono text-[11px] shadow-none data-[state=open]:border-primary dark:bg-card',
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align={align} className="max-h-72">
        {options.map((option, i) => (
          <SelectItem key={i} value={String(i)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

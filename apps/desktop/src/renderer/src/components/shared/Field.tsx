import type { ReactNode } from 'react';
import { Label as UiLabel } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Makes shadcn's Input the size and color of the app's form fields (and SelectField's "field" look). */
export const FIELD = 'h-9 rounded-lg bg-background px-2.5 shadow-none dark:bg-background';

/** The same for shadcn's Textarea. */
export const AREA = 'rounded-lg bg-background px-3 py-2 shadow-none dark:bg-background';

/**
 * Field — a form control with its small mono label above it, wrapped in
 * shadcn's Label so clicking the label focuses (or opens) the control.
 */
export function Field({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <UiLabel className={cn('flex-col items-stretch gap-1.5 leading-normal font-normal', className)}>
      <span className="label">{label}</span>
      {children}
    </UiLabel>
  );
}

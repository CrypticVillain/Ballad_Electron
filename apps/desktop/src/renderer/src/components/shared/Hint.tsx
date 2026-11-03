import type { ReactElement, ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Hint — a themed tooltip on hover or focus (shadcn's Tooltip), instead of the
 * browser's `title`. `children` must be one element that takes a ref (a button,
 * a link, a span).
 */
export function Hint({ label, children, side = 'bottom' }: { label: ReactNode; children: ReactElement; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

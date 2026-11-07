import { Fragment, type ReactNode } from 'react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { SessionButton } from '@/components/tabletop/SessionButton';
import { HistoryArrows } from '@/components/shared/HistoryArrows';
import { useSection, useWorld } from '@/lib/hooks';
import { cn } from '@/lib/utils';

/**
 * TopBar — the 52 px bar across the top of a screen: a mono breadcrumb on the
 * left ("WORK / BALLAD LAUNCH", shadcn's Breadcrumb), actions on the right.
 * Always one line: the breadcrumb shrinks (each crumb truncating) before the
 * actions do. It's the `topbar` container, so actions can show more as it
 * widens (components/shared/Toolbar.tsx). In Tabletop, a campaign's next session
 * leads the actions on every screen (components/tabletop/SessionButton.tsx).
 */
export function TopBar({ crumbs, children, className }: { crumbs: ReactNode[]; children?: ReactNode; className?: string }) {
  const section = useSection();
  const world = useWorld();
  // The next session: Tabletop's, and Play's (it runs the same campaign).
  const session = (section === 'tabletop' || section === 'play') && world ? <SessionButton world={world} /> : null;
  return (
    <div className={cn('@container/topbar flex h-[52px] shrink-0 items-center gap-2.5 border-b px-6', className)}>
      <HistoryArrows />
      <Breadcrumb className="min-w-0 flex-1 overflow-hidden">
        <BreadcrumbList className="flex-nowrap gap-2.5 sm:gap-2.5">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <Fragment key={index}>
                {index > 0 && <BreadcrumbSeparator className="label text-muted-foreground/50">/</BreadcrumbSeparator>}
                <BreadcrumbItem className="min-w-0">
                  {last ? (
                    <BreadcrumbPage className="label max-w-[240px] truncate text-foreground">{crumb}</BreadcrumbPage>
                  ) : (
                    <span className="label max-w-[240px] truncate">{crumb}</span>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      {(children || session) && (
        <div className="flex shrink-0 items-center gap-2">
          {session}
          {children}
        </div>
      )}
    </div>
  );
}

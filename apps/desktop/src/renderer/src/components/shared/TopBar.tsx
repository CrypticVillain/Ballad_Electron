import { Fragment, type ReactNode } from 'react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';

/**
 * TopBar — the 52 px bar across the top of a screen: a mono breadcrumb on the
 * left ("WORK / BALLAD LAUNCH", shadcn's Breadcrumb), actions on the right.
 */
export function TopBar({ crumbs, children, className }: { crumbs: ReactNode[]; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-[52px] shrink-0 flex-wrap items-center gap-2.5 border-b px-6 py-2', className)}>
      <Breadcrumb>
        <BreadcrumbList className="gap-2.5 sm:gap-2.5">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <Fragment key={index}>
                {index > 0 && <BreadcrumbSeparator className="label text-muted-foreground/50">/</BreadcrumbSeparator>}
                <BreadcrumbItem>
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
      <span className="flex-1" />
      {children}
    </div>
  );
}

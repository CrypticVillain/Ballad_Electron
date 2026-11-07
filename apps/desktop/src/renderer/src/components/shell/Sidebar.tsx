import { Link, useRouterState } from '@tanstack/react-router';
import { PlusIcon, SearchIcon, type LucideIcon } from 'lucide-react';
import { createContext, useContext, type ReactNode } from 'react';
import { Label } from '@/components/shared/bits';
import { Hint } from '@/components/shared/Hint';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useUi } from '@/stores/ui';

/**
 * Sidebar — the 248 px column beside each screen (Overture's): the module's
 * name in dot matrix with a + button, the search field, then the screen's own
 * sections. Each screen builds its sidebar from these pieces.
 */

/** Whether sidebars show the search field: Play's window has no app search (Ctrl K), so its Library's sidebar doesn't. */
const SidebarSearch = createContext(true);
export function NoSidebarSearch({ children }: { children: ReactNode }) {
  return <SidebarSearch.Provider value={false}>{children}</SidebarSearch.Provider>;
}
/** `addMenu`: the + opens these (DropdownMenuItems) rather than calling `onAdd`. */
export function Sidebar({ title, onAdd, addLabel, addMenu, children, footer }: { title: string; onAdd?: () => void; addLabel?: string; addMenu?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const search = useContext(SidebarSearch);
  return (
    <aside className="flex w-[248px] shrink-0 flex-col gap-4 overflow-hidden border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground">
      <div className="flex items-center justify-between gap-2 px-1.5">
        <span className="truncate font-display text-xl font-black tracking-wide uppercase">{title}</span>
        {addMenu ? (
          <DropdownMenu>
            <Hint label={addLabel ?? 'New'}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label={addLabel ?? 'New'} className="size-7 shrink-0 rounded-full bg-transparent hover:bg-sidebar-accent dark:bg-transparent">
                  <PlusIcon className="size-[15px]" />
                </Button>
              </DropdownMenuTrigger>
            </Hint>
            <DropdownMenuContent align="end">{addMenu}</DropdownMenuContent>
          </DropdownMenu>
        ) : onAdd && (
          <Hint label={addLabel ?? 'New'}>
            <Button variant="outline" size="icon-sm" aria-label={addLabel ?? 'New'} onClick={onAdd} className="size-7 shrink-0 rounded-full bg-transparent hover:bg-sidebar-accent dark:bg-transparent">
              <PlusIcon className="size-[15px]" />
            </Button>
          </Hint>
        )}
      </div>
      {search && (
        <Button variant="ghost" onClick={() => useUi.getState().setSearch(true)} className="h-[34px] justify-start gap-2 rounded-lg border bg-background px-2.5 text-[13px] font-normal text-muted-foreground hover:bg-background hover:text-foreground dark:hover:bg-background">
          <SearchIcon className="size-[15px]" />
          <span className="flex-1 text-left">Search</span>
          <span className="font-mono text-[10px]">Ctrl K</span>
        </Button>
      )}
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">{children}</div>
      {footer}
    </aside>
  );
}

export function SidebarSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="group/section flex flex-col gap-0.5">
      <div className="flex min-h-5 items-center justify-between px-2.5 pb-1.5">
        <Label>{title}</Label>
        {action}
      </div>
      {children}
    </div>
  );
}

/** A sidebar row: an icon or a light, the label, and a mono figure on the right. */
export const SIDEBAR_ROW = 'flex min-h-[30px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13.5px] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground';
export const SIDEBAR_ROW_ON = 'bg-sidebar-accent font-medium text-sidebar-accent-foreground';

export function SidebarLink({ to, icon: Icon, lead, label, meta, exact }: { to: string; icon?: LucideIcon; lead?: ReactNode; label: ReactNode; meta?: ReactNode; exact?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const active = exact ? path === to : path === to || path.startsWith(`${to}/`);
  return (
    <Link to={to} aria-current={active ? 'page' : undefined} className={cn(SIDEBAR_ROW, active && SIDEBAR_ROW_ON)}>
      {Icon && <Icon className="size-4 shrink-0" strokeWidth={1.75} />}
      {lead}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta !== undefined && <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{meta}</span>}
    </Link>
  );
}

/** The small + beside a section's title (shown on hover or focus). */
export function SectionAdd({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Hint label={label}>
      <Button variant="ghost" size="icon-xs" aria-label={label} onClick={onClick} className="opacity-0 group-hover/section:opacity-100 focus-visible:opacity-100">
        <PlusIcon />
      </Button>
    </Hint>
  );
}

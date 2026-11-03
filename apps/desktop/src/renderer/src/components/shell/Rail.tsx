import { Link, useRouterState } from '@tanstack/react-router';
import { BookOpenIcon, CircleUserIcon, HomeIcon, MapPinIcon, PenLineIcon, SettingsIcon, WaypointsIcon, type LucideIcon } from 'lucide-react';
import { BalladMark } from '@/components/shared/BalladMark';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useUi } from '@/stores/ui';

/**
 * Rail — the module bar down the left (Harmony's server bar, for modules):
 * the mark, then Home, Manuscript, Characters, Places, Lore and Timeline
 * (Alt+1…6), then Settings.
 */
export const MODULES: { to: string; label: string; icon: LucideIcon; match: (path: string) => boolean }[] = [
  { to: '/', label: 'World Home', icon: HomeIcon, match: (p) => p === '/' },
  { to: '/manuscript', label: 'Manuscript', icon: PenLineIcon, match: (p) => p.startsWith('/manuscript') },
  { to: '/bible/character', label: 'Characters', icon: CircleUserIcon, match: (p) => p.startsWith('/bible/character') },
  { to: '/bible/place', label: 'Places', icon: MapPinIcon, match: (p) => p.startsWith('/bible/place') },
  { to: '/bible/lore', label: 'Lore', icon: BookOpenIcon, match: (p) => p.startsWith('/bible/lore') },
  { to: '/timeline', label: 'Timeline', icon: WaypointsIcon, match: (p) => p.startsWith('/timeline') },
];

const tile =
  'relative flex size-11 items-center justify-center rounded-[var(--tile-radius)] text-muted-foreground transition-colors hover:bg-rail-item hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

export function Rail() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav aria-label="Modules" className="flex w-[76px] shrink-0 flex-col items-center gap-2.5 border-r border-rail-border/60 bg-rail pt-3 pb-4">
      <Link to="/" aria-label="Ballad, World Home" className="rounded-[var(--tile-radius)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <BalladMark className="size-11" />
      </Link>
      <span aria-hidden className="my-0.5 h-px w-7 bg-rail-border" />
      {MODULES.map((module, index) => {
        const active = module.match(path);
        const Icon = module.icon;
        return (
          <Tooltip key={module.to}>
            <TooltipTrigger asChild>
              <Link
                to={module.to}
                aria-label={module.label}
                aria-current={active ? 'page' : undefined}
                className={cn(tile, active && 'bg-rail-item text-foreground shadow-[inset_0_0_0_1px_var(--rail-border),var(--tile-shadow)]')}
              >
                <Icon className="size-[18px]" strokeWidth={1.75} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              {module.label} <span className="ml-1 font-mono text-[10px] opacity-70">Alt+{index + 1}</span>
            </TooltipContent>
          </Tooltip>
        );
      })}
      <span className="flex-1" />
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label="Settings" className={tile} onClick={() => useUi.getState().setSettings(true)}>
            <SettingsIcon className="size-[18px]" strokeWidth={1.75} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          Settings <span className="ml-1 font-mono text-[10px] opacity-70">Ctrl+,</span>
        </TooltipContent>
      </Tooltip>
    </nav>
  );
}

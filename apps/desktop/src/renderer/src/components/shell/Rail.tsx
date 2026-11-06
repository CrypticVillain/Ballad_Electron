import { Link, useRouterState } from '@tanstack/react-router';
import { DicesIcon, SettingsIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSection } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { useUi } from '@/stores/ui';
import { AccountMenu } from './AccountMenu';
import { useModules } from './modules';
import { WorldMenu } from './WorldMenu';

const tile =
  'relative flex size-11 shrink-0 items-center justify-center rounded-[var(--tile-radius)] text-muted-foreground transition-colors hover:bg-rail-item hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/**
 * Rail — the module bar down the left (Harmony's server bar, for modules):
 * the mark (the world menu: switch sections, worlds and accounts), then the
 * open section's modules (Alt+1…9), then (Tabletop) the dice, your account (and,
 * in Tabletop, the GM / Player switch) and Settings.
 */
export function Rail() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const section = useSection();
  const modules = useModules();

  return (
    <nav aria-label="Modules" className="flex w-[76px] shrink-0 flex-col items-center gap-2.5 overflow-y-auto border-r border-rail-border/60 bg-rail pt-3 pb-4">
      <WorldMenu />
      <span aria-hidden className="my-0.5 h-px w-7 shrink-0 bg-rail-border" />
      {modules.map((module, index) => {
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
      {section === 'tabletop' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" aria-label="Dice" className={tile} onClick={() => useUi.getState().setDice(true)}>
              <DicesIcon className="size-[18px]" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Dice <span className="ml-1 font-mono text-[10px] opacity-70">Ctrl+D</span>
          </TooltipContent>
        </Tooltip>
      )}
      <AccountMenu className={cn(tile, 'data-[state=open]:bg-rail-item data-[state=open]:text-foreground')} />
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

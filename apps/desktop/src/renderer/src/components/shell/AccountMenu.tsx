import { useNavigate } from '@tanstack/react-router';
import { CircleUserRoundIcon, KeyboardIcon, LogOutIcon, SettingsIcon, SunMoonIcon, UserCogIcon, UserPlusIcon } from 'lucide-react';
import { AccountAvatar } from '@/components/shared/AccountAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRole, useSection } from '@/lib/hooks';
import { placeBefore } from '@/lib/actions';
import { useDragList } from '@/components/shared/dragList';
import type { TabletopRole } from '@/lib/model';
import { accountName, useAccounts, useCurrentAccount } from '@/stores/accounts';
import { usePreferences } from '@/stores/preferences';
import { useUi } from '@/stores/ui';
import { cn } from '@/lib/utils';
import { BADGE_DOT, invitesLabel, useInviteCounts } from '@/tabletop/members/invites';
import type { ThemeSource } from '../../../../shared/ipc';
import { ROLES, switchRole } from './RoleToggle';
import { useMenuFocus } from './useMenuFocus';

const THEMES: { value: ThemeSource; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Match System' },
];

/**
 * AccountMenu — the account icon above Settings at the bottom of the rail
 * (Overture's): the current account (Account Settings), the other signed-in
 * accounts to switch to, Add Another Account, Appearance, Settings and Sign
 * Out; in Tabletop, whether you're the GM or a player. Worlds are in the world menu
 * (the mark at the top).
 */
export function AccountMenu({ className }: { className: string }) {
  const current = useCurrentAccount();
  const accounts = useAccounts((s) => s.accounts).filter((a) => a.signedIn);
  // Drag an account to put it in another place.
  const drag = useDragList('application/x-ballad-account', (id, before) => {
    const all = useAccounts.getState().accounts.map((a) => a.id);
    void useAccounts.getState().reorderAccounts(placeBefore(all, id, before));
  });
  const theme = usePreferences((s) => s.theme);
  const ui = useUi.getState();
  const focus = useMenuFocus();
  const name = accountName(current);
  const navigate = useNavigate();
  const role = useRole();
  const inTabletop = useSection() === 'tabletop';
  const invites = useInviteCounts();
  const anyInvites = accounts.some((a) => invites[a.id]);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger aria-label={`Account: ${name}${anyInvites ? ' · invites waiting' : ''}`} className={cn(className, 'relative')} {...focus.trigger}>
            {accounts.length > 1 ? <AccountAvatar account={current} current className="size-7 text-[10px]" /> : <CircleUserRoundIcon className="size-[18px]" strokeWidth={1.75} />}
            {/* An invite waits for an account on this computer (the list says which). */}
            {anyInvites && <span aria-hidden className={cn(BADGE_DOT, 'top-0.5 right-0.5')} />}
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">{name}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="right" align="end" sideOffset={10} className="w-72" {...focus.content}>
        <DropdownMenuLabel className="flex items-center gap-2.5 py-2 font-normal">
          <AccountAvatar account={current} current className="size-9 text-[13px]" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="truncate text-[12px] text-muted-foreground">{current?.plays?.length ? `Plays ${current.plays.join(' & ')}` : current?.email || 'On this computer'}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => current && ui.openAccount({ kind: 'settings', id: current.id })}>
          <UserCogIcon /> Account Settings…
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {inTabletop && (
          <>
            <DropdownMenuLabel className="label py-1 text-muted-foreground">Tabletop View</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={role ?? ''} onValueChange={(next) => switchRole(next as TabletopRole, navigate)}>
              {ROLES.map(({ role: r, label, icon: Icon }) => (
                <DropdownMenuRadioItem key={r} value={r}>
                  <Icon /> {label}
                  {role && r !== role && <DropdownMenuShortcut>Ctrl+Shift+D</DropdownMenuShortcut>}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuLabel className="label py-1 text-muted-foreground">Signed In</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={current?.id} onValueChange={(id) => void useAccounts.getState().switchAccount(id)}>
          {accounts.map((account) => (
            <DropdownMenuRadioItem key={account.id} value={account.id} {...drag.item(account.id)} className={drag.marker(account.id)}>
              <AccountAvatar account={account} current={account.id === current?.id} className="size-5 text-[9px]" />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate">{accountName(account)}</span>
                {account.plays?.length ? (
                  <span className="truncate text-[11px] text-muted-foreground">Plays {account.plays.join(' & ')}</span>
                ) : (
                  account.email && <span className="truncate text-[11px] text-muted-foreground">{account.email}</span>
                )}
              </span>
              {invites[account.id] ? <span className="shrink-0 rounded-full bg-primary px-1.5 py-px font-mono text-[10px] text-primary-foreground">{invitesLabel(invites[account.id]!)}</span> : null}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuItem onSelect={() => ui.openAccount({ kind: 'add' })}>
          <UserPlusIcon /> Add Another Account…
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <SunMoonIcon /> Appearance
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={(value) => usePreferences.getState().setPreference('theme', value as ThemeSource)}>
              {THEMES.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => ui.setHelp(true)}>
          <KeyboardIcon /> Keyboard Shortcuts
          <DropdownMenuShortcut>Shift+/</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => ui.setSettings(true)}>
          <SettingsIcon /> Settings
          <DropdownMenuShortcut>Ctrl+,</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <DropdownMenuItem disabled={accounts.length < 2} onSelect={() => current && ui.openAccount({ kind: 'signOut', id: current.id })}>
          <LogOutIcon /> Sign Out
          {accounts.length < 2 && <DropdownMenuShortcut>Only Account</DropdownMenuShortcut>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

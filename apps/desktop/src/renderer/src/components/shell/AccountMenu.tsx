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
import type { DndRole } from '@/lib/model';
import { accountName, useAccounts, useCurrentAccount } from '@/stores/accounts';
import { usePreferences } from '@/stores/preferences';
import { useUi } from '@/stores/ui';
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
 * Out; in D&D, whether you're the DM or a player. Worlds are in the world menu
 * (the mark at the top).
 */
export function AccountMenu({ className }: { className: string }) {
  const current = useCurrentAccount();
  const accounts = useAccounts((s) => s.accounts).filter((a) => a.signedIn);
  const theme = usePreferences((s) => s.theme);
  const ui = useUi.getState();
  const focus = useMenuFocus();
  const name = accountName(current);
  const navigate = useNavigate();
  const role = useRole();
  const inDnd = useSection() === 'dnd';

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger aria-label={`Account: ${name}`} className={className} {...focus.trigger}>
            {accounts.length > 1 ? <AccountAvatar account={current} current className="size-7 text-[10px]" /> : <CircleUserRoundIcon className="size-[18px]" strokeWidth={1.75} />}
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">{name}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="right" align="end" sideOffset={10} className="w-72" {...focus.content}>
        <DropdownMenuLabel className="flex items-center gap-2.5 py-2 font-normal">
          <AccountAvatar account={current} current className="size-9 text-[13px]" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="truncate text-[12px] text-muted-foreground">{current?.email || 'On this computer'}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => current && ui.openAccount({ kind: 'settings', id: current.id })}>
          <UserCogIcon /> Account Settings…
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {inDnd && (
          <>
            <DropdownMenuLabel className="label py-1 text-muted-foreground">D&D View</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={role ?? ''} onValueChange={(next) => switchRole(next as DndRole, navigate)}>
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
            <DropdownMenuRadioItem key={account.id} value={account.id}>
              <AccountAvatar account={account} current={account.id === current?.id} className="size-5 text-[9px]" />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate">{accountName(account)}</span>
                {account.email && <span className="truncate text-[11px] text-muted-foreground">{account.email}</span>}
              </span>
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

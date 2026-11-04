import { create } from 'zustand';
import { openWorld } from '@/lib/actions';
import type { Account, AccountInput, AccountWorlds, Registry } from '../../../shared/ipc';
import { useVault } from './vault';

/**
 * Accounts store — the signed-in accounts and which one is open
 * (main/accounts.ts keeps them), and every account's worlds for the world
 * menu. Each account is its own vault, so opening another account saves
 * what's pending and reloads the app into it, on World Home. Opening another
 * world of the open account is instant (lib/actions.ts openWorld).
 */

type AccountsState = Registry & {
  /** Every signed-in account's worlds as last saved; the open account's come from the vault store instead. */
  worlds: AccountWorlds[];
  refreshWorlds: () => Promise<void>;
  /** Opens a world, switching accounts first if it's another account's. */
  openWorldOf: (accountId: string, worldId: string) => Promise<void>;
  /** Signs in another account (with the sample world, or a blank one) and opens it. */
  addAccount: (input: AccountInput, starter: boolean) => Promise<void>;
  updateAccount: (id: string, input: AccountInput) => Promise<void>;
  /** Signs a signed-out account back in and opens it. */
  signIn: (id: string) => Promise<void>;
  signOut: (id: string) => Promise<void>;
  switchAccount: (id: string) => Promise<void>;
};

const initial: Registry = window.api.config.registry ?? { activeId: 'default', accounts: [] };

/** Saves pending changes to the account they were made in, then reloads into the one main has opened. */
async function reloadInto(open: () => Promise<void>) {
  await useVault.getState().flush();
  await open();
  window.location.hash = '#/';
  window.location.reload();
}

export const useAccounts = create<AccountsState>((set, get) => ({
  ...initial,
  worlds: [],

  refreshWorlds: async () => set({ worlds: await window.api.accounts.worlds() }),

  openWorldOf: async (accountId, worldId) => {
    // Remembered for that account before the reload, so it opens on this world (in its section).
    const section = get().worlds.find((a) => a.accountId === accountId)?.worlds.find((w) => w.id === worldId)?.section;
    openWorld(worldId, accountId, section);
    if (accountId !== get().activeId) await get().switchAccount(accountId);
  },

  addAccount: async (input, starter) => {
    const { registry, id } = await window.api.accounts.add(input, starter);
    set(registry);
    await get().switchAccount(id);
  },

  updateAccount: async (id, input) => set(await window.api.accounts.update(id, input)),

  signIn: async (id) => {
    set(await window.api.accounts.signIn(id));
    await get().switchAccount(id);
  },

  signOut: async (id) => {
    await useVault.getState().flush();
    const { registry, reload } = await window.api.accounts.signOut(id);
    set(registry);
    if (reload) await reloadInto(async () => {});
  },

  switchAccount: async (id) => {
    if (id !== get().activeId) await reloadInto(() => window.api.accounts.switch(id));
  },
}));

/** The open account. */
export function useCurrentAccount(): Account | undefined {
  return useAccounts((s) => s.accounts.find((a) => a.id === s.activeId));
}

/** The name to show: the account's, else its email's, else (the first account) your computer's account name. */
export function accountName(account: Pick<Account, 'name' | 'email'> | undefined): string {
  return account?.name || account?.email.split('@')[0] || window.api.config.userName || 'You';
}

import { useMemo } from 'react';
import type { World } from '@/lib/model';
import { accountName, useAccounts } from '@/stores/accounts';
import type { Person } from './tokens/TokenPanel';

/**
 * Tabletop → Battle maps: the accounts in a campaign besides its owner (online:
 * its players), by name from this computer's accounts, for giving tokens to.
 */
export function useCampaignPeople(world: World | undefined): Person[] {
  const accounts = useAccounts((s) => s.accounts);
  return useMemo(
    () =>
      (world?.tabletop?.members ?? []).map((m) => {
        const account = accounts.find((a) => a.id === m.accountId);
        return { accountId: m.accountId, name: account ? accountName(account) : 'An account not on this computer' };
      }),
    [world, accounts],
  );
}

/** The account looking (this window's). */
export const currentAccount = (): string => window.api?.config?.registry?.activeId ?? 'default';

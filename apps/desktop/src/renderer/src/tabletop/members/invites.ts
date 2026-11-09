import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * The invites waiting on this computer, for the badges: how many campaigns
 * invite each account (main/table.ts), unanswered. The app menu's mark and
 * its Play tile show the open account's; the avatar shows a dot if any
 * account has one, and the account list says which.
 */

const useCounts = create<{ counts: Record<string, number> }>(() => ({ counts: {} }));
let listening = false;

/** Counts them again (an invite sent or answered, the window back in focus). */
export function refreshInvites() {
  void window.api.table?.inviteCounts?.().then((counts) => useCounts.setState({ counts }));
}

/** How many invites each account has, by id (none: left out), kept current. */
export function useInviteCounts(): Record<string, number> {
  useEffect(() => {
    if (listening || !window.api.table?.inviteCounts) return;
    listening = true;
    refreshInvites();
    window.addEventListener('focus', refreshInvites);
  }, []);
  return useCounts((s) => s.counts);
}

/** "1 invite", "3 invites". */
export const invitesLabel = (n: number) => `${n} ${n === 1 ? 'invite' : 'invites'}`;

/** A badge's dot, on the corner of what it's on (`className` places it). */
export const BADGE_DOT = 'pointer-events-none absolute size-2.5 rounded-full bg-primary ring-2 ring-rail';

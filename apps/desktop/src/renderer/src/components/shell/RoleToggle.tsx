import { useNavigate } from '@tanstack/react-router';
import { CrownIcon, UserRoundIcon, type LucideIcon } from 'lucide-react';
import { activeCharacter, openSection, setRole } from '@/lib/actions';
import type { DndRole } from '@/lib/model';
import { currentRole, currentSection } from '@/stores/preferences';
import { useUi } from '@/stores/ui';
import { modulesFor } from './modules';

export const ROLES: { role: DndRole; label: string; short: string; icon: LucideIcon; blurb: string }[] = [
  { role: 'dm', label: 'Dungeon Master', short: 'DM', icon: CrownIcon, blurb: 'Run the game: sessions to prep, encounters, the bestiary, every secret.' },
  { role: 'player', label: 'Player', short: 'Player', icon: UserRoundIcon, blurb: 'Play it: your character, your journal, the party, what the DM has shared.' },
];

/**
 * The DM / Player switch lives in four places: a second click on the D&D tile
 * in the app menu, the account menu, the view in the status bar, and Campaign
 * Home (Ctrl+Shift+D anywhere in D&D).
 *
 * Switches D&D between the DM's view and a player's: yours, not a
 * campaign's, so it works with no campaign at all (from another section, it
 * opens D&D first). A screen the new view doesn't have (a
 * player's on Encounters, a DM's on My Character) goes Home first, so it
 * doesn't bounce as the view changes.
 */
export function switchRole(role: DndRole, navigate: ReturnType<typeof useNavigate>) {
  const apply = () => setRole(role);
  if (currentSection() !== 'dnd') {
    useUi.getState().setFocus(false);
    void navigate({ to: '/' }).then(() => {
      openSection('dnd');
      apply();
    });
    return;
  }
  if (currentRole() === role) return;
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  const inCampaign = role === 'dm' || Boolean(activeCharacter()?.worldId);
  if (modulesFor('dnd', role, inCampaign).some((m) => m.match(path))) apply();
  else void navigate({ to: '/' }).then(apply);
}

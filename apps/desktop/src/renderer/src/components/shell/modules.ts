import {
  BookOpenIcon,
  CalendarDaysIcon,
  CameraIcon,
  CastleIcon,
  CircleUserIcon,
  ClapperboardIcon,
  ContactIcon,
  HomeIcon,
  LibraryBigIcon,
  MapIcon,
  MapPinIcon,
  NotebookPenIcon,
  PenLineIcon,
  ScrollTextIcon,
  ShieldIcon,
  SkullIcon,
  SwordsIcon,
  UserRoundIcon,
  UsersIcon,
  WalletIcon,
  WaypointsIcon,
  type LucideIcon,
} from 'lucide-react';
import { useRole, useSection, useWorld } from '@/lib/hooks';
import type { DndRole, Section } from '@/lib/model';

export type Module = { to: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

const starts = (prefix: string) => (path: string) => path === prefix || path.startsWith(`${prefix}/`);
const maps: Module = { to: '/maps', label: 'Maps', icon: MapIcon, match: starts('/maps') };
/** The Library, and the full Spells and Inventory pages it opens (they're part of it now). */
const compendium = (path: string) => ['/library', '/spells', '/items'].some((p) => starts(p)(path));

/**
 * Each section's modules, in rail order (Alt+1…9). D&D has two: the DM's
 * (running the game, everything open: sessions to prep, encounters, the
 * bestiary, the whole world and its timeline) and a player's (playing it,
 * like D&D Beyond: your character sheet as home (its spells and inventory
 * on it), the Library (every spell, item, creature and rule, the full
 * spell and item pages included), your journal and maps, and, once your character is in a campaign, its
 * party and what the DM has shared).
 */
export function modulesFor(section: Section, role: DndRole = 'dm', inCampaign = true): Module[] {
  if (section === 'film') {
    return [
      { to: '/', label: 'Production Home', icon: ClapperboardIcon, match: (p) => p === '/' },
      { to: '/manuscript', label: 'Script', icon: ScrollTextIcon, match: starts('/manuscript') },
      { to: '/shots', label: 'Shots', icon: CameraIcon, match: starts('/shots') },
      { to: '/schedule', label: 'Schedule', icon: CalendarDaysIcon, match: starts('/schedule') },
      { to: '/budget', label: 'Budget', icon: WalletIcon, match: starts('/budget') },
      { to: '/bible/character', label: 'Cast', icon: UsersIcon, match: starts('/bible/character') },
      { to: '/bible/crew', label: 'Crew', icon: ContactIcon, match: starts('/bible/crew') },
      { to: '/bible/place', label: 'Locations', icon: MapPinIcon, match: starts('/bible/place') },
    ];
  }
  if (section === 'dnd' && role === 'player') {
    return [
      { to: '/', label: 'Character', icon: UserRoundIcon, match: (p) => p === '/' || p.startsWith('/sheet/') || p === '/create' },
      { to: '/manuscript', label: 'Journal', icon: NotebookPenIcon, match: starts('/manuscript') },
      { to: '/library', label: 'Library', icon: LibraryBigIcon, match: compendium },
      // Maps sit below Places (after the Library when there's no campaign, so no Places).
      ...(inCampaign
        ? [
            { to: '/party', label: 'Party', icon: ShieldIcon, match: starts('/party') },
            { to: '/bible/character', label: 'NPCs', icon: UsersIcon, match: starts('/bible/character') },
            { to: '/bible/place', label: 'Places', icon: MapPinIcon, match: starts('/bible/place') },
            maps,
            { to: '/bible/lore', label: 'Lore', icon: BookOpenIcon, match: starts('/bible/lore') },
          ]
        : [maps]),
    ];
  }
  if (section === 'dnd') {
    return [
      { to: '/', label: 'Campaign Home', icon: CastleIcon, match: (p) => p === '/' },
      { to: '/manuscript', label: 'Sessions', icon: ScrollTextIcon, match: starts('/manuscript') },
      { to: '/encounters', label: 'Encounters', icon: SwordsIcon, match: starts('/encounters') },
      { to: '/bestiary', label: 'Bestiary', icon: SkullIcon, match: starts('/bestiary') },
      { to: '/library', label: 'Library', icon: LibraryBigIcon, match: compendium },
      { to: '/party', label: 'Party', icon: ShieldIcon, match: starts('/party') },
      { to: '/bible/character', label: 'NPCs', icon: UsersIcon, match: starts('/bible/character') },
      { to: '/bible/place', label: 'Places', icon: MapPinIcon, match: starts('/bible/place') },
      maps,
      { to: '/bible/lore', label: 'Lore', icon: BookOpenIcon, match: starts('/bible/lore') },
      { to: '/timeline', label: 'Timeline', icon: WaypointsIcon, match: starts('/timeline') },
    ];
  }
  return [
    { to: '/', label: 'World Home', icon: HomeIcon, match: (p) => p === '/' },
    { to: '/manuscript', label: 'Manuscript', icon: PenLineIcon, match: starts('/manuscript') },
    { to: '/bible/character', label: 'Characters', icon: CircleUserIcon, match: starts('/bible/character') },
    { to: '/bible/place', label: 'Places', icon: MapPinIcon, match: starts('/bible/place') },
    { to: '/bible/lore', label: 'Lore', icon: BookOpenIcon, match: starts('/bible/lore') },
    { to: '/timeline', label: 'Timeline', icon: WaypointsIcon, match: starts('/timeline') },
  ];
}

/** The modules shown now: the open section's, for the open campaign's role. */
export function useModules(): Module[] {
  const section = useSection();
  const role = useRole() ?? 'dm';
  const inCampaign = Boolean(useWorld());
  return modulesFor(section, role, inCampaign);
}

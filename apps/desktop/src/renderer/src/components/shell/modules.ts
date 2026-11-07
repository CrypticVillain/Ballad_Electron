import {
  BookOpenIcon,
  CalendarDaysIcon,
  CameraIcon,
  CastleIcon,
  CircleUserIcon,
  ClapperboardIcon,
  ContactIcon,
  DicesIcon,
  FileSignatureIcon,
  FilmIcon,
  Grid3x3Icon,
  HomeIcon,
  LibraryBigIcon,
  ListChecksIcon,
  MapIcon,
  MapPinIcon,
  MusicIcon,
  NetworkIcon,
  NotebookPenIcon,
  NotebookTextIcon,
  PackageIcon,
  PenLineIcon,
  ScrollTextIcon,
  ShieldIcon,
  SkullIcon,
  SplineIcon,
  SwordsIcon,
  UserRoundIcon,
  UsersIcon,
  WalletIcon,
  WandSparklesIcon,
  WaypointsIcon,
  type LucideIcon,
} from 'lucide-react';
import { useRole, useSection, useWorld } from '@/lib/hooks';
import type { TabletopRole, Section } from '@/lib/model';

export type Module = { to: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

const starts = (prefix: string) => (path: string) => path === prefix || path.startsWith(`${prefix}/`);
const maps: Module = { to: '/maps', label: 'Maps', icon: MapIcon, match: starts('/maps') };
/** The name generator (names/), in Writing and Tabletop, last on the rail. */
const names: Module = { to: '/names', label: 'Names', icon: WandSparklesIcon, match: starts('/names') };
/** The Library, and the full Spells and Inventory pages it opens (they're part of it now). */
const compendium = (path: string) => ['/library', '/spells', '/items'].some((p) => starts(p)(path));

/**
 * Each section's modules, in rail order (Alt+1…9). Play has its Home (the
 * campaigns to play), Scenes and Music: the GM sets the table up here, and
 * the session opens in a window of its own. Tabletop has two: the GM's
 * (running the game, everything open: sessions to prep, encounters, the
 * bestiary, the whole world and its timeline) and a player's (playing it,
 * like an online character-sheet app: your character sheet as home (its spells and inventory
 * on it), the Library (every spell, item, creature and rule, the full
 * spell and item pages included), your Bestiary (creatures you've copied
 * from the Library or written up, and those the GM shares), your journal and
 * maps, and, once your character is in a campaign, its party and what the GM
 * has shared).
 */
export function modulesFor(section: Section, role: TabletopRole = 'gm', inCampaign = true): Module[] {
  if (section === 'film') {
    return [
      { to: '/', label: 'Production Home', icon: ClapperboardIcon, match: (p) => p === '/' },
      { to: '/manuscript', label: 'Script', icon: ScrollTextIcon, match: (p) => starts('/manuscript')(p) || starts('/film/reports')(p) },
      { to: '/film/breakdown', label: 'Breakdown', icon: ListChecksIcon, match: starts('/film/breakdown') },
      { to: '/shots', label: 'Shots', icon: CameraIcon, match: starts('/shots') },
      // Call sheets are a schedule's paperwork: Schedule lights up for them too.
      { to: '/schedule', label: 'Schedule', icon: CalendarDaysIcon, match: (p) => starts('/schedule')(p) || starts('/film/callsheets')(p) },
      { to: '/budget', label: 'Budget', icon: WalletIcon, match: starts('/budget') },
      { to: '/bible/character', label: 'Cast', icon: UsersIcon, match: starts('/bible/character') },
      { to: '/bible/crew', label: 'Crew', icon: ContactIcon, match: starts('/bible/crew') },
      { to: '/bible/place', label: 'Locations', icon: MapPinIcon, match: starts('/bible/place') },
      { to: '/film/gear', label: 'Gear', icon: PackageIcon, match: starts('/film/gear') },
      { to: '/film/releases', label: 'Releases', icon: FileSignatureIcon, match: starts('/film/releases') },
      { to: '/film/post', label: 'Post', icon: FilmIcon, match: starts('/film/post') },
    ];
  }
  if (section === 'play') {
    // Play (play/): Tabletop's campaigns at the table.
    return [
      { to: '/', label: 'Play Home', icon: DicesIcon, match: (p) => p === '/' },
      { to: '/scenes', label: 'Scenes', icon: Grid3x3Icon, match: starts('/scenes') },
      { to: '/play/music', label: 'Music', icon: MusicIcon, match: starts('/play/music') },
    ];
  }
  if (section === 'tabletop' && role === 'player') {
    return [
      { to: '/', label: 'Character', icon: UserRoundIcon, match: (p) => p === '/' || p.startsWith('/sheet/') || p === '/create' },
      { to: '/manuscript', label: 'Journal', icon: NotebookPenIcon, match: starts('/manuscript') },
      { to: '/library', label: 'Library', icon: LibraryBigIcon, match: compendium },
      { to: '/bestiary', label: 'Bestiary', icon: SkullIcon, match: starts('/bestiary') },
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
      names,
    ];
  }
  if (section === 'tabletop') {
    return [
      { to: '/', label: 'Campaign Home', icon: CastleIcon, match: (p) => p === '/' },
      { to: '/manuscript', label: 'Sessions', icon: ScrollTextIcon, match: starts('/manuscript') },
      { to: '/library', label: 'Library', icon: LibraryBigIcon, match: compendium },
      { to: '/encounters', label: 'Encounters', icon: SwordsIcon, match: starts('/encounters') },
      { to: '/bestiary', label: 'Bestiary', icon: SkullIcon, match: starts('/bestiary') },
      { to: '/party', label: 'Party', icon: ShieldIcon, match: starts('/party') },
      { to: '/bible/character', label: 'NPCs', icon: UsersIcon, match: starts('/bible/character') },
      { to: '/bible/place', label: 'Places', icon: MapPinIcon, match: starts('/bible/place') },
      maps,
      { to: '/bible/lore', label: 'Lore', icon: BookOpenIcon, match: starts('/bible/lore') },
      { to: '/timeline', label: 'Timeline', icon: WaypointsIcon, match: starts('/timeline') },
      names,
    ];
  }
  return [
    { to: '/', label: 'World Home', icon: HomeIcon, match: (p) => p === '/' },
    { to: '/manuscript', label: 'Manuscript', icon: PenLineIcon, match: starts('/manuscript') },
    { to: '/bible/character', label: 'Characters', icon: CircleUserIcon, match: starts('/bible/character') },
    { to: '/bible/place', label: 'Places', icon: MapPinIcon, match: starts('/bible/place') },
    // Writing's own maps (writing/maps), not Tabletop's.
    { to: '/writing/maps', label: 'Maps', icon: MapIcon, match: starts('/writing/maps') },
    { to: '/bible/lore', label: 'Lore', icon: BookOpenIcon, match: starts('/bible/lore') },
    { to: '/writing/relationships', label: 'Relationships', icon: NetworkIcon, match: starts('/writing/relationships') },
    { to: '/writing/arcs', label: 'Arcs', icon: SplineIcon, match: starts('/writing/arcs') },
    { to: '/timeline', label: 'Timeline', icon: WaypointsIcon, match: starts('/timeline') },
    { to: '/writing/calendar', label: 'Calendar', icon: CalendarDaysIcon, match: starts('/writing/calendar') },
    { to: '/writing/research', label: 'Research', icon: NotebookTextIcon, match: starts('/writing/research') },
    names,
  ];
}

/** The modules shown now: the open section's, for the open campaign's role. */
export function useModules(): Module[] {
  const section = useSection();
  const role = useRole() ?? 'gm';
  const inCampaign = Boolean(useWorld());
  return modulesFor(section, role, inCampaign);
}

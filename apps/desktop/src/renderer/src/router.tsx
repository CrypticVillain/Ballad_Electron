/**
 * router.tsx — the app's screens (TanStack Router, declared in code; hash
 * history because the built app loads from file://). The open section
 * (Writing, Filmmaking, Tabletop) decides which of them the rail offers.
 *
 *   /                          Home: World Home, Production Home, Campaign Home (GM) or your character sheet (Player)
 *   /manuscript                opens the scene (script scene, session) you last worked on
 *   /manuscript/$sceneId       writing it (binder, text, scene panel)
 *   /bible/$kind               characters / cast / NPCs, places / locations, lore, crew: opens the first entry
 *   /bible/$kind/$entryId      an entry's sheet
 *   /timeline?event=…          the timeline (event = the selected one) · Writing, Tabletop
 *
 *   Writing (each module its own folder: writing/<module>)
 *   /writing/maps, /writing/maps/$mapId   a world's maps, pins, and closer maps
 *   /writing/relationships                the relationship web
 *   /writing/arcs?book=…                  a book's arcs, scene by scene
 *   /writing/calendar                     the world's own calendar
 *   /writing/research, /writing/research/$noteId   research notes
 *
 *   /names                     the name generator, by genre (Writing and Tabletop)
 *
 *   Filmmaking (each module its own folder: film/<module>)
 *   /shots?scene=…&view=board  the shot list (scene = just that scene's), or its storyboard
 *   /schedule?view=…           shoot days; the stripboard (strips); Day Out Of Days (dood)
 *   /budget                    costs and income
 *   /film/breakdown?scene=…    the script broken down: what each scene needs
 *   /film/callsheets?day=…     a shoot day's call sheet
 *   /film/reports              the script counted: characters, sets, day and night
 *   /film/gear                 the kit
 *   /film/releases             release forms: cast, locations, others
 *   /film/post?tab=…           visual effects, music cues (music), cuts (cuts)
 *
 *   Tabletop
 *   /party, /party/$pcId                   the party's character sheets (a player sees the others' read-only)
 *   /sheet/$tab                            the character you play, on a tab (Player: / is its Actions)
 *   /encounters, /encounters/$encounterId  encounters and the initiative tracker (GM)
 *   /bestiary, /bestiary/$monsterId        creatures' stat blocks (GM)
 *   /maps, /maps/$mapId                    maps with pins: the campaign's (GM, shared) and a player's own
 *   /create                                the character creator (Player), skippable
 *   /library/$kind?id=…                    the Library: open-licensed monsters, spells, items, feats, maps… and their sources
 *   /spells?id=…, /items?id=…              every spell and item (the SRD's and your homebrew), to search, add to your character, edit (Player)
 *
 *   Play (Tabletop's campaigns at the table): / is its Home, the campaigns to play;
 *   /scenes                                setting up the scenes (the board, tokens, fog, music)
 *   the session opens in a window of its own (play/window), outside the router, with the scenes' music
 */
import { ScenesPage } from '@/play/setup/ScenesPage';
import { createHashHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { AppShell } from '@/components/shell/AppShell';
import { BibleIndex, BibleScreen } from '@/screens/bible/BibleScreen';
import { BestiaryIndex, BestiaryScreen } from '@/screens/tabletop/BestiaryScreen';
import { CharacterCreator } from '@/screens/tabletop/CharacterCreator';
import { ItemsScreen, SpellsScreen } from '@/screens/tabletop/CompendiumScreen';
import { EncountersIndex, EncountersScreen } from '@/screens/tabletop/EncountersScreen';
import { PartyIndex, PartyScreen } from '@/screens/tabletop/PartyScreen';
import { PlayerSheetScreen } from '@/screens/tabletop/PlayerSheet';
import { BudgetScreen } from '@/film/budget/BudgetScreen';
import { MapScreen, MapsIndex } from '@/screens/maps/MapsScreen';
import { ScheduleScreen } from '@/film/schedule/ScheduleScreen';
import { ShotsScreen } from '@/film/shots/ShotsScreen';
import { BreakdownScreen } from '@/film/breakdown/BreakdownScreen';
import { CallSheetsScreen } from '@/film/callsheets/CallSheetsScreen';
import { GearScreen } from '@/film/gear/GearScreen';
import { PostScreen } from '@/film/post/PostScreen';
import { ReleasesScreen } from '@/film/releases/ReleasesScreen';
import { ReportsScreen } from '@/film/reports/ReportsScreen';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { LibraryIndex, LibraryScreen } from '@/screens/library/LibraryScreen';
import { ManuscriptIndex, ManuscriptScreen } from '@/screens/manuscript/ManuscriptScreen';
import { CorkboardScreen } from '@/writing/manuscript/Corkboard';
import { TimelineScreen } from '@/screens/timeline/TimelineScreen';
import { WritingMapScreen, WritingMapsIndex } from '@/writing/maps/MapsScreen';
import { RelationshipsScreen } from '@/writing/relationships/RelationshipsScreen';
import { ArcsScreen } from '@/writing/arcs/ArcsScreen';
import { CalendarScreen } from '@/writing/calendar/CalendarScreen';
import { ResearchIndex, ResearchScreen } from '@/writing/research/ResearchScreen';
import { NamesScreen } from '@/names/NamesScreen';

const rootRoute = createRootRoute({ component: AppShell });

/** `?id=…`: the entry picked on a list page. */
const pickId = (search: Record<string, unknown>): { id?: string } => (typeof search.id === 'string' ? { id: search.id } : {});

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomeScreen }),
  createRoute({ getParentRoute: () => rootRoute, path: '/manuscript', component: ManuscriptIndex }),
  createRoute({ getParentRoute: () => rootRoute, path: '/manuscript/$sceneId', component: ManuscriptScreen }),
  createRoute({ getParentRoute: () => rootRoute, path: '/corkboard/$bookId', component: CorkboardScreen }),
  createRoute({ getParentRoute: () => rootRoute, path: '/bible/$kind', component: BibleIndex }),
  createRoute({ getParentRoute: () => rootRoute, path: '/bible/$kind/$entryId', component: BibleScreen }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/timeline',
    component: TimelineScreen,
    validateSearch: (search: Record<string, unknown>): { event?: string; view?: 'days'; book?: string; scene?: string } => ({
      ...(typeof search.event === 'string' ? { event: search.event } : {}),
      ...(search.view === 'days' ? { view: 'days' as const } : {}),
      ...(typeof search.book === 'string' ? { book: search.book } : {}),
      ...(typeof search.scene === 'string' ? { scene: search.scene } : {}),
    }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/shots',
    component: ShotsScreen,
    validateSearch: (search: Record<string, unknown>): { scene?: string; view?: 'board' } => ({ ...(typeof search.scene === 'string' ? { scene: search.scene } : {}), ...(search.view === 'board' ? { view: 'board' as const } : {}) }),
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/writing/maps', component: WritingMapsIndex }),
  createRoute({ getParentRoute: () => rootRoute, path: '/writing/maps/$mapId', component: WritingMapScreen }),
  createRoute({ getParentRoute: () => rootRoute, path: '/writing/relationships', component: RelationshipsScreen }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/writing/arcs',
    component: ArcsScreen,
    validateSearch: (search: Record<string, unknown>): { book?: string } => (typeof search.book === 'string' ? { book: search.book } : {}),
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/writing/calendar', component: CalendarScreen }),
  createRoute({ getParentRoute: () => rootRoute, path: '/writing/research', component: ResearchIndex }),
  createRoute({ getParentRoute: () => rootRoute, path: '/writing/research/$noteId', component: ResearchScreen }),
  createRoute({ getParentRoute: () => rootRoute, path: '/names', component: NamesScreen }),
  createRoute({ getParentRoute: () => rootRoute, path: '/scenes', component: ScenesPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/schedule',
    component: ScheduleScreen,
    validateSearch: (search: Record<string, unknown>): { view?: 'strips' | 'dood' } => (search.view === 'strips' || search.view === 'dood' ? { view: search.view } : {}),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/film/breakdown',
    component: BreakdownScreen,
    validateSearch: (search: Record<string, unknown>): { scene?: string } => (typeof search.scene === 'string' ? { scene: search.scene } : {}),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/film/callsheets',
    component: CallSheetsScreen,
    validateSearch: (search: Record<string, unknown>): { day?: string } => (typeof search.day === 'string' ? { day: search.day } : {}),
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/film/reports', component: ReportsScreen }),
  createRoute({ getParentRoute: () => rootRoute, path: '/film/gear', component: GearScreen }),
  createRoute({ getParentRoute: () => rootRoute, path: '/film/releases', component: ReleasesScreen }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/film/post',
    component: PostScreen,
    validateSearch: (search: Record<string, unknown>): { tab?: 'music' | 'cuts' } => (search.tab === 'music' || search.tab === 'cuts' ? { tab: search.tab } : {}),
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/budget', component: BudgetScreen }),
  createRoute({ getParentRoute: () => rootRoute, path: '/party', component: PartyIndex }),
  createRoute({ getParentRoute: () => rootRoute, path: '/party/$pcId', component: PartyScreen }),
  createRoute({ getParentRoute: () => rootRoute, path: '/sheet/$tab', component: PlayerSheetScreen }),
  createRoute({ getParentRoute: () => rootRoute, path: '/encounters', component: EncountersIndex }),
  createRoute({ getParentRoute: () => rootRoute, path: '/encounters/$encounterId', component: EncountersScreen }),
  createRoute({ getParentRoute: () => rootRoute, path: '/maps', component: MapsIndex }),
  createRoute({ getParentRoute: () => rootRoute, path: '/maps/$mapId', component: MapScreen }),
  createRoute({ getParentRoute: () => rootRoute, path: '/create', component: CharacterCreator }),
  createRoute({ getParentRoute: () => rootRoute, path: '/library', component: LibraryIndex }),
  createRoute({ getParentRoute: () => rootRoute, path: '/library/$kind', component: LibraryScreen, validateSearch: pickId }),
  createRoute({ getParentRoute: () => rootRoute, path: '/spells', component: SpellsScreen, validateSearch: pickId }),
  createRoute({ getParentRoute: () => rootRoute, path: '/items', component: ItemsScreen, validateSearch: pickId }),
  createRoute({ getParentRoute: () => rootRoute, path: '/bestiary', component: BestiaryIndex }),
  createRoute({ getParentRoute: () => rootRoute, path: '/bestiary/$monsterId', component: BestiaryScreen }),
]);

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultPreload: 'intent',
  scrollRestoration: false,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

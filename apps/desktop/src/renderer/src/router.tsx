/**
 * router.tsx — the app's screens (TanStack Router, declared in code; hash
 * history because the built app loads from file://). The open section
 * (Writing, Filmmaking, D&D) decides which of them the rail offers.
 *
 *   /                          Home: World Home, Production Home, Campaign Home (DM) or your character sheet (Player)
 *   /manuscript                opens the scene (script scene, session) you last worked on
 *   /manuscript/$sceneId       writing it (binder, text, scene panel)
 *   /bible/$kind               characters / cast / NPCs, places / locations, lore, crew: opens the first entry
 *   /bible/$kind/$entryId      an entry's sheet
 *   /timeline?event=…          the timeline (event = the selected one) · Writing, D&D
 *
 *   Filmmaking
 *   /shots?scene=…             the shot list (scene = just that scene's)
 *   /schedule                  shoot days
 *   /budget                    costs and income
 *
 *   D&D
 *   /party, /party/$pcId                   the party's character sheets (a player sees the others' read-only)
 *   /sheet/$tab                            the character you play, on a tab (Player: / is its Actions)
 *   /encounters, /encounters/$encounterId  encounters and the initiative tracker (DM)
 *   /bestiary, /bestiary/$monsterId        creatures' stat blocks (DM)
 *   /maps, /maps/$mapId                    maps with pins: the campaign's (DM, shared) and a player's own
 *   /create                                the character creator (Player), skippable
 *   /library/$kind?id=…                    the Library: open-licensed monsters, spells, items, feats, maps… and their sources
 *   /spells?id=…, /items?id=…              every spell and item (the SRD's and your homebrew), to search, add to your character, edit (Player)
 */
import { createHashHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { AppShell } from '@/components/shell/AppShell';
import { BibleIndex, BibleScreen } from '@/screens/bible/BibleScreen';
import { BestiaryIndex, BestiaryScreen } from '@/screens/dnd/BestiaryScreen';
import { CharacterCreator } from '@/screens/dnd/CharacterCreator';
import { ItemsScreen, SpellsScreen } from '@/screens/dnd/CompendiumScreen';
import { EncountersIndex, EncountersScreen } from '@/screens/dnd/EncountersScreen';
import { PartyIndex, PartyScreen } from '@/screens/dnd/PartyScreen';
import { PlayerSheetScreen } from '@/screens/dnd/PlayerSheet';
import { BudgetScreen } from '@/screens/film/BudgetScreen';
import { MapScreen, MapsIndex } from '@/screens/maps/MapsScreen';
import { ScheduleScreen } from '@/screens/film/ScheduleScreen';
import { ShotsScreen } from '@/screens/film/ShotsScreen';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { LibraryIndex, LibraryScreen } from '@/screens/library/LibraryScreen';
import { ManuscriptIndex, ManuscriptScreen } from '@/screens/manuscript/ManuscriptScreen';
import { TimelineScreen } from '@/screens/timeline/TimelineScreen';

const rootRoute = createRootRoute({ component: AppShell });

/** `?id=…`: the entry picked on a list page. */
const pickId = (search: Record<string, unknown>): { id?: string } => (typeof search.id === 'string' ? { id: search.id } : {});

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomeScreen }),
  createRoute({ getParentRoute: () => rootRoute, path: '/manuscript', component: ManuscriptIndex }),
  createRoute({ getParentRoute: () => rootRoute, path: '/manuscript/$sceneId', component: ManuscriptScreen }),
  createRoute({ getParentRoute: () => rootRoute, path: '/bible/$kind', component: BibleIndex }),
  createRoute({ getParentRoute: () => rootRoute, path: '/bible/$kind/$entryId', component: BibleScreen }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/timeline',
    component: TimelineScreen,
    validateSearch: (search: Record<string, unknown>): { event?: string } => (typeof search.event === 'string' ? { event: search.event } : {}),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/shots',
    component: ShotsScreen,
    validateSearch: (search: Record<string, unknown>): { scene?: string } => (typeof search.scene === 'string' ? { scene: search.scene } : {}),
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/schedule', component: ScheduleScreen }),
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

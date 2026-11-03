/**
 * router.tsx — the app's screens (TanStack Router, declared in code; hash
 * history because the built app loads from file://).
 *
 *   /                          World Home: the open world, this week, the books
 *   /manuscript                opens the scene you last worked on
 *   /manuscript/$sceneId       writing a scene (binder, prose, scene panel)
 *   /bible/$kind               characters, places or lore: opens the first entry
 *   /bible/$kind/$entryId      an entry's sheet
 *   /timeline?event=…          the world's timeline (event = the selected one)
 */
import { createHashHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { AppShell } from '@/components/shell/AppShell';
import { BibleIndex, BibleScreen } from '@/screens/bible/BibleScreen';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { ManuscriptIndex, ManuscriptScreen } from '@/screens/manuscript/ManuscriptScreen';
import { TimelineScreen } from '@/screens/timeline/TimelineScreen';

const rootRoute = createRootRoute({ component: AppShell });

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

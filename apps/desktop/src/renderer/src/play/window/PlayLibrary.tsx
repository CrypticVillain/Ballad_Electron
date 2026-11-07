import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider, useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { NoSidebarSearch } from '@/components/shell/Sidebar';
import { LibraryIndex, LibraryScreen } from '@/screens/library/LibraryScreen';

/**
 * The Library in Play's window (the GM's: Library at the foot of the Scenes
 * sidebar). The window has no router of its own, and the Library's pages
 * are routes (/library/$kind?id=…), so it gets one in memory with just
 * those. It's kept while the window is open: back from a scene, the Library
 * is where it was left. A link out of the Library (a creature copied to the
 * Bestiary, then Open) is for the main window: it stays here and says so.
 */

const pickId = (search: Record<string, unknown>): { id?: string } => (typeof search.id === 'string' ? { id: search.id } : {});

function ElsewhereInTheApp() {
  const router = useRouter();
  useEffect(() => {
    toast('That’s In The Main Window', { description: 'Play’s window has the Library; the rest of Tabletop is in Ballad’s main window.' });
    router.history.back();
  }, [router]);
  return null;
}

let router: ReturnType<typeof makeRouter> | null = null;

function makeRouter() {
  const root = createRootRoute({ component: Outlet, notFoundComponent: ElsewhereInTheApp });
  return createRouter({
    routeTree: root.addChildren([
      createRoute({ getParentRoute: () => root, path: '/library', component: LibraryIndex }),
      createRoute({ getParentRoute: () => root, path: '/library/$kind', component: LibraryScreen, validateSearch: pickId }),
    ]),
    history: createMemoryHistory({ initialEntries: ['/library/monsters'] }),
    scrollRestoration: false,
  });
}

export function PlayLibrary() {
  router ??= makeRouter();
  return (
    <div className="flex min-w-0 flex-1">
      <NoSidebarSearch>
        {/* The Library's routes are the main router's too (the same ids): its hooks are typed against that one. */}
        <RouterProvider router={router as never} />
      </NoSidebarSearch>
    </div>
  );
}

import { Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Dialogs } from '@/components/shared/Dialogs';
import { ThemeSync } from '@/components/shared/ThemeSync';
import { Toaster } from '@/components/ui/sonner';
import { activeWorld, createScene, scenesInOrder } from '@/lib/actions';
import { byOrder, live } from '@/lib/model';
import { useUi } from '@/stores/ui';
import { useVault } from '@/stores/vault';
import { MODULES, Rail } from './Rail';
import { StatusBar } from './StatusBar';

/**
 * AppShell — the frame around every screen: module rail on the left, the
 * screen (each brings its own sidebar), the status bar along the bottom, and
 * the app-wide shortcuts and dialogs. Focus mode (the manuscript alone) hides
 * the rail and the status bar.
 */
export function AppShell() {
  useShortcuts();
  const focus = useUi((s) => s.focus);
  return (
    <div className="flex h-full flex-col bg-rail text-foreground">
      <ThemeSync />
      <div className="flex min-h-0 flex-1">
        {!focus && <Rail />}
        <div className="flex min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
      {!focus && <StatusBar />}
      <Dialogs />
      <Toaster position="bottom-right" offset={40} />
    </div>
  );
}

/**
 *   Ctrl+K search · Ctrl+N new scene · Ctrl+, settings · Alt+1…6 modules
 *   Ctrl+Shift+F focus mode (Esc leaves it)
 */
function useShortcuts() {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const ui = useUi.getState();
      if (mod && key === 'k') {
        event.preventDefault();
        ui.setSearch(true);
      } else if (mod && key === 'n') {
        event.preventDefault();
        const sceneId = newSceneHere();
        if (sceneId) void navigate({ to: '/manuscript/$sceneId', params: { sceneId } });
      } else if (mod && key === ',') {
        event.preventDefault();
        ui.setSettings(true);
      } else if (mod && event.shiftKey && key === 'f') {
        event.preventDefault();
        ui.setFocus(!ui.focus);
      } else if (event.key === 'Escape' && ui.focus) {
        ui.setFocus(false);
      } else if (event.altKey && /^[1-6]$/.test(event.key)) {
        event.preventDefault();
        void navigate({ to: MODULES[Number(event.key) - 1]!.to });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);
}

/** Ctrl+N: a new scene at the end of the act you're in (or of the open world's first book). */
function newSceneHere(): string | null {
  const vault = useVault.getState().vault;
  const match = /^#\/manuscript\/([^/?]+)/.exec(window.location.hash);
  const current = match ? vault.scenes[match[1]!] : undefined;
  if (current && !current.deletedAt) return createScene(current.bookId, current.partId).id;
  const world = activeWorld();
  const book = world && live(vault.books).filter((b) => b.worldId === world.id).sort(byOrder)[0];
  if (!book) return null;
  const last = scenesInOrder(book.id).at(-1);
  const partId = last?.partId ?? live(vault.parts).filter((p) => p.bookId === book.id).sort(byOrder).at(-1)?.id;
  return partId ? createScene(book.id, partId).id : null;
}

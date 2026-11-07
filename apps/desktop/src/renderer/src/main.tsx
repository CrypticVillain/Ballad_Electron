/**
 * Renderer entry — loads the open account's vault (on its first run: the
 * sample world, or one empty world for an account added without it), then
 * renders the router. Everything works offline: there is no server yet
 * (auth will come later).
 */
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createWorld } from '@/lib/actions';
import { seedStarterContent } from '@/lib/seed';
import { router } from '@/router';
import { editsPending } from '@/lib/idle';
import { updateShares } from '@/lib/shared';
import { PlayWindow } from '@/play/window/PlayWindow';
import { useVault, vaultIdle, type Change } from '@/stores/vault';
import './styles/globals.css';

// Test builds only (electron-vite build --mode test): scripts can change the vault as another device would, to see the app take it.
if (import.meta.env.MODE === 'test') Object.assign(window, { __ballad: { useVault, updateShares } });

// Whether everything's saved: the end-to-end tests wait for it (e2e/app.ts) rather than sleeping.
(window as unknown as { __balladIdle: () => boolean }).__balladIdle = () => vaultIdle() && editsPending() === 0;

// Play's own window (main/table.ts opens it): Play alone, a client of the table; it loads its campaign itself.
if (window.location.hash.startsWith('#/play-window')) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <TooltipProvider delayDuration={300}>
        <PlayWindow />
      </TooltipProvider>
    </StrictMode>,
  );
} else {
  const { fresh } = await useVault.getState().load();
  if (fresh) {
    if (window.api.config.starter) seedStarterContent();
    else createWorld({ name: 'My First World' });
  }
  // The table (main/table.ts): a Play window's changes to this account's campaigns come here to be saved,
  // and the file is written on request before Play reads it.
  window.api.table?.onChanges((changes) => useVault.getState().applyRemote(changes as Change[]));
  window.api.table?.onFlush(() => useVault.getState().flush());

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <TooltipProvider delayDuration={300}>
        <RouterProvider router={router} />
      </TooltipProvider>
    </StrictMode>,
  );
}

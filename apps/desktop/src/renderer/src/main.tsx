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
import { updateShares } from '@/lib/shared';
import { useVault } from '@/stores/vault';
import './styles/globals.css';

// Test builds only (electron-vite build --mode test): scripts can change the vault as another device would, to see the app take it.
if (import.meta.env.MODE === 'test') Object.assign(window, { __ballad: { useVault, updateShares } });

const { fresh } = await useVault.getState().load();
if (fresh) {
  if (window.api.config.starter) seedStarterContent();
  else createWorld({ name: 'My First World' });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={300}>
      <RouterProvider router={router} />
    </TooltipProvider>
  </StrictMode>,
);

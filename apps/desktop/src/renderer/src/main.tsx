/**
 * Renderer entry — loads the local vault (seeding starter content on first
 * run), then renders the router. Everything works offline: there is no
 * server yet (auth will come later).
 */
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import { seedStarterContent } from '@/lib/seed';
import { router } from '@/router';
import { useVault } from '@/stores/vault';
import './styles/globals.css';

const { fresh } = await useVault.getState().load();
if (fresh) seedStarterContent();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={300}>
      <RouterProvider router={router} />
    </TooltipProvider>
  </StrictMode>,
);

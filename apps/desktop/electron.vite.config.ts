/**
 * electron-vite builds three bundles:
 *   main      src/main      Node side: the window and the local vault file
 *   preload   src/preload   the small, typed bridge exposed as `window.api`
 *   renderer  src/renderer  the React app (Vite dev server with HMR in `npm run dev`)
 *
 * Every package is a devDependency, so it's bundled in (nothing to ship in
 * node_modules). Routes are declared in code (src/renderer/src/router.tsx).
 */
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import { resolve } from 'node:path';

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: { '@': resolve(__dirname, 'src/renderer/src') },
    },
    plugins: [react(), tailwindcss()],
  },
});

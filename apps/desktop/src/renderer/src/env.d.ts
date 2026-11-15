/// <reference types="vite/client" />
import type { BalladApi, BalladBridge } from '../../shared/ipc';

declare global {
  interface Window {
    /** Set by main.tsx before the app loads: the preload's bridge, with the config in. */
    api: BalladApi;
    /** The preload's bridge (preload/index.ts); the app uses window.api. */
    balladBridge: BalladBridge;
  }
}

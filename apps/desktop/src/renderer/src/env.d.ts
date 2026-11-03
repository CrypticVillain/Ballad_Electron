/// <reference types="vite/client" />
import type { BalladApi } from '../../shared/ipc';

declare global {
  interface Window {
    api: BalladApi;
  }
}

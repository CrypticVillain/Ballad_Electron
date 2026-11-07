/**
 * test-env.ts — a stand-in for the preload's `window.api`, so unit tests can
 * load the vault store and actions under plain Node. Import it first in a
 * test file, before anything that imports the store.
 */
import type { BalladApi } from '../../../shared/ipc';

const api = {
  config: { registry: { activeId: 'default', accounts: [] } },
  vault: {
    load: async () => null,
    save: async () => {},
    saveSync: () => {},
    reveal: () => {},
  },
} as unknown as BalladApi;

Object.assign(globalThis, { window: { api, addEventListener: () => {} } });

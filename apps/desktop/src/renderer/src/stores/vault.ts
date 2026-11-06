import { create } from 'zustand';
import { migrate } from '@/lib/migrate';
import { emptyVault, now, type Collection, type RecordOf, type Vault } from '@/lib/model';

/**
 * Vault store — all of the user's data, held in memory and written to the
 * local vault file (main/vault.ts) a moment after each change.
 *
 *   load()                 reads the file at startup (true = first run: main.tsx then seeds starter content);
 *                          an older vault is brought up to date (lib/migrate.ts) and written back
 *   put / patch / remove   the only ways to change data; everything in lib/actions.ts uses them
 *   flush()                writes a pending save now (before switching accounts)
 *
 * Nothing here talks to a server. When sync arrives it can diff records by
 * updatedAt / deletedAt, which every change below keeps up to date.
 */

type SaveState = 'saved' | 'saving' | 'error';

type VaultState = {
  status: 'loading' | 'ready';
  saveState: SaveState;
  vault: Vault;
  load: () => Promise<{ fresh: boolean }>;
  put: <C extends Collection>(collection: C, record: RecordOf<C>) => void;
  patch: <C extends Collection>(collection: C, id: string, changes: Partial<RecordOf<C>>) => void;
  /** Soft delete: sets deletedAt (lists hide it; the Trash shows it). */
  remove: (collection: Collection, id: string) => void;
  /** Undoes remove(): clears deletedAt. */
  restore: (collection: Collection, id: string) => void;
  /** Hard delete: the record leaves the vault (Trash → Delete Forever / Empty Trash). */
  purge: (collection: Collection, id: string) => void;
  /** Replaces the whole vault (import, reset). */
  replace: (vault: Vault) => void;
  flush: () => Promise<void>;
};

export const useVault = create<VaultState>((set, get) => ({
  status: 'loading',
  saveState: 'saved',
  vault: emptyVault(),

  load: async () => {
    let vault: Vault | null = null;
    let upgraded = false;
    try {
      const text = await window.api.vault.load();
      if (text) {
        const saved = JSON.parse(text) as Partial<Vault>;
        vault = migrate(saved);
        upgraded = (saved.version ?? 1) < vault.version;
      }
    } catch (error) {
      console.error('Could not read the vault; starting a new one.', error);
    }
    set({ vault: vault ?? emptyVault(), status: 'ready' });
    // An older vault, brought up to date: written back now, so the file is in the new shape.
    if (upgraded) scheduleSave();
    return { fresh: !vault };
  },

  put: (collection, record) => {
    set((s) => ({ vault: { ...s.vault, [collection]: { ...s.vault[collection], [record.id]: record } } }));
    scheduleSave();
  },

  patch: (collection, id, changes) => {
    const current = get().vault[collection][id];
    if (!current) return;
    const next = { ...current, ...changes, updatedAt: now() };
    set((s) => ({ vault: { ...s.vault, [collection]: { ...s.vault[collection], [id]: next } } }));
    scheduleSave();
  },

  remove: (collection, id) => {
    const current = get().vault[collection][id];
    if (!current) return;
    const stamp = now();
    set((s) => ({
      vault: { ...s.vault, [collection]: { ...s.vault[collection], [id]: { ...current, deletedAt: stamp, updatedAt: stamp } } },
    }));
    scheduleSave();
  },

  restore: (collection, id) => {
    const current = get().vault[collection][id];
    if (!current?.deletedAt) return;
    set((s) => ({
      vault: { ...s.vault, [collection]: { ...s.vault[collection], [id]: { ...current, deletedAt: null, updatedAt: now() } } },
    }));
    scheduleSave();
  },

  purge: (collection, id) => {
    if (!get().vault[collection][id]) return;
    set((s) => {
      const { [id]: _gone, ...rest } = s.vault[collection];
      return { vault: { ...s.vault, [collection]: rest } };
    });
    scheduleSave();
  },

  replace: (vault) => {
    set({ vault: migrate(vault) });
    scheduleSave();
  },

  flush: async () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    await window.api.vault.save(JSON.stringify(get().vault));
    set({ saveState: 'saved' });
  },
}));

// ── Saving ────────────────────────────────────────────────────────────────
// Debounced: a burst of edits (typing in a page) becomes one write. If the
// window closes with a save pending, it's written synchronously on the way out.

const SAVE_DELAY = 400;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Nothing waiting to be written, and nothing being written (lib/idle.ts: what the end-to-end tests wait for). */
export function vaultIdle(): boolean {
  return !timer && useVault.getState().saveState !== 'saving';
}

function scheduleSave() {
  if (timer) clearTimeout(timer);
  useVault.setState({ saveState: 'saving' });
  timer = setTimeout(() => {
    timer = null;
    window.api.vault
      .save(JSON.stringify(useVault.getState().vault))
      .then(() => {
        if (!timer) useVault.setState({ saveState: 'saved' });
      })
      .catch((error: unknown) => {
        console.error('Saving the vault failed', error);
        useVault.setState({ saveState: 'error' });
      });
  }, SAVE_DELAY);
}

window.addEventListener('beforeunload', () => {
  if (!timer) return;
  clearTimeout(timer);
  timer = null;
  window.api.vault.saveSync(JSON.stringify(useVault.getState().vault));
});

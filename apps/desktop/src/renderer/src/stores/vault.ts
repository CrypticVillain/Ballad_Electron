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
 *   applyRemote(changes)   takes records changed elsewhere (another window) without sending them back
 *
 * Every change is also a record-by-record message (Change): the main window
 * relays its own to an open Play window (main/table.ts, the stand-in for a
 * server), and takes the Play window's in. A Play window (setRemote) saves
 * nothing itself: its changes go to the campaign's owner, through the main
 * process. Records carry updatedAt / deletedAt, so a real server can diff them.
 */

/** A record changed (or, null, purged): what windows send each other. */
export type Change = { collection: Collection; id: string; record: unknown };

/** Where a Play window sends its changes in place of saving (null: this window saves its own vault). */
let remote: ((changes: Change[]) => void) | null = null;
export const setRemote = (sink: ((changes: Change[]) => void) | null) => {
  remote = sink;
};

/** After a change: saved here and relayed to a Play window, or (a Play window) sent to the owner. */
function changed(collection: Collection, id: string) {
  const change: Change = { collection, id, record: useVault.getState().vault[collection][id] ?? null };
  if (remote) return remote([change]);
  scheduleSave();
  window.api?.table?.relay([change]);
}

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
  /** Records changed in another window: taken in (and saved, unless this is a Play window), not sent back. */
  applyRemote: (changes: Change[]) => void;
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
    changed(collection, record.id);
  },

  patch: (collection, id, changes) => {
    const current = get().vault[collection][id];
    if (!current) return;
    const next = { ...current, ...changes, updatedAt: now() };
    set((s) => ({ vault: { ...s.vault, [collection]: { ...s.vault[collection], [id]: next } } }));
    changed(collection, id);
  },

  remove: (collection, id) => {
    const current = get().vault[collection][id];
    if (!current) return;
    const stamp = now();
    set((s) => ({
      vault: { ...s.vault, [collection]: { ...s.vault[collection], [id]: { ...current, deletedAt: stamp, updatedAt: stamp } } },
    }));
    changed(collection, id);
  },

  restore: (collection, id) => {
    const current = get().vault[collection][id];
    if (!current?.deletedAt) return;
    set((s) => ({
      vault: { ...s.vault, [collection]: { ...s.vault[collection], [id]: { ...current, deletedAt: null, updatedAt: now() } } },
    }));
    changed(collection, id);
  },

  purge: (collection, id) => {
    if (!get().vault[collection][id]) return;
    set((s) => {
      const { [id]: _gone, ...rest } = s.vault[collection];
      return { vault: { ...s.vault, [collection]: rest } };
    });
    changed(collection, id);
  },

  replace: (vault) => {
    set({ vault: migrate(vault) });
    if (!remote) scheduleSave();
  },

  applyRemote: (changes) => {
    set((s) => {
      const vault = { ...s.vault };
      for (const { collection, id, record } of changes) {
        if (!(collection in vault)) continue;
        const map = { ...(vault[collection] as Record<string, unknown>) };
        if (record) map[id] = record;
        else delete map[id];
        (vault as Record<string, unknown>)[collection] = map;
      }
      return { vault };
    });
    if (!remote) scheduleSave();
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

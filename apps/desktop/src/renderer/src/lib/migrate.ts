/**
 * migrate.ts — brings a saved vault (any older version, or partial) up to
 * VAULT_VERSION. The vault store runs it on load and on replace; each step
 * only fills in what that version added, so running it twice is harmless.
 *
 * Version 1 is the first: so far this only fills in missing collections.
 */
import { emptyVault, VAULT_VERSION, type Vault } from './model';

export function migrate(raw: Partial<Vault>): Vault {
  const vault = { ...emptyVault(), ...raw };
  vault.version = VAULT_VERSION;
  return vault;
}

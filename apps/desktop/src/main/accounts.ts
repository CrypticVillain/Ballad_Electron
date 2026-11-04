/**
 * accounts.ts — the accounts signed in to Ballad (Overture's workspaces.ts,
 * for a writing app: in Ballad an account's worlds live in its one vault).
 *
 * Accounts are kept on this computer until sign-in arrives. Several can be
 * signed in at once; the open one is the current account. Each has its own
 * vault (vault.ts) in its own folder:
 *
 *   the first   userData/vault (where the vault was before accounts existed)
 *   the rest    userData/accounts/<id>
 *
 * Signing out hides an account (its vault stays) until it signs back in.
 * All of it is saved in userData/accounts.json, in the order accounts were added.
 */
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Account, AccountInput, AccountWorlds, Registry } from '../shared/ipc';

type AccountEntry = Account & { starter: boolean };
type Saved = { activeId: string; accounts: AccountEntry[] };

const DEFAULT_ID = 'default';
const MAX_NAME = 60;

const registryFile = () => path.join(app.getPath('userData'), 'accounts.json');
const newId = () => randomUUID().slice(0, 8);

let saved: Saved | null = null;

function read(): Saved {
  if (saved) return saved;
  try {
    const file = JSON.parse(fs.readFileSync(registryFile(), 'utf8')) as Partial<Saved>;
    if (Array.isArray(file.accounts) && file.accounts.length) saved = { activeId: file.activeId ?? '', accounts: file.accounts };
  } catch {
    // missing or unreadable: the one account there has always been
  }
  saved ??= { activeId: DEFAULT_ID, accounts: [{ id: DEFAULT_ID, name: '', email: '', signedIn: true, createdAt: Date.now(), starter: true }] };
  if (!signedIn().some((a) => a.id === saved!.activeId)) {
    // Every account signed out (a hand-edited file): sign the first one back in.
    if (!signedIn().length) saved.accounts[0]!.signedIn = true;
    saved.activeId = signedIn()[0]!.id;
  }
  return saved;
}

function write() {
  const file = registryFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(read(), null, 2), 'utf8');
  fs.renameSync(`${file}.tmp`, file);
}

const signedIn = () => saved!.accounts.filter((a) => a.signedIn);
const findAccount = (id: unknown) => read().accounts.find((a) => a.id === id);

function dirOf(id: string): string {
  return id === DEFAULT_ID ? path.join(app.getPath('userData'), 'vault') : path.join(app.getPath('userData'), 'accounts', id);
}

export function getRegistry(): Registry {
  const { activeId, accounts } = read();
  return { activeId, accounts: accounts.map(({ starter: _starter, ...account }) => account) };
}

/** The open account's folder: where vault.ts reads and writes. */
export function activeDir(): string {
  return dirOf(read().activeId);
}

/** Whether the open account's first vault should get the sample world (the first account, or one added with it). */
export function activeStarter(): boolean {
  return findAccount(read().activeId)?.starter ?? false;
}

/**
 * Every signed-in account's worlds, for the world menu: read from each
 * account's vault file (the open account's too, as last saved). Only the
 * names, ids, order and section (worlds from before sections are Writing's);
 * deleted worlds are left out.
 */
export function listWorlds(): AccountWorlds[] {
  return signedIn().map((account) => {
    let worlds: AccountWorlds['worlds'] = [];
    for (const name of ['vault.json', 'vault.backup.json']) {
      try {
        const vault = JSON.parse(fs.readFileSync(path.join(dirOf(account.id), name), 'utf8')) as { worlds?: Record<string, { id: string; name: string; order: number; section?: AccountWorlds['worlds'][number]['section']; deletedAt?: string | null }> };
        worlds = Object.values(vault.worlds ?? {})
          .filter((w) => !w.deletedAt)
          .sort((a, b) => a.order - b.order)
          .map((w) => ({ id: w.id, name: w.name, section: w.section ?? 'writing' }));
        break;
      } catch {
        // missing or half-written: try the backup
      }
    }
    return { accountId: account.id, worlds };
  });
}

function cleanName(name: unknown): string {
  return typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '';
}

function cleanAccount(input: unknown): AccountInput {
  const raw = (input ?? {}) as Partial<AccountInput>;
  return {
    name: cleanName(raw.name),
    email: typeof raw.email === 'string' ? raw.email.trim().toLowerCase().slice(0, 120) : '',
  };
}

/**
 * Signs in another account. An email that belongs to a signed-out account
 * signs that one back in (with its vault); a new one gets a vault of its
 * own, with the sample world if `starter`.
 */
export function addAccount(input: unknown, starter: unknown): { registry: Registry; id: string } {
  const clean = cleanAccount(input);
  const reg = read();
  let account = clean.email ? reg.accounts.find((a) => a.email === clean.email) : undefined;
  if (account) {
    account.signedIn = true;
    if (clean.name) account.name = clean.name;
  } else {
    account = { id: newId(), ...clean, signedIn: true, createdAt: Date.now(), starter: starter === true };
    reg.accounts.push(account);
  }
  write();
  return { registry: getRegistry(), id: account.id };
}

export function updateAccount(id: unknown, input: unknown): Registry {
  const account = findAccount(id);
  if (account) {
    const clean = cleanAccount(input);
    // Two accounts can't share an email.
    if (!clean.email || !read().accounts.some((a) => a !== account && a.email === clean.email)) Object.assign(account, clean);
    write();
  }
  return getRegistry();
}

export function signInAccount(id: unknown): Registry {
  const account = findAccount(id);
  if (account) {
    account.signedIn = true;
    write();
  }
  return getRegistry();
}

/** Never the last account signed in. If it's the open one, another account opens (the renderer reloads). */
export function signOutAccount(id: unknown): { registry: Registry; reload: boolean } {
  const account = findAccount(id);
  if (!account?.signedIn || signedIn().length < 2) return { registry: getRegistry(), reload: false };
  const current = read().activeId === account.id;
  account.signedIn = false;
  if (current) read().activeId = signedIn()[0]!.id;
  write();
  return { registry: getRegistry(), reload: current };
}

/** Makes a signed-in account the open one. The renderer reloads into its vault. */
export function openAccount(id: unknown): boolean {
  const account = findAccount(id);
  if (!account?.signedIn) return false;
  read().activeId = account.id;
  write();
  return true;
}

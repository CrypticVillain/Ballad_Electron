/**
 * files.ts — putting a freshly written temp file in a file's place.
 *
 * A vault is saved by writing a temp file beside it and renaming that over
 * it, so a crash mid-write never leaves half a vault. On Windows the rename
 * is refused (EPERM, EBUSY, EACCES) while anything else has the file open,
 * even for an instant: a virus scanner, the search indexer, a backup tool,
 * another read of the vault. That passes in milliseconds, so the rename is
 * tried again for up to about half a second before it's given up on.
 */
import fs from 'node:fs';

const BUSY = new Set(['EPERM', 'EBUSY', 'EACCES']);
const TRIES = 40;
const WAIT_MS = 15;

const busy = (error: unknown) => BUSY.has((error as NodeJS.ErrnoException)?.code ?? '');

/** Waits without yielding (the callers are synchronous: a save as the window closes, the table's deliveries). */
const pause = (ms: number) => void Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Renames `temp` over `file`, trying again while the file is briefly held by something else. */
export function replaceFileSync(temp: string, file: string): void {
  for (let i = 1; ; i++) {
    try {
      return fs.renameSync(temp, file);
    } catch (error) {
      if (i >= TRIES || !busy(error)) throw error;
      pause(WAIT_MS);
    }
  }
}

/** As replaceFileSync, without blocking between tries. */
export async function replaceFile(temp: string, file: string): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      return await fs.promises.rename(temp, file);
    } catch (error) {
      if (i >= TRIES || !busy(error)) throw error;
      await new Promise((done) => setTimeout(done, WAIT_MS));
    }
  }
}

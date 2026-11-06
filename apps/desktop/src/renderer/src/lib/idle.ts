/**
 * idle.ts — whether anything is still waiting to be written: a manuscript
 * editor's pause in typing (it saves 350 ms after the last key) and the
 * vault's own debounce (stores/vault.ts). The end-to-end tests wait for
 * this (window.__balladIdle, e2e/app.ts) instead of sleeping for a guess.
 */
let editing = 0;

/** An editor started waiting to save (once per pause, not per key). */
export function editPending() {
  editing += 1;
}

/** …and saved (or was taken off the page). */
export function editSaved() {
  editing = Math.max(0, editing - 1);
}

export function editsPending(): number {
  return editing;
}

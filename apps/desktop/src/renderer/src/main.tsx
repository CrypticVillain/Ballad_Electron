/**
 * Renderer entry — makes `window.api` (the preload's bridge, with the app's
 * config fetched from the main process), then loads the app (app.tsx).
 *
 * The config comes first because the app's modules read it as they load (the
 * open account, the installer's theme…). It's fetched, not read with a
 * synchronous call as the page loads: see BalladBridge in shared/ipc.ts.
 */
const bridge = window.balladBridge;
window.api = { ...bridge, config: await bridge.config() };

await import('./app');

export {};

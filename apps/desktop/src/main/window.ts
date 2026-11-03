/**
 * window.ts — the main window.
 *
 * Security defaults (keep them): the renderer is sandboxed, isolated from the
 * preload, and has no Node. Links that leave the app open in the browser, and
 * the window can't be navigated away from the app.
 */
import { BrowserWindow, nativeTheme, shell } from 'electron';
import { join } from 'node:path';
import { iconImage } from './appIcon';

/**
 * Shown before the page paints, so there's no white flash. Matches `--rail`
 * of the default style (Display) in src/renderer/src/styles/globals.css.
 */
const WINDOW_BACKGROUND = { light: '#ececec', dark: '#0a0a0a' };

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 600,
    show: false,
    title: 'Ballad',
    // The icon you picked (Settings → Appearance, or the installer).
    icon: iconImage(),
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? WINDOW_BACKGROUND.dark : WINDOW_BACKGROUND.light,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  window.once('ready-to-show', () => window.show());

  // target="_blank" / window.open → the user's browser, never a new Electron window.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
  return window;
}

/** Brings the window forward (a second launch, the Dock icon). */
export function showWindow(window: BrowserWindow | null) {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

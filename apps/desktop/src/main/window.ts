/**
 * window.ts — the main window.
 *
 * Security defaults (keep them): the renderer is sandboxed, isolated from the
 * preload, and has no Node. Links that leave the app open in the browser, and
 * the window can't be navigated away from the app.
 */
import { BrowserWindow, screen, shell } from 'electron';
import { join } from 'node:path';
import { iconImage } from './appIcon';
import { windowBackground } from './look';

/**
 * `--display=<n or name>` (the end-to-end tests pass 4): where the window
 * opens. 1 is the main monitor, 2 the next one, and so on, left to right
 * (then top to bottom); or a monitor by (part of) its name, like "ASUS". The
 * window is centered in it, made smaller if it doesn't fit. A monitor that
 * isn't there leaves it where it would have been. The Play window opens there
 * too (table.ts).
 */
export function onDisplay(width: number, height: number): { x: number; y: number; width: number; height: number } | null {
  const want = process.argv
    .find((a) => a.startsWith('--display='))
    ?.slice('--display='.length)
    .trim();
  if (!want) return null;
  const primary = screen.getPrimaryDisplay();
  const others = screen
    .getAllDisplays()
    .filter((d) => d.id !== primary.id)
    .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y);
  const all = [primary, ...others];
  const n = /^\d+$/.test(want) ? Number(want) : NaN;
  const display = Number.isFinite(n) ? all[n - 1] : all.find((d) => d.label.toLowerCase().includes(want.toLowerCase()));
  if (!display) return null;
  const area = display.workArea;
  const w = Math.min(width, area.width);
  const h = Math.min(height, area.height);
  return { x: Math.round(area.x + (area.width - w) / 2), y: Math.round(area.y + (area.height - h) / 2), width: w, height: h };
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1360,
    height: 860,
    ...onDisplay(1360, 860),
    minWidth: 980,
    minHeight: 600,
    show: false,
    title: 'Ballad',
    // The icon you picked (Settings → Appearance, or the installer).
    icon: iconImage(),
    autoHideMenuBar: true,
    // Shown before the page paints, so there's no flash: the open style's --rail (main/look.ts).
    backgroundColor: windowBackground(),
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

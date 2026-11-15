/**
 * Main process — app lifecycle.
 *
 *   profile.ts     --profile=<name>: a separate data folder (a second vault, for testing)
 *   identity.ts    the Windows app ID (taskbar icon); dev runs get their own
 *   appIcon.ts     the app icon you picked (dark, light or the system's), everywhere it shows
 *   window.ts      creates the main window (secure defaults, external links → browser)
 *   ipc.ts         answers the renderer's `window.api` calls (contract: src/shared/ipc.ts)
 *   accounts.ts    the signed-in accounts (each its own vault folder) and which one is open
 *   vault.ts       reads and writes the open account's vault file
 *   media.ts       images beside the vault (maps), served as ballad-media://
 *
 * One app instance per profile: opening it again brings the existing window back.
 */
import { app, BrowserWindow } from 'electron';
import { initAppIcon } from './appIcon';
import { applyAppIdentity } from './identity';
import { registerIpcHandlers } from './ipc';
import { handleMedia, registerMediaScheme } from './media';
import { applyProfile } from './profile';
import { createMainWindow, NO_FOCUS, showWindow } from './window';

applyProfile();
registerMediaScheme();

// --no-focus (the end-to-end tests): an error nothing caught is logged, not shown in Electron's error box,
// which takes the focus and stops the app until it's dismissed (with no one there to dismiss it).
if (NO_FOCUS) process.on('uncaughtException', (error) => console.error('Uncaught in the main process:', error));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let mainWindow: BrowserWindow | null = null;
  const openWindow = () => {
    mainWindow = createMainWindow();
    mainWindow.on('closed', () => (mainWindow = null));
  };

  app.on('second-instance', () => showWindow(mainWindow));

  app.whenReady().then(() => {
    applyAppIdentity();
    initAppIcon();
    registerIpcHandlers();
    handleMedia();
    openWindow();

    // macOS: clicking the dock icon makes a new window when there's none.
    app.on('activate', () => {
      if (mainWindow) showWindow(mainWindow);
      else openWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

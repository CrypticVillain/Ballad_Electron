/**
 * Main process — app lifecycle.
 *
 *   profile.ts     --profile=<name>: a separate data folder (a second vault, for testing)
 *   identity.ts    the Windows app ID (taskbar icon); dev runs get their own
 *   appIcon.ts     the app icon you picked (dark, light or the system's), everywhere it shows
 *   window.ts      creates the main window (secure defaults, external links → browser)
 *   ipc.ts         answers the renderer's `window.api` calls (contract: src/shared/ipc.ts)
 *   vault.ts       reads and writes the local vault file
 *
 * One app instance per profile: opening it again brings the existing window back.
 */
import { app, BrowserWindow } from 'electron';
import { initAppIcon } from './appIcon';
import { applyAppIdentity } from './identity';
import { registerIpcHandlers } from './ipc';
import { applyProfile } from './profile';
import { createMainWindow, showWindow } from './window';

applyProfile();

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

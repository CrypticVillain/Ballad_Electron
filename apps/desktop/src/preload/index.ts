/**
 * Preload — exposes `window.api` (type: BalladApi in src/shared/ipc.ts) to
 * the sandboxed renderer. Keep it a thin, explicit list of calls: never expose
 * ipcRenderer itself.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type AppConfig, type BalladApi } from '../shared/ipc';

const api: BalladApi = {
  config: ipcRenderer.sendSync(IPC.getConfig) as AppConfig,
  app: {
    setTheme: (theme) => ipcRenderer.send(IPC.setTheme, theme),
    setAppIcon: (choice) => ipcRenderer.send(IPC.setAppIcon, choice),
  },
  vault: {
    load: () => ipcRenderer.invoke(IPC.vaultLoad),
    save: (json) => ipcRenderer.invoke(IPC.vaultSave, json),
    saveSync: (json) => {
      ipcRenderer.sendSync(IPC.vaultSaveSync, json);
    },
    reveal: () => ipcRenderer.send(IPC.vaultReveal),
  },
  files: {
    saveText: (input) => ipcRenderer.invoke(IPC.saveText, input),
  },
};

contextBridge.exposeInMainWorld('api', api);

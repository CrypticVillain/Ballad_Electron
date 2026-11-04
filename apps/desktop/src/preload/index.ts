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
  accounts: {
    worlds: () => ipcRenderer.invoke(IPC.accountsWorlds),
    add: (input, starter) => ipcRenderer.invoke(IPC.accountsAdd, input, starter),
    update: (id, input) => ipcRenderer.invoke(IPC.accountsUpdate, id, input),
    signIn: (id) => ipcRenderer.invoke(IPC.accountsSignIn, id),
    signOut: (id) => ipcRenderer.invoke(IPC.accountsSignOut, id),
    switch: (id) => ipcRenderer.invoke(IPC.accountsSwitch, id),
  },
  files: {
    saveText: (input) => ipcRenderer.invoke(IPC.saveText, input),
    saveBinary: (input) => ipcRenderer.invoke(IPC.saveBinary, input),
    savePdf: (input) => ipcRenderer.invoke(IPC.savePdf, input),
    importMap: () => ipcRenderer.invoke(IPC.importMap),
    importLibraryMap: (input) => ipcRenderer.invoke(IPC.importLibraryMap, input),
    savePicture: (data, ext) => ipcRenderer.invoke(IPC.savePicture, data, ext),
  },
};

contextBridge.exposeInMainWorld('api', api);

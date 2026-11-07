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
    importMusic: () => ipcRenderer.invoke(IPC.importMusic),
    importLibraryMap: (input) => ipcRenderer.invoke(IPC.importLibraryMap, input),
    savePicture: (data, ext) => ipcRenderer.invoke(IPC.savePicture, data, ext),
  },
  table: {
    campaigns: () => ipcRenderer.invoke(IPC.tableCampaigns),
    open: (ownerId, worldId) => ipcRenderer.invoke(IPC.tableOpen, ownerId, worldId),
    load: (ownerId, worldId) => ipcRenderer.invoke(IPC.tableLoad, ownerId, worldId),
    send: (ownerId, changes) => ipcRenderer.send(IPC.tableSend, ownerId, changes),
    relay: (changes) => ipcRenderer.send(IPC.tableRelay, changes),
    onChanges: (listener) => {
      const handler = (_event: unknown, changes: Parameters<typeof listener>[0]) => listener(changes);
      ipcRenderer.on(IPC.tableChanges, handler);
      return () => ipcRenderer.removeListener(IPC.tableChanges, handler);
    },
    onFlush: (flush) => {
      ipcRenderer.on(IPC.vaultFlushNow, () => {
        void flush().finally(() => ipcRenderer.send(IPC.vaultFlushed));
      });
    },
  },
};

contextBridge.exposeInMainWorld('api', api);

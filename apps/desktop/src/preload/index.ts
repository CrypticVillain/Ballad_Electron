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
    reorder: (ids) => ipcRenderer.invoke(IPC.accountsReorder, ids),
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
    importLibraryMusic: (name) => ipcRenderer.invoke(IPC.importLibraryMusic, name),
    importLibraryMap: (input) => ipcRenderer.invoke(IPC.importLibraryMap, input),
    savePicture: (data, ext) => ipcRenderer.invoke(IPC.savePicture, data, ext),
    openManuscript: () => ipcRenderer.invoke(IPC.openManuscript),
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
    invites: () => ipcRenderer.invoke(IPC.tableInvites),
    answer: (ownerId, worldId, accept) => ipcRenderer.invoke(IPC.tableAnswer, ownerId, worldId, accept),
    syncSheets: (changes) => ipcRenderer.invoke(IPC.tableSyncSheets, changes),
    seed: (accountId, changes) => ipcRenderer.invoke(IPC.tableSeed, accountId, changes),
    playing: () => ipcRenderer.invoke(IPC.tablePlaying),
    onPlaying: (listener) => {
      const handler = (_event: unknown, playing: Parameters<typeof listener>[0]) => listener(playing);
      ipcRenderer.on(IPC.tablePlayingChanged, handler);
      return () => ipcRenderer.removeListener(IPC.tablePlayingChanged, handler);
    },
    act: (act) => ipcRenderer.invoke(IPC.tableAct, act),
    onAct: (listener) => {
      const handler = (_event: unknown, act: Parameters<typeof listener>[0]) => listener(act);
      ipcRenderer.on(IPC.tableActed, handler);
      return () => ipcRenderer.removeListener(IPC.tableActed, handler);
    },
    leave: (pcId, worldId) => ipcRenderer.invoke(IPC.tableLeave, pcId, worldId),
    leaveCampaign: (ownerId, worldId) => ipcRenderer.invoke(IPC.tableLeaveCampaign, ownerId, worldId),
    inviteCounts: () => ipcRenderer.invoke(IPC.tableInviteCounts),
    onFlush: (flush) => {
      ipcRenderer.on(IPC.vaultFlushNow, () => {
        void flush().finally(() => ipcRenderer.send(IPC.vaultFlushed));
      });
    },
  },
};

contextBridge.exposeInMainWorld('api', api);

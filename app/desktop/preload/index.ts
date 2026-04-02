import { contextBridge, ipcRenderer } from 'electron';

import type {
  DesktopBridge,
  DesktopRememberedAuthSession,
  DesktopWindowState,
} from '@shared/contracts/desktop.contract';

const DESKTOP_WINDOW_CHANNELS = {
  close: 'desktop-window:close',
  getState: 'desktop-window:get-state',
  minimize: 'desktop-window:minimize',
  stateChanged: 'desktop-window:state-changed',
  toggleMaximize: 'desktop-window:toggle-maximize',
} as const;

const DESKTOP_AUTH_STORAGE_CHANNELS = {
  clear: 'desktop-auth-storage:clear',
  get: 'desktop-auth-storage:get',
  isAvailable: 'desktop-auth-storage:is-available',
  set: 'desktop-auth-storage:set',
} as const;

const desktopBridge: DesktopBridge = {
  authStorage: {
    clearRememberedSession: () =>
      ipcRenderer.invoke(DESKTOP_AUTH_STORAGE_CHANNELS.clear) as Promise<void>,
    getRememberedSession: () =>
      ipcRenderer.invoke(
        DESKTOP_AUTH_STORAGE_CHANNELS.get,
      ) as Promise<DesktopRememberedAuthSession | null>,
    isPersistentStorageAvailable: () =>
      ipcRenderer.invoke(DESKTOP_AUTH_STORAGE_CHANNELS.isAvailable) as Promise<boolean>,
    setRememberedSession: (session) =>
      ipcRenderer.invoke(DESKTOP_AUTH_STORAGE_CHANNELS.set, session) as Promise<void>,
  },
  environment: process.env.VITE_DEV_SERVER_URL ? 'development' : 'production',
  isPackaged: !process.env.VITE_DEV_SERVER_URL,
  osVersion: process.getSystemVersion?.() ?? 'unknown',
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
  windowControls: {
    close: () => ipcRenderer.invoke(DESKTOP_WINDOW_CHANNELS.close) as Promise<void>,
    getState: () => ipcRenderer.invoke(DESKTOP_WINDOW_CHANNELS.getState),
    minimize: () => ipcRenderer.invoke(DESKTOP_WINDOW_CHANNELS.minimize) as Promise<void>,
    onStateChange: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, state: unknown) => {
        listener(state as DesktopWindowState);
      };

      ipcRenderer.on(DESKTOP_WINDOW_CHANNELS.stateChanged, handler);

      return () => {
        ipcRenderer.removeListener(DESKTOP_WINDOW_CHANNELS.stateChanged, handler);
      };
    },
    toggleMaximize: () => ipcRenderer.invoke(DESKTOP_WINDOW_CHANNELS.toggleMaximize),
  },
};

contextBridge.exposeInMainWorld('desktop', desktopBridge);

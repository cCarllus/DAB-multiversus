import { contextBridge, ipcRenderer } from 'electron';

import type { DesktopBridge, DesktopWindowState } from '@shared/types/desktop';

const DESKTOP_WINDOW_CHANNELS = {
  close: 'desktop-window:close',
  getState: 'desktop-window:get-state',
  minimize: 'desktop-window:minimize',
  stateChanged: 'desktop-window:state-changed',
  toggleMaximize: 'desktop-window:toggle-maximize',
} as const;

const desktopBridge: DesktopBridge = {
  environment: process.env.VITE_DEV_SERVER_URL ? 'development' : 'production',
  isPackaged: !process.env.VITE_DEV_SERVER_URL,
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

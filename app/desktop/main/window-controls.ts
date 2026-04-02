import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';

import type { DesktopWindowState } from '@shared/contracts/desktop.contract';

const DESKTOP_WINDOW_CHANNELS = {
  close: 'desktop-window:close',
  getState: 'desktop-window:get-state',
  minimize: 'desktop-window:minimize',
  stateChanged: 'desktop-window:state-changed',
  toggleMaximize: 'desktop-window:toggle-maximize',
} as const;

let handlersRegistered = false;

function resolveWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);

  if (!browserWindow) {
    throw new Error('No BrowserWindow was found for the active renderer process.');
  }

  return browserWindow;
}

function getWindowState(browserWindow: BrowserWindow): DesktopWindowState {
  return {
    isMaximized: browserWindow.isMaximized(),
  };
}

export function bindWindowControlEvents(browserWindow: BrowserWindow): void {
  const emitState = (): void => {
    browserWindow.webContents.send(
      DESKTOP_WINDOW_CHANNELS.stateChanged,
      getWindowState(browserWindow),
    );
  };

  browserWindow.on('maximize', emitState);
  browserWindow.on('unmaximize', emitState);
  browserWindow.on('enter-full-screen', emitState);
  browserWindow.on('leave-full-screen', emitState);
  browserWindow.webContents.once('did-finish-load', emitState);
}

export function registerWindowControlHandlers(): void {
  if (handlersRegistered) {
    return;
  }

  handlersRegistered = true;

  ipcMain.handle(DESKTOP_WINDOW_CHANNELS.minimize, (event) => {
    resolveWindow(event).minimize();
  });

  ipcMain.handle(DESKTOP_WINDOW_CHANNELS.toggleMaximize, (event) => {
    const browserWindow = resolveWindow(event);
    browserWindow.setMaximizable(false);
    return getWindowState(browserWindow);
  });

  ipcMain.handle(DESKTOP_WINDOW_CHANNELS.close, (event) => {
    const browserWindow = resolveWindow(event);

    browserWindow.removeAllListeners('close');
    browserWindow.destroy();
    app.exit(0);
  });

  ipcMain.handle(DESKTOP_WINDOW_CHANNELS.getState, (event) => {
    return getWindowState(resolveWindow(event));
  });
}

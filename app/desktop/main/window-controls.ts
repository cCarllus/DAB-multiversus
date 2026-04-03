import {
  app,
  BrowserWindow,
  ipcMain,
  type IpcMainInvokeEvent,
} from 'electron';

import type { DesktopWindowState } from '@shared/contracts/desktop.contract';

const DESKTOP_WINDOW_CHANNELS = {
  close: 'desktop-window:close',
  getState: 'desktop-window:get-state',
  minimize: 'desktop-window:minimize',
  setFullscreen: 'desktop-window:set-fullscreen',
  setResolution: 'desktop-window:set-resolution',
  stateChanged: 'desktop-window:state-changed',
  toggleMaximize: 'desktop-window:toggle-maximize',
} as const;

type LauncherBrowserWindow = NonNullable<ReturnType<typeof BrowserWindow.fromWebContents>>;

let handlersRegistered = false;

function resolveWindow(event: IpcMainInvokeEvent): LauncherBrowserWindow {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);

  if (!browserWindow) {
    throw new Error('No BrowserWindow was found for the active renderer process.');
  }

  return browserWindow;
}

function getWindowState(browserWindow: LauncherBrowserWindow): DesktopWindowState {
  const [width, height] = browserWindow.getContentSize();

  return {
    height,
    isFullScreen: browserWindow.isFullScreen(),
    isMaximized: browserWindow.isMaximized(),
    width,
  };
}

export function bindWindowControlEvents(browserWindow: LauncherBrowserWindow): void {
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
  browserWindow.on('resize', emitState);
  browserWindow.webContents.once('did-finish-load', emitState);
}

export function registerWindowControlHandlers(): void {
  if (handlersRegistered) {
    return;
  }

  handlersRegistered = true;

  ipcMain.handle(DESKTOP_WINDOW_CHANNELS.minimize, (event) => {
    const browserWindow = resolveWindow(event);

    if (!browserWindow.isMinimizable() || browserWindow.isMinimized()) {
      return;
    }

    browserWindow.minimize();
  });

  ipcMain.handle(DESKTOP_WINDOW_CHANNELS.toggleMaximize, (event) => {
    const browserWindow = resolveWindow(event);

    if (!browserWindow.isMaximizable()) {
      return getWindowState(browserWindow);
    }

    if (browserWindow.isMaximized()) {
      browserWindow.unmaximize();
    } else {
      browserWindow.maximize();
    }

    return getWindowState(browserWindow);
  });

  ipcMain.handle(DESKTOP_WINDOW_CHANNELS.setFullscreen, (event, enabled: unknown) => {
    const browserWindow = resolveWindow(event);

    if (typeof enabled !== 'boolean' || !browserWindow.isFullScreenable()) {
      return getWindowState(browserWindow);
    }

    browserWindow.setFullScreen(enabled);
    return getWindowState(browserWindow);
  });

  ipcMain.handle(
    DESKTOP_WINDOW_CHANNELS.setResolution,
    (event, payload: { height?: unknown; width?: unknown } | undefined) => {
      const browserWindow = resolveWindow(event);
      const width =
        typeof payload?.width === 'number' && Number.isFinite(payload.width)
          ? Math.round(payload.width)
          : 0;
      const height =
        typeof payload?.height === 'number' && Number.isFinite(payload.height)
          ? Math.round(payload.height)
          : 0;

      if (width <= 0 || height <= 0) {
        return getWindowState(browserWindow);
      }

      const wasFullScreen = browserWindow.isFullScreen();

      if (wasFullScreen) {
        browserWindow.setFullScreen(false);
      }

      browserWindow.setContentSize(width, height);
      browserWindow.center();

      if (wasFullScreen) {
        browserWindow.setFullScreen(true);
      }

      return getWindowState(browserWindow);
    },
  );

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

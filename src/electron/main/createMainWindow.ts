import { join } from 'node:path';

import { app, BrowserWindow, shell } from 'electron';

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function resolveRuntimeIconPath(): string {
  if (VITE_DEV_SERVER_URL) {
    return join(process.cwd(), 'src/assets/images/dab-icon.png');
  }

  return join(process.resourcesPath, 'icons/dab-icon.png');
}

export function createMainWindow(): BrowserWindow {
  const preloadPath = join(__dirname, '../preload/index.js');
  const rendererPath = join(__dirname, '../../../dist/index.html');
  const runtimeIconPath = resolveRuntimeIconPath();

  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(runtimeIconPath);
  }

  const mainWindow = new BrowserWindow({
    width: 1720,
    height: 1040,
    minWidth: 1360,
    minHeight: 820,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#04070d',
    center: true,
    icon: process.platform === 'darwin' ? undefined : runtimeIconPath,
    title: 'Dead As Battle',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    webPreferences: {
      contextIsolation: true,
      devTools: Boolean(VITE_DEV_SERVER_URL),
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);

    return {
      action: 'deny',
    };
  });

  if (VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(rendererPath);
  }

  return mainWindow;
}

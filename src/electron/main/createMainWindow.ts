import { join } from 'node:path';

import { BrowserWindow, shell } from 'electron';

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

export function createMainWindow(): BrowserWindow {
  const preloadPath = join(__dirname, '../preload/index.js');
  const rendererPath = join(__dirname, '../../../dist/index.html');

  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#04070d',
    title: 'Dead As Battle Multiversus',
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

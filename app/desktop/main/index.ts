import { app, BrowserWindow } from 'electron';

import { registerAuthStorageHandlers } from './auth-storage';
import { createMainWindow } from './create-main-window';
import { registerWindowControlHandlers } from './window-controls';

const APP_DISPLAY_NAME = 'Dead As Battle';
const isMac = process.platform === 'darwin';

app.setName(APP_DISPLAY_NAME);
registerAuthStorageHandlers();
registerWindowControlHandlers();

void app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit();
  }
});

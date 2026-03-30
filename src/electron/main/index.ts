import { app, BrowserWindow } from 'electron';

import { createMainWindow } from './createMainWindow';
import { registerWindowControlHandlers } from './windowControls';

const APP_DISPLAY_NAME = 'Dead As Battle';
const isMac = process.platform === 'darwin';

app.setName(APP_DISPLAY_NAME);
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

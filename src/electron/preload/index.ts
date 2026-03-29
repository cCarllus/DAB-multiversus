import { contextBridge } from 'electron';

import type { DesktopBridge } from '@shared/types/desktop';

const desktopBridge: DesktopBridge = {
  environment: process.env.VITE_DEV_SERVER_URL ? 'development' : 'production',
  isPackaged: !process.env.VITE_DEV_SERVER_URL,
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
};

contextBridge.exposeInMainWorld('desktop', desktopBridge);

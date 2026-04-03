import type { DesktopBridge } from '@shared/contracts/desktop.contract';

export function createDesktopBridgeFallback(): DesktopBridge {
  return {
    authStorage: {
      clearRememberedSession: () => Promise.resolve(),
      getRememberedSession: () => Promise.resolve(null),
      isPersistentStorageAvailable: () => Promise.resolve(false),
      setRememberedSession: () =>
        Promise.reject(
          new Error('Secure remembered sessions are unavailable outside Electron.'),
        ),
    },
    environment: import.meta.env.DEV ? 'development' : 'production',
    isPackaged: false,
    osVersion: 'web',
    platform: 'browser',
    versions: {
      chrome: 'web',
      electron: 'web',
      node: 'web',
    },
    windowControls: {
      close: () => {
        globalThis.window?.close();
        return Promise.resolve();
      },
      getState: () => Promise.resolve({ isMaximized: false }),
      minimize: () => Promise.resolve(),
      onStateChange: () => () => undefined,
      toggleMaximize: () => Promise.resolve({ isMaximized: false }),
    },
  };
}

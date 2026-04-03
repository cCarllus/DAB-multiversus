import type { DesktopBridge } from '@shared/contracts/desktop.contract';

export function createDesktopBridgeFallback(): DesktopBridge {
  let isFullScreen = false;
  let width = globalThis.window?.innerWidth ?? 1600;
  let height = globalThis.window?.innerHeight ?? 900;

  const getState = () =>
    Promise.resolve({
      height,
      isFullScreen,
      isMaximized: false,
      width,
    });

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
      getState,
      minimize: () => Promise.resolve(),
      onStateChange: () => () => undefined,
      setFullscreen: (enabled) => {
        isFullScreen = enabled;
        return getState();
      },
      setResolution: (nextWidth, nextHeight) => {
        width = nextWidth;
        height = nextHeight;
        return getState();
      },
      toggleMaximize: () => getState(),
    },
  };
}

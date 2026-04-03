export interface DesktopWindowState {
  height: number;
  isFullScreen: boolean;
  isMaximized: boolean;
  width: number;
}

export interface DesktopRememberedAuthSession {
  refreshToken: string;
  rememberDevice: boolean;
  sessionExpiresAt: string;
  savedAt: string;
}

export interface DesktopAuthStorage {
  clearRememberedSession: () => Promise<void>;
  getRememberedSession: () => Promise<DesktopRememberedAuthSession | null>;
  isPersistentStorageAvailable: () => Promise<boolean>;
  setRememberedSession: (session: DesktopRememberedAuthSession) => Promise<void>;
}

export interface DesktopWindowControls {
  close: () => Promise<void>;
  getState: () => Promise<DesktopWindowState>;
  minimize: () => Promise<void>;
  onStateChange: (listener: (state: DesktopWindowState) => void) => () => void;
  setFullscreen: (enabled: boolean) => Promise<DesktopWindowState>;
  setResolution: (width: number, height: number) => Promise<DesktopWindowState>;
  toggleMaximize: () => Promise<DesktopWindowState>;
}

export interface DesktopBridge {
  authStorage?: DesktopAuthStorage;
  environment: 'development' | 'production';
  isPackaged: boolean;
  osVersion: string;
  platform: string;
  versions: {
    chrome: string;
    electron: string;
    node: string;
  };
  windowControls?: DesktopWindowControls;
}

export interface DesktopWindowState {
  isMaximized: boolean;
}

export interface DesktopRememberedAuthSession {
  refreshToken: string;
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

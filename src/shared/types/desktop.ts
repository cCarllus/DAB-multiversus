export interface DesktopWindowState {
  isMaximized: boolean;
}

export interface DesktopWindowControls {
  close: () => Promise<void>;
  getState: () => Promise<DesktopWindowState>;
  minimize: () => Promise<void>;
  onStateChange: (listener: (state: DesktopWindowState) => void) => () => void;
  toggleMaximize: () => Promise<DesktopWindowState>;
}

export interface DesktopBridge {
  environment: 'development' | 'production';
  isPackaged: boolean;
  platform: string;
  versions: {
    chrome: string;
    electron: string;
    node: string;
  };
  windowControls?: DesktopWindowControls;
}

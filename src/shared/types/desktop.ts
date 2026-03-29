export interface DesktopBridge {
  environment: 'development' | 'production';
  isPackaged: boolean;
  platform: string;
  versions: {
    chrome: string;
    electron: string;
    node: string;
  };
}

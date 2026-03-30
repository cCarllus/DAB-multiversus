/// <reference types="vite/client" />

import type { DesktopBridge } from '@shared/types/desktop';

declare global {
  const __APP_VERSION__: string;

  interface Window {
    desktop?: DesktopBridge;
  }
}

declare module '*.html?raw' {
  const template: string;
  export default template;
}

export {};

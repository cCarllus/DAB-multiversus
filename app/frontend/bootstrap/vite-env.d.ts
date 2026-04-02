/// <reference types="vite/client" />

import type { DesktopBridge } from '@shared/contracts/desktop.contract';

declare global {
  const __APP_VERSION__: string;

  interface Window {
    desktop?: DesktopBridge;
  }
}

interface ImportMetaEnv {
  readonly VITE_AUTH_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.html?raw' {
  const template: string;
  export default template;
}

export {};

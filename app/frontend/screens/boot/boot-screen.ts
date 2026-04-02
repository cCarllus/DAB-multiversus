import { createElementFromTemplate } from '@frontend/lib/html';
import type { AppI18n } from '@shared/i18n';

import bootScreenTemplate from './boot-screen.html?raw';
import './boot-screen.css';

interface BootScreenOptions {
  appVersion: string;
  i18n: AppI18n;
  status: string;
}

export function createBootScreen(options: BootScreenOptions): HTMLElement {
  const messages = options.i18n.getMessages();

  return createElementFromTemplate(bootScreenTemplate, {
    BOOT_EYEBROW: messages.boot.eyebrow,
    BOOT_SCREEN_ARIA_LABEL: messages.boot.screenAriaLabel,
    BOOT_STATUS: options.status,
    BOOT_TITLE: messages.common.appName,
    BOOT_VERSION: `v${options.appVersion}`,
  });
}

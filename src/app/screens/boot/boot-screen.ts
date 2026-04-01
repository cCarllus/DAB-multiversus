import { createElementFromTemplate } from '@app/utils/html';
import type { AppI18n } from '@shared/i18n';

import './boot-screen.css';

interface BootScreenOptions {
  appVersion: string;
  i18n: AppI18n;
  status: string;
}

export function createBootScreen(options: BootScreenOptions): HTMLElement {
  const messages = options.i18n.getMessages();

  return createElementFromTemplate(`
    <section class="boot-screen" aria-label="${messages.boot.screenAriaLabel}">
      <div class="boot-screen__halo" aria-hidden="true"></div>
      <div class="boot-screen__copy">
        <p class="boot-screen__eyebrow">${messages.boot.eyebrow}</p>
        <h1 class="boot-screen__title">${messages.common.appName}</h1>
        <p class="boot-screen__status">${options.status}</p>
        <p class="boot-screen__version">v${options.appVersion}</p>
      </div>
    </section>
  `);
}

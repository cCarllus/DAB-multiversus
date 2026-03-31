import { createElementFromTemplate } from '@app/utils/html';

import './boot-screen.css';

interface BootScreenOptions {
  appVersion: string;
  status: string;
}

export function createBootScreen(options: BootScreenOptions): HTMLElement {
  return createElementFromTemplate(`
    <section class="boot-screen" aria-label="Authentication boot check">
      <div class="boot-screen__halo" aria-hidden="true"></div>
      <div class="boot-screen__copy">
        <p class="boot-screen__eyebrow">Session Bootstrap</p>
        <h1 class="boot-screen__title">Dead As Battle</h1>
        <p class="boot-screen__status">${options.status}</p>
        <p class="boot-screen__version">v${options.appVersion}</p>
      </div>
    </section>
  `);
}

import { createElementFromTemplate } from '@app/utils/html';
import type { AppI18n } from '@shared/i18n';

import './modal-chrome.css';
import './exit-modal.css';

interface ExitModalOptions {
  errorMessage?: string | null;
  i18n: AppI18n;
  isClosing: boolean;
  isLoggingOut: boolean;
  userLabel: string;
}

export function createExitModal(options: ExitModalOptions): HTMLElement {
  const messages = options.i18n.getMessages();
  const rootElement = createElementFromTemplate(`
    <section class="exit-modal ${options.isClosing ? 'exit-modal--closing' : ''}" aria-label="${messages.menu.exitModal.ariaLabel}" role="dialog" aria-modal="true">
      <div class="exit-modal__panel">
        <button
          type="button"
          class="launcher-modal-dismiss"
          data-action="dismiss-exit-modal"
          aria-label="${messages.menu.exitModal.dismissAriaLabel}"
          ${options.isLoggingOut ? 'disabled' : ''}
        >
          <span class="launcher-modal-dismiss__icon" aria-hidden="true">&times;</span>
        </button>
        <p class="exit-modal__eyebrow">${messages.menu.exitModal.eyebrow}</p>
        <h2 class="exit-modal__title">${messages.menu.exitModal.title}</h2>
        <p class="exit-modal__body" data-exit-modal-body></p>
        <p class="exit-modal__error" data-exit-modal-error></p>
        <div class="exit-modal__actions">
          <button
            type="button"
            class="exit-modal__button exit-modal__button--logout"
            data-action="auth-logout"
            data-ui-cue="confirm"
            ${options.isLoggingOut ? 'disabled' : ''}
          >
            ${options.isLoggingOut ? messages.menu.exitModal.loggingOut : messages.menu.exitModal.logout}
          </button>
          <button
            type="button"
            class="exit-modal__button exit-modal__button--close"
            data-action="launcher-force-close"
            data-ui-cue="confirm"
            ${options.isLoggingOut ? 'disabled' : ''}
          >
            ${messages.menu.exitModal.closeLauncher}
          </button>
        </div>
      </div>
    </section>
  `);

  const bodyElement = rootElement.querySelector<HTMLElement>('[data-exit-modal-body]');
  const errorElement = rootElement.querySelector<HTMLElement>('[data-exit-modal-error]');

  if (!bodyElement || !errorElement) {
    throw new Error('Exit modal could not be initialized.');
  }

  bodyElement.textContent = options.i18n.t('menu.exitModal.body', {
    userLabel: options.userLabel,
  });
  errorElement.textContent = options.errorMessage ?? '';

  return rootElement;
}

import { createElementFromTemplate } from '@app/utils/html';
import type { AppI18n } from '@shared/i18n';

import exitModalTemplate from './exit-modal.html?raw';
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
  const disabledAttribute = options.isLoggingOut ? 'disabled' : '';
  const rootElement = createElementFromTemplate(exitModalTemplate, {
    EXIT_MODAL_ARIA_LABEL: messages.menu.exitModal.ariaLabel,
    EXIT_MODAL_CLOSE_LABEL: messages.menu.exitModal.closeLauncher,
    EXIT_MODAL_CLOSING_CLASS: options.isClosing ? 'exit-modal--closing' : '',
    EXIT_MODAL_DISABLED_ATTR: disabledAttribute,
    EXIT_MODAL_DISMISS_ARIA_LABEL: messages.menu.exitModal.dismissAriaLabel,
    EXIT_MODAL_EYEBROW: messages.menu.exitModal.eyebrow,
    EXIT_MODAL_LOGOUT_LABEL: options.isLoggingOut
      ? messages.menu.exitModal.loggingOut
      : messages.menu.exitModal.logout,
    EXIT_MODAL_TITLE: messages.menu.exitModal.title,
  });

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

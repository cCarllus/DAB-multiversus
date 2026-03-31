import { createElementFromTemplate } from '@app/utils/html';

import './modal-chrome.css';
import './exit-modal.css';

interface ExitModalOptions {
  errorMessage?: string | null;
  isClosing: boolean;
  isLoggingOut: boolean;
  userLabel: string;
}

export function createExitModal(options: ExitModalOptions): HTMLElement {
  return createElementFromTemplate(`
    <section class="exit-modal ${options.isClosing ? 'exit-modal--closing' : ''}" aria-label="Exit launcher options" role="dialog" aria-modal="true">
      <div class="exit-modal__panel">
        <button
          type="button"
          class="launcher-modal-dismiss"
          data-action="dismiss-exit-modal"
          aria-label="Cancelar e voltar"
          ${options.isLoggingOut ? 'disabled' : ''}
        >
          <span class="launcher-modal-dismiss__icon" aria-hidden="true">&times;</span>
        </button>
        <p class="exit-modal__eyebrow">Exit Options</p>
        <h2 class="exit-modal__title">Encerrar sessao ou fechar o launcher</h2>
        <p class="exit-modal__body">
          <strong>${options.userLabel}</strong> ainda esta autenticado. Escolha entre fazer logout e voltar para a tela de login, ou fechar o launcher agora.
        </p>
        <p class="exit-modal__error">${options.errorMessage ?? ''}</p>
        <div class="exit-modal__actions">
          <button
            type="button"
            class="exit-modal__button exit-modal__button--logout"
            data-action="auth-logout"
            data-ui-cue="confirm"
            ${options.isLoggingOut ? 'disabled' : ''}
          >
            ${options.isLoggingOut ? 'Saindo...' : 'Logout'}
          </button>
          <button
            type="button"
            class="exit-modal__button exit-modal__button--close"
            data-action="launcher-force-close"
            data-ui-cue="confirm"
            ${options.isLoggingOut ? 'disabled' : ''}
          >
            Fechar launcher
          </button>
        </div>
      </div>
    </section>
  `);
}

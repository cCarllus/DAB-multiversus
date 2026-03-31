import { createElementFromTemplate } from '@app/utils/html';
import titleGameNameImage from '@assets/images/ui/icons/title-game-name.png';

import type { LoginFormValues } from './auth-types';
import loginScreenTemplate from './login-screen.html?raw';
import './login-screen.css';

export interface LoginScreenOptions {
  appVersion: string;
  errorMessage?: string | null;
  identifier?: string;
  isSubmitting: boolean;
  rememberDevice: boolean;
  rememberDeviceSupported: boolean;
  onSubmit: (values: LoginFormValues) => void | Promise<void>;
}

export function createLoginScreen(options: LoginScreenOptions): HTMLElement {
  const rootElement = createElementFromTemplate(loginScreenTemplate);
  const formElement = rootElement.querySelector<HTMLFormElement>('[data-login-form]');
  const identifierInput = rootElement.querySelector<HTMLInputElement>('[data-login-identifier]');
  const passwordInput = rootElement.querySelector<HTMLInputElement>('[data-login-password]');
  const rememberCheckbox = rootElement.querySelector<HTMLInputElement>('[data-login-remember]');
  const rememberHint = rootElement.querySelector<HTMLElement>('[data-login-remember-hint]');
  const errorElement = rootElement.querySelector<HTMLElement>('[data-login-error]');
  const submitButton = rootElement.querySelector<HTMLButtonElement>('[data-login-submit]');
  const submitLabel = rootElement.querySelector<HTMLElement>('.login-form__submit-label');
  const brandImage = rootElement.querySelector<HTMLImageElement>('[data-login-brand-image]');
  const versionElement = rootElement.querySelector<HTMLElement>('[data-login-version]');

  if (
    !formElement ||
    !identifierInput ||
    !passwordInput ||
    !rememberCheckbox ||
    !rememberHint ||
    !errorElement ||
    !submitButton ||
    !submitLabel ||
    !brandImage ||
    !versionElement
  ) {
    throw new Error('Login screen could not be initialized.');
  }

  brandImage.src = titleGameNameImage;
  versionElement.textContent = `v${options.appVersion}`;
  identifierInput.value = options.identifier ?? '';
  rememberCheckbox.checked = options.rememberDevice;
  rememberCheckbox.disabled = !options.rememberDeviceSupported || options.isSubmitting;
  identifierInput.disabled = options.isSubmitting;
  passwordInput.disabled = options.isSubmitting;
  submitButton.disabled = options.isSubmitting;
  submitLabel.textContent = options.isSubmitting ? 'Conectando...' : 'Iniciar sessão';

  rememberHint.textContent = options.rememberDeviceSupported
    ? 'O refresh token é salvo com o armazenamento seguro do Electron e reaproveitado por até 30 dias.'
    : 'O armazenamento seguro persistente só fica disponível dentro do launcher Electron.';
  errorElement.textContent = options.errorMessage ?? '';

  if (!options.isSubmitting) {
    queueMicrotask(() => {
      identifierInput.focus();
      identifierInput.select();
    });
  }

  formElement.addEventListener('submit', (event) => {
    event.preventDefault();

    if (options.isSubmitting) {
      return;
    }

    void options.onSubmit({
      identifier: identifierInput.value.trim(),
      password: passwordInput.value,
      rememberDevice: rememberCheckbox.checked,
    });
  });

  return rootElement;
}

import { createElementFromTemplate } from '@app/utils/html';
import titleGameNameImage from '@assets/images/ui/icons/title-game-name.png';
import loginBackgroundVideo from '@assets/images/ui/videos/background_video.mp4';

import type { LoginFormValues } from './auth-types';
import loginScreenTemplate from './login-screen.html?raw';
import './login-screen.css';

export interface LoginScreenOptions {
  appVersion: string;
  devShortcutLabel?: string;
  enableDevShortcut?: boolean;
  musicMuted: boolean;
  errorMessage?: string | null;
  identifier?: string;
  isSubmitting: boolean;
  rememberDevice: boolean;
  rememberDeviceSupported: boolean;
  onDevShortcutSubmit?: () => void | Promise<void>;
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
  const devShortcutButton = rootElement.querySelector<HTMLButtonElement>('[data-login-dev-shortcut]');
  const devShortcutLabel = rootElement.querySelector<HTMLElement>('[data-login-dev-shortcut-label]');
  const brandImage = rootElement.querySelector<HTMLImageElement>('[data-login-brand-image]');
  const musicMuteCheckbox = rootElement.querySelector<HTMLInputElement>('[data-login-music-muted]');
  const backgroundVideo = rootElement.querySelector<HTMLVideoElement>('[data-login-background-video]');
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
    !devShortcutButton ||
    !devShortcutLabel ||
    !brandImage ||
    !musicMuteCheckbox ||
    !backgroundVideo ||
    !versionElement
  ) {
    throw new Error('Login screen could not be initialized.');
  }

  brandImage.src = titleGameNameImage;
  backgroundVideo.src = loginBackgroundVideo;
  backgroundVideo.defaultMuted = true;
  backgroundVideo.muted = true;
  backgroundVideo.loop = true;
  backgroundVideo.autoplay = true;
  backgroundVideo.playsInline = true;
  musicMuteCheckbox.checked = options.musicMuted;
  versionElement.textContent = `v${options.appVersion}`;
  identifierInput.value = options.identifier ?? '';
  rememberCheckbox.checked = options.rememberDevice;
  rememberCheckbox.disabled = !options.rememberDeviceSupported || options.isSubmitting;
  identifierInput.disabled = options.isSubmitting;
  passwordInput.disabled = options.isSubmitting;
  submitButton.disabled = options.isSubmitting;
  submitLabel.textContent = options.isSubmitting ? 'Conectando...' : 'Iniciar sessão';
  devShortcutButton.hidden = !options.enableDevShortcut;
  devShortcutButton.disabled =
    options.isSubmitting || !options.enableDevShortcut || !options.onDevShortcutSubmit;
  devShortcutLabel.textContent = options.devShortcutLabel ?? 'Entrar com conta de teste';

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

  devShortcutButton.addEventListener('click', () => {
    if (
      options.isSubmitting ||
      !options.enableDevShortcut ||
      !options.onDevShortcutSubmit
    ) {
      return;
    }

    identifierInput.value = 'teste@dab.local';
    passwordInput.value = 'SenhaForte123!';
    rememberCheckbox.checked = true;
    void options.onDevShortcutSubmit();
  });

  return rootElement;
}

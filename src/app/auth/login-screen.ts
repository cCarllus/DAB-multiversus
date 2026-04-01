import { createElementFromTemplate } from '@app/utils/html';
import titleGameNameImage from '@assets/images/ui/icons/title-game-name.png';
import loginBackgroundVideo from '@assets/images/ui/videos/background_video.mp4';
import {
  getLocaleOptionCopy,
  type AppI18n,
  type AppLocale,
} from '@shared/i18n';

import type { LoginFormValues } from './auth-types';
import loginScreenTemplate from './login-screen.html?raw';
import './login-screen.css';

export interface LoginScreenOptions {
  appVersion: string;
  enableDevShortcut?: boolean;
  errorMessage?: string | null;
  identifier?: string;
  i18n: AppI18n;
  isSubmitting: boolean;
  locale: AppLocale;
  musicMuted: boolean;
  onLocaleChange?: (locale: AppLocale) => void;
  rememberDevice: boolean;
  rememberDeviceSupported: boolean;
  onDevShortcutSubmit?: () => void | Promise<void>;
  onSubmit: (values: LoginFormValues) => void | Promise<void>;
}

export function createLoginScreen(options: LoginScreenOptions): HTMLElement {
  const messages = options.i18n.getMessages();
  const ptBrOption = getLocaleOptionCopy(messages, 'pt-BR');
  const enOption = getLocaleOptionCopy(messages, 'en');
  const selectedLocaleOption = getLocaleOptionCopy(messages, options.locale);
  const rootElement = createElementFromTemplate(loginScreenTemplate, {
    LOGIN_CLOSE_ARIA_LABEL: messages.login.windowControls.closeAriaLabel,
    LOGIN_BRAND_ALT: messages.common.brandAlt,
    LOGIN_CREATE_ACCOUNT_SOON_LABEL: messages.login.footer.createAccountSoon,
    LOGIN_DEV_SHORTCUT_LABEL: messages.login.form.devShortcut,
    LOGIN_FORM_ARIA_LABEL: messages.login.formAriaLabel,
    LOGIN_HERO_ARIA_LABEL: messages.login.heroAriaLabel,
    LOGIN_HERO_EYEBROW: messages.login.hero.eyebrow,
    LOGIN_HERO_SUMMARY: messages.login.hero.summary,
    LOGIN_HERO_TITLE: messages.login.hero.title,
    LOGIN_IDENTIFIER_LABEL: messages.login.form.identifierLabel,
    LOGIN_IDENTIFIER_PLACEHOLDER: messages.login.form.identifierPlaceholder,
    LOGIN_INTRO_SUMMARY: messages.login.intro.summary,
    LOGIN_INTRO_TITLE: messages.login.intro.title,
    LOGIN_LOCALE_EN_DESCRIPTION: enOption.description,
    LOGIN_LOCALE_EN_LABEL: enOption.label,
    LOGIN_LOCALE_LABEL: messages.login.locale.label,
    LOGIN_LOCALE_MENU_ARIA_LABEL: messages.login.locale.menuAriaLabel,
    LOGIN_LOCALE_PT_BR_DESCRIPTION: ptBrOption.description,
    LOGIN_LOCALE_PT_BR_LABEL: ptBrOption.label,
    LOGIN_LOCALE_SELECTED_LABEL: selectedLocaleOption.label,
    LOGIN_LOCALE_SELECTOR_ARIA_LABEL: messages.login.locale.selectorAriaLabel,
    LOGIN_MINIMIZE_ARIA_LABEL: messages.login.windowControls.minimizeAriaLabel,
    LOGIN_MUSIC_TOGGLE_LABEL: messages.login.musicToggleLabel,
    LOGIN_PASSWORD_LABEL: messages.login.form.passwordLabel,
    LOGIN_PASSWORD_PLACEHOLDER: messages.login.form.passwordPlaceholder,
    LOGIN_PASSWORD_RECOVERY_SOON_LABEL: messages.login.footer.passwordRecoverySoon,
    LOGIN_REMEMBER_DEVICE_LABEL: messages.login.form.rememberDevice,
    LOGIN_RULE_AUTH_CHANNEL_LABEL: messages.login.hero.rules.authChannelLabel,
    LOGIN_RULE_AUTH_CHANNEL_VALUE: messages.login.hero.rules.authChannelValue,
    LOGIN_RULE_REMEMBERED_DEVICE_LABEL: messages.login.hero.rules.rememberedDeviceLabel,
    LOGIN_RULE_REMEMBERED_DEVICE_VALUE: messages.login.hero.rules.rememberedDeviceValue,
    LOGIN_RULE_UNCHECKED_DEVICE_LABEL: messages.login.hero.rules.uncheckedDeviceLabel,
    LOGIN_RULE_UNCHECKED_DEVICE_VALUE: messages.login.hero.rules.uncheckedDeviceValue,
    LOGIN_RULES_ARIA_LABEL: messages.login.rulesAriaLabel,
    LOGIN_SCREEN_ARIA_LABEL: messages.login.screenAriaLabel,
    LOGIN_SUBMIT_LABEL: messages.login.form.submit,
  });
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
  const localeDetails = rootElement.querySelector<HTMLDetailsElement>('[data-login-locale-details]');
  const localeSelectedLabel = rootElement.querySelector<HTMLElement>(
    '[data-login-locale-selected]',
  );
  const localeOptionButtons = Array.from(
    rootElement.querySelectorAll<HTMLButtonElement>('[data-login-locale-option]'),
  );
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
    !localeDetails ||
    !localeSelectedLabel ||
    localeOptionButtons.length === 0 ||
    !versionElement
  ) {
    throw new Error('Login screen could not be initialized.');
  }

  brandImage.src = titleGameNameImage;
  brandImage.alt = messages.common.brandAlt;
  backgroundVideo.src = loginBackgroundVideo;
  backgroundVideo.defaultMuted = true;
  backgroundVideo.muted = true;
  backgroundVideo.loop = true;
  backgroundVideo.autoplay = true;
  backgroundVideo.playsInline = true;
  musicMuteCheckbox.checked = options.musicMuted;
  versionElement.textContent = `v${options.appVersion}`;
  identifierInput.value = options.identifier ?? '';
  rememberCheckbox.checked = options.rememberDeviceSupported && options.rememberDevice;
  rememberCheckbox.disabled = !options.rememberDeviceSupported || options.isSubmitting;
  identifierInput.disabled = options.isSubmitting;
  passwordInput.disabled = options.isSubmitting;
  submitButton.disabled = options.isSubmitting;
  submitLabel.textContent = options.isSubmitting
    ? messages.login.form.submitting
    : messages.login.form.submit;
  devShortcutButton.hidden = !options.enableDevShortcut;
  devShortcutButton.disabled =
    options.isSubmitting || !options.enableDevShortcut || !options.onDevShortcutSubmit;
  devShortcutLabel.textContent = messages.login.form.devShortcut;

  rememberHint.textContent = options.rememberDeviceSupported
    ? messages.login.form.rememberHintSupported
    : messages.login.form.rememberHintUnsupported;
  errorElement.textContent = options.errorMessage ?? '';
  localeSelectedLabel.textContent = selectedLocaleOption.label;

  localeOptionButtons.forEach((button) => {
    const locale = button.dataset.loginLocaleOption as AppLocale | undefined;
    const isSelected = locale === options.locale;

    button.disabled = options.isSubmitting;
    button.dataset.selected = isSelected ? 'true' : 'false';
    button.setAttribute('aria-selected', String(isSelected));

    button.addEventListener('click', () => {
      if (
        options.isSubmitting ||
        !locale ||
        locale === options.locale ||
        !options.onLocaleChange
      ) {
        localeDetails.open = false;
        return;
      }

      localeDetails.open = false;
      options.onLocaleChange(locale);
    });
  });

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
      rememberDevice: options.rememberDeviceSupported && rememberCheckbox.checked,
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
    rememberCheckbox.checked = options.rememberDeviceSupported;
    void options.onDevShortcutSubmit();
  });

  return rootElement;
}

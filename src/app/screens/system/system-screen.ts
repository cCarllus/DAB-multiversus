import { resolveAuthErrorMessage } from '@app/auth/auth-service';
import type { AuthSessionSnapshot } from '@app/auth/auth-types';
import { createElementFromTemplate } from '@app/utils/html';
import type { AppI18n } from '@shared/i18n';
import type { DesktopBridge } from '@shared/types/desktop';

import type { ProfileStore } from '@app/screens/profile/profile-store';
import type { ProfileDevice, ProfileFeedback, ProfileSnapshot } from '@app/screens/profile/profile-types';
import './system-screen.css';

interface SystemScreenOptions {
  desktop: DesktopBridge;
  i18n: AppI18n;
  profileStore: ProfileStore;
  session: AuthSessionSnapshot;
}

function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function resolvePlatformLabel(platform: string): string {
  switch (platform) {
    case 'darwin':
      return 'macOS';
    case 'win32':
      return 'Windows';
    case 'linux':
      return 'Linux';
    case 'browser':
      return 'Browser';
    default:
      return platform || 'Unknown OS';
  }
}

function buildRuntimeLabel(desktop: DesktopBridge): string {
  return `Electron ${desktop.versions.electron} · Chrome ${desktop.versions.chrome} · Node ${desktop.versions.node}`;
}

function buildDeviceMeta(
  device: ProfileDevice | null,
  locale: string,
  i18n: AppI18n,
): string {
  const messages = i18n.getMessages().menu.system;

  if (!device) {
    return messages.fallbackValue;
  }

  const appVersion = device.appVersion
    ? i18n.t('menu.system.list.appVersion', {
        version: device.appVersion,
      })
    : messages.list.noVersion;

  return `${formatDateTime(device.lastLoginAt, locale)} · ${appVersion}`;
}

function renderRecentDevices(
  devices: ProfileDevice[],
  locale: string,
  i18n: AppI18n,
): string {
  const messages = i18n.getMessages().menu.system;

  if (devices.length === 0) {
    return `<li class="system-device-list__empty">${messages.list.empty}</li>`;
  }

  return devices
    .slice(0, 5)
    .map((device) => {
      const meta = device.appVersion
        ? i18n.t('menu.system.list.appVersion', {
            version: device.appVersion,
          })
        : messages.list.noVersion;
      const state = device.isCurrent
        ? messages.list.current
        : i18n.t('menu.system.list.seenAt', {
            date: formatDateTime(device.lastLoginAt, locale),
          });

      return `
        <li class="system-device-list__item">
          <div class="system-device-list__copy">
            <strong class="system-device-list__label">${device.label}</strong>
            <span class="system-device-list__meta">${meta}</span>
          </div>
          <span class="system-device-list__state">${state}</span>
        </li>
      `;
    })
    .join('');
}

export function createSystemScreen(options: SystemScreenOptions): HTMLElement {
  const messages = options.i18n.getMessages().menu.system;
  const rootElement = createElementFromTemplate(`
    <main class="home-content system-content-shell">
      <section class="system-screen">
        <div class="system-screen__feedback" data-system-feedback hidden></div>

        <section class="system-panel">
          <div class="system-panel__head">
            <p class="system-panel__eyebrow">${messages.eyebrow}</p>
            <h1 class="system-panel__title">${messages.title}</h1>
            <p class="system-panel__summary">${messages.summary}</p>
          </div>

          <div class="system-panel__grid">
            <article class="system-card">
              <span class="system-card__label">${messages.cards.operatingSystem.label}</span>
              <strong class="system-card__value" data-system-platform></strong>
              <span class="system-card__meta">${messages.cards.operatingSystem.meta}</span>
            </article>

            <article class="system-card">
              <span class="system-card__label">${messages.cards.osVersion.label}</span>
              <strong class="system-card__value" data-system-os-version></strong>
              <span class="system-card__meta">${messages.cards.osVersion.meta}</span>
            </article>

            <article class="system-card">
              <span class="system-card__label">${messages.cards.launcherRuntime.label}</span>
              <strong class="system-card__value" data-system-runtime></strong>
              <span class="system-card__meta">${messages.cards.launcherRuntime.meta}</span>
            </article>

            <article class="system-card">
              <span class="system-card__label">${messages.cards.trustedAccess.label}</span>
              <strong class="system-card__value" data-system-trusted></strong>
              <span class="system-card__meta">${messages.cards.trustedAccess.meta}</span>
            </article>

            <article class="system-card">
              <span class="system-card__label">${messages.cards.currentDevice.label}</span>
              <strong class="system-card__value" data-system-current-device></strong>
              <span class="system-card__meta" data-system-current-meta></span>
            </article>

            <article class="system-card">
              <span class="system-card__label">${messages.cards.lastActive.label}</span>
              <strong class="system-card__value" data-system-last-active></strong>
              <span class="system-card__meta" data-system-last-active-meta></span>
            </article>
          </div>

          <div class="system-panel__devices">
            <div class="system-panel__devices-head">
              <p class="system-panel__eyebrow">${messages.list.eyebrow}</p>
              <p class="system-panel__devices-summary">${messages.list.summary}</p>
            </div>
            <ul class="system-device-list" data-system-device-list></ul>
          </div>
        </section>
      </section>
    </main>
  `);
  const feedbackElement = rootElement.querySelector<HTMLElement>('[data-system-feedback]');
  const platformValue = rootElement.querySelector<HTMLElement>('[data-system-platform]');
  const osVersionValue = rootElement.querySelector<HTMLElement>('[data-system-os-version]');
  const runtimeValue = rootElement.querySelector<HTMLElement>('[data-system-runtime]');
  const trustedValue = rootElement.querySelector<HTMLElement>('[data-system-trusted]');
  const currentDeviceValue = rootElement.querySelector<HTMLElement>('[data-system-current-device]');
  const currentMetaValue = rootElement.querySelector<HTMLElement>('[data-system-current-meta]');
  const lastActiveValue = rootElement.querySelector<HTMLElement>('[data-system-last-active]');
  const lastActiveMetaValue = rootElement.querySelector<HTMLElement>('[data-system-last-active-meta]');
  const deviceList = rootElement.querySelector<HTMLElement>('[data-system-device-list]');

  if (
    !feedbackElement ||
    !platformValue ||
    !osVersionValue ||
    !runtimeValue ||
    !trustedValue ||
    !currentDeviceValue ||
    !currentMetaValue ||
    !lastActiveValue ||
    !lastActiveMetaValue ||
    !deviceList
  ) {
    throw new Error('System screen could not be initialized.');
  }

  const setFeedback = (feedback: ProfileFeedback | null): void => {
    if (!feedback) {
      feedbackElement.hidden = true;
      feedbackElement.textContent = '';
      feedbackElement.dataset.tone = '';
      return;
    }

    feedbackElement.hidden = false;
    feedbackElement.textContent = feedback.message;
    feedbackElement.dataset.tone = feedback.tone;
  };

  const applySnapshot = (snapshot: ProfileSnapshot | null): void => {
    const locale = options.i18n.getLocale();
    const trustedAccess = options.session.rememberDevice
      ? messages.states.trusted
      : messages.states.sessionOnly;

    platformValue.textContent = resolvePlatformLabel(options.desktop.platform);
    osVersionValue.textContent = options.desktop.osVersion || messages.fallbackValue;
    runtimeValue.textContent = buildRuntimeLabel(options.desktop);
    trustedValue.textContent = trustedAccess;
    currentDeviceValue.textContent =
      snapshot?.devices.currentDevice?.label ?? messages.fallbackValue;
    currentMetaValue.textContent = buildDeviceMeta(
      snapshot?.devices.currentDevice ?? null,
      locale,
      options.i18n,
    );
    lastActiveValue.textContent =
      snapshot?.devices.lastActiveDevice?.label ?? messages.fallbackValue;
    lastActiveMetaValue.textContent = buildDeviceMeta(
      snapshot?.devices.lastActiveDevice ?? null,
      locale,
      options.i18n,
    );
    deviceList.innerHTML = renderRecentDevices(
      snapshot?.devices.devices ?? [],
      locale,
      options.i18n,
    );
  };

  applySnapshot(options.profileStore.getSnapshot());

  void options.profileStore
    .load(!options.profileStore.getSnapshot())
    .then((snapshot) => {
      applySnapshot(snapshot);
      setFeedback(null);
    })
    .catch((error) => {
      applySnapshot(options.profileStore.getSnapshot());
      setFeedback({
        message: resolveAuthErrorMessage(error, options.i18n),
        tone: 'error',
      });
    });

  return rootElement;
}

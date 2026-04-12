import { AppApiError, resolveApiErrorMessage } from '@frontend/services/api/api-error';
import type { AuthSessionSnapshot } from '@frontend/services/auth/auth-types';
import type {
  ProfileDevice,
  ProfileFeedback,
  ProfileSnapshot,
} from '@frontend/services/profile/profile.types';
import type { ProfileStore } from '@frontend/stores/profile.store';
import { createElementFromTemplate } from '@frontend/lib/html';
import type { AppI18n } from '@shared/i18n';
import type { DesktopBridge } from '@shared/contracts/desktop.contract';

import systemDeviceListEmptyTemplate from './system-device-list-empty.html?raw';
import systemDeviceListItemTemplate from './system-device-list-item.html?raw';
import systemScreenTemplate from './system-screen.html?raw';
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

function buildDeviceMeta(device: ProfileDevice | null, locale: string, i18n: AppI18n): string {
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
): HTMLElement[] {
  const messages = i18n.getMessages().menu.system;

  if (devices.length === 0) {
    return [
      createElementFromTemplate(systemDeviceListEmptyTemplate, {
        SYSTEM_DEVICE_LIST_EMPTY: messages.list.empty,
      }),
    ];
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

      return createElementFromTemplate(systemDeviceListItemTemplate, {
        SYSTEM_DEVICE_LABEL: device.label,
        SYSTEM_DEVICE_META: meta,
        SYSTEM_DEVICE_STATE: state,
      });
    })
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
}

export function createSystemScreen(options: SystemScreenOptions): HTMLElement {
  const messages = options.i18n.getMessages().menu.system;
  const rootElement = createElementFromTemplate(systemScreenTemplate, {
    SYSTEM_CARD_CURRENT_DEVICE_LABEL: messages.cards.currentDevice.label,
    SYSTEM_CARD_LAST_ACTIVE_LABEL: messages.cards.lastActive.label,
    SYSTEM_CARD_OPERATING_SYSTEM_LABEL: messages.cards.operatingSystem.label,
    SYSTEM_CARD_OPERATING_SYSTEM_META: messages.cards.operatingSystem.meta,
    SYSTEM_CARD_OS_VERSION_LABEL: messages.cards.osVersion.label,
    SYSTEM_CARD_OS_VERSION_META: messages.cards.osVersion.meta,
    SYSTEM_CARD_RUNTIME_LABEL: messages.cards.launcherRuntime.label,
    SYSTEM_CARD_RUNTIME_META: messages.cards.launcherRuntime.meta,
    SYSTEM_CARD_TRUSTED_ACCESS_LABEL: messages.cards.trustedAccess.label,
    SYSTEM_CARD_TRUSTED_ACCESS_META: messages.cards.trustedAccess.meta,
    SYSTEM_EYEBROW: messages.eyebrow,
    SYSTEM_LIST_EYEBROW: messages.list.eyebrow,
    SYSTEM_LIST_SUMMARY: messages.list.summary,
    SYSTEM_SUMMARY: messages.summary,
    SYSTEM_TITLE: messages.title,
  });
  const feedbackElement = rootElement.querySelector<HTMLElement>('[data-system-feedback]');
  const platformValue = rootElement.querySelector<HTMLElement>('[data-system-platform]');
  const osVersionValue = rootElement.querySelector<HTMLElement>('[data-system-os-version]');
  const runtimeValue = rootElement.querySelector<HTMLElement>('[data-system-runtime]');
  const trustedValue = rootElement.querySelector<HTMLElement>('[data-system-trusted]');
  const currentDeviceValue = rootElement.querySelector<HTMLElement>('[data-system-current-device]');
  const currentMetaValue = rootElement.querySelector<HTMLElement>('[data-system-current-meta]');
  const lastActiveValue = rootElement.querySelector<HTMLElement>('[data-system-last-active]');
  const lastActiveMetaValue = rootElement.querySelector<HTMLElement>(
    '[data-system-last-active-meta]',
  );
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
    deviceList.replaceChildren(
      ...renderRecentDevices(snapshot?.devices.devices ?? [], locale, options.i18n),
    );
  };

  applySnapshot(options.profileStore.getSnapshot());

  let retryTimer: number | null = null;
  const scheduleRetry = (): void => {
    if (retryTimer !== null) {
      return;
    }

    retryTimer = window.setTimeout(() => {
      retryTimer = null;

      if (!rootElement.isConnected) {
        return;
      }

      void loadSnapshot(false);
    }, 1_500);
  };

  const loadSnapshot = async (force: boolean): Promise<void> => {
    try {
      const snapshot = await options.profileStore.load(force);

      if (!rootElement.isConnected) {
        return;
      }

      applySnapshot(snapshot);
      setFeedback(null);
    } catch (error) {
      if (!rootElement.isConnected) {
        return;
      }

      applySnapshot(options.profileStore.getSnapshot());
      setFeedback({
        message: resolveApiErrorMessage(error, options.i18n),
        tone: 'error',
      });

      if (error instanceof AppApiError && error.code === 'BACKEND_UNAVAILABLE') {
        scheduleRetry();
      }
    }
  };

  void loadSnapshot(!options.profileStore.getSnapshot());

  return rootElement;
}

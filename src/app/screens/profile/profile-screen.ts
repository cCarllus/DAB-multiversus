import { resolveAuthErrorMessage } from '@app/auth/auth-service';
import type { AuthSessionSnapshot } from '@app/auth/auth-types';
import { createElementFromTemplate } from '@app/utils/html';
import type { AppI18n } from '@shared/i18n';

import '@app/ui/modal-chrome.css';

import { createProfileAvatarUploader } from './profile-avatar-uploader';
import {
  createProfileDeviceStatus,
  type DeviceListItem,
} from './profile-device-status';
import { createProfileHeader } from './profile-header';
import { createProfileNameEditor } from './profile-name-editor';
import { createProfileOverview } from './profile-overview';
import { type ProfileStore } from './profile-store';
import type { ProfileDevice, ProfileFeedback, ProfileSnapshot } from './profile-types';
import './profile-screen.css';

interface ProfileScreenOptions {
  i18n: AppI18n;
  profileStore: ProfileStore;
  session: AuthSessionSnapshot;
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function buildDeviceMeta(
  device: ProfileDevice | null,
  locale: string,
  fallback: string,
  versionFallback: string,
): string {
  if (!device) {
    return fallback;
  }

  const appVersionLabel = device.appVersion ? `v${device.appVersion}` : versionFallback;
  return `${formatDateTime(device.lastLoginAt, locale)} · ${appVersionLabel}`;
}

function buildRecentDevices(
  devices: ProfileDevice[],
  i18n: AppI18n,
): DeviceListItem[] {
  const messages = i18n.getMessages().menu.profile;
  const locale = i18n.getLocale();

  return devices.slice(0, 3).map((device) => ({
    label: device.label,
    meta: device.appVersion
      ? i18n.t('menu.profile.deviceList.appVersion', {
          version: device.appVersion,
        })
      : messages.deviceList.noVersion,
    state: device.isCurrent
      ? messages.deviceList.current
      : i18n.t('menu.profile.deviceList.lastSeen', {
          date: formatDateTime(device.lastLoginAt, locale),
        }),
  }));
}

export function createProfileScreen(options: ProfileScreenOptions): HTMLElement {
  const messages = options.i18n.getMessages().menu.profile;
  const rootElement = createElementFromTemplate(`
    <main class="home-content home-content--profile-shell">
      <section class="profile-screen">
        <div class="profile-screen__backdrop" aria-hidden="true">
          <div class="profile-screen__halo profile-screen__halo--gold"></div>
          <div class="profile-screen__halo profile-screen__halo--blue"></div>
        </div>

        <div class="profile-screen__feedback" data-profile-feedback hidden></div>
        <div class="profile-screen__content" data-profile-content></div>
      </section>
    </main>
  `);
  const content = rootElement.querySelector<HTMLElement>('[data-profile-content]');
  const feedbackElement = rootElement.querySelector<HTMLElement>('[data-profile-feedback]');

  if (!content || !feedbackElement) {
    throw new Error('Profile screen could not be initialized.');
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

  const avatarUploader = createProfileAvatarUploader({
    i18n: options.i18n,
    onConfirm: async (file) => {
      avatarUploader.setBusy(true);
      setFeedback(null);

      try {
        const snapshot = await options.profileStore.uploadAvatar(file);
        applySnapshot(snapshot);
        setFeedback({
          message: messages.feedback.photoUpdated,
          tone: 'success',
        });
      } catch (error) {
        setFeedback({
          message: resolveAuthErrorMessage(error, options.i18n),
          tone: 'error',
        });
        throw error;
      } finally {
        avatarUploader.setBusy(false);
      }
    },
    onInvalid: (message) => {
      setFeedback({
        message,
        tone: 'error',
      });
    },
  });
  const nameEditor = createProfileNameEditor({
    i18n: options.i18n,
    onInvalid: (message) => {
      setFeedback({
        message,
        tone: 'error',
      });
    },
    onSave: async (name) => {
      nameEditor.setBusy(true);
      setFeedback(null);

      try {
        const snapshot = await options.profileStore.updateName(name);
        applySnapshot(snapshot);
        setFeedback({
          message: messages.feedback.nameUpdated,
          tone: 'success',
        });
      } catch (error) {
        setFeedback({
          message: resolveAuthErrorMessage(error, options.i18n),
          tone: 'error',
        });
        throw error;
      } finally {
        nameEditor.setBusy(false);
      }
    },
  });
  const header = createProfileHeader({
    avatarUploader,
    i18n: options.i18n,
    nameEditor,
  });
  const overview = createProfileOverview(options.i18n);
  const deviceStatus = createProfileDeviceStatus(options.i18n);
  const stack = createElementFromTemplate(`
    <div class="profile-screen__stack" data-profile-stack></div>
  `);
  stack.append(overview.element, deviceStatus.element);
  content.append(header.element, stack, avatarUploader.modal);

  const applySnapshot = (snapshot: ProfileSnapshot): void => {
    const locale = options.i18n.getLocale();
    const languageLabel = options.i18n.getMessages().login.locale.options[locale].label;
    const memberSince = formatDate(snapshot.profile.createdAt, locale);
    const launcherStatus = messages.status.launcherReady;
    const trustedDeviceStatus = options.session.rememberDevice
      ? messages.status.trustedDeviceSaved
      : messages.status.sessionOnly;
    const currentDeviceLabel =
      snapshot.devices.currentDevice?.label ?? messages.fallbackValue;
    const lastActiveLabel =
      snapshot.devices.lastActiveDevice?.label ?? messages.fallbackValue;

    header.setState({
      accountStatus: launcherStatus,
      languageLabel,
      memberSince,
      profile: snapshot.profile,
      trustedDevice: trustedDeviceStatus,
      userId: `@${snapshot.profile.nickname}`,
    });

    overview.setState({
      currentDeviceLabel,
      languageLabel,
      launcherStatus,
      trustedDeviceStatus,
    });

    deviceStatus.setState({
      currentDeviceMeta: buildDeviceMeta(
        snapshot.devices.currentDevice,
        locale,
        messages.fallbackValue,
        messages.deviceList.noVersion,
      ),
      currentDeviceStatus: currentDeviceLabel,
      lastActiveMeta: buildDeviceMeta(
        snapshot.devices.lastActiveDevice,
        locale,
        messages.fallbackValue,
        messages.deviceList.noVersion,
      ),
      lastActiveStatus: lastActiveLabel,
      recentDevices: buildRecentDevices(snapshot.devices.devices, options.i18n),
      trustedDeviceStatus,
    });
  };

  const cachedSnapshot = options.profileStore.getSnapshot();

  if (cachedSnapshot) {
    applySnapshot(cachedSnapshot);
  }

  void options.profileStore
    .load(!cachedSnapshot)
    .then((snapshot) => {
      applySnapshot(snapshot);
    })
    .catch((error) => {
      setFeedback({
        message: resolveAuthErrorMessage(error, options.i18n),
        tone: 'error',
      });
    });

  return rootElement;
}

import { resolveApiErrorMessage } from '@app/services/api/api-error';
import type { AuthSessionSnapshot } from '@app/services/auth/auth-types';
import type {
  DeviceListItem,
  ProfileFeedback,
  ProfileSnapshot,
} from '@app/services/profile/profile.types';
import { createElementFromTemplate } from '@app/utils/html';
import type { AppI18n } from '@shared/i18n';
import type { ProfileStore } from '@app/stores/profile.store';

import '@app/ui/modal-chrome.css';

import { createProfileAccountDetails } from './profile-account-details';
import { createProfileAvatarUploader } from './profile-avatar-uploader';
import { createProfileDeviceStatus } from './profile-device-status';
import { createProfileHeader } from './profile-header';
import { createProfileNameEditor } from './profile-name-editor';
import { createProfileOverview } from './profile-overview';
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
  appVersion: string | null,
  lastLoginAt: string,
  locale: string,
  i18n: AppI18n,
): string {
  const messages = i18n.getMessages().menu.profile;
  const versionLabel = appVersion
    ? i18n.t('menu.profile.deviceList.appVersion', {
        version: appVersion,
      })
    : messages.deviceList.noVersion;

  return `${formatDateTime(lastLoginAt, locale)} · ${versionLabel}`;
}

export function createProfileScreen(options: ProfileScreenOptions): HTMLElement {
  const messages = options.i18n.getMessages().menu.profile;
  const rootElement = createElementFromTemplate(`
    <main class="home-content home-content--profile-shell">
      <section class="profile-screen">
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
          message: resolveApiErrorMessage(error, options.i18n),
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
          message: resolveApiErrorMessage(error, options.i18n),
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
  const accountDetails = createProfileAccountDetails(options.i18n);
  const deviceStatus = createProfileDeviceStatus(options.i18n);

  content.append(
    header.element,
    overview.element,
    accountDetails.element,
    deviceStatus.element,
    avatarUploader.modal,
  );

  const applySnapshot = (snapshot: ProfileSnapshot): void => {
    const locale = options.i18n.getLocale();
    const languageLabel = options.i18n.getMessages().login.locale.options[locale].label;
    const memberSince = formatDate(snapshot.profile.createdAt, locale);
    const launcherStatus = messages.status.launcherReady;
    const trustedDeviceStatus = options.session.rememberDevice
      ? messages.status.trustedDeviceSaved
      : messages.status.sessionOnly;
    const currentDevice = snapshot.devices.currentDevice;
    const lastActiveDevice = snapshot.devices.lastActiveDevice;
    const recentDevices: DeviceListItem[] = snapshot.devices.devices.slice(0, 5).map((device) => ({
      label: device.label,
      meta: buildDeviceMeta(device.appVersion, device.lastLoginAt, locale, options.i18n),
      state: device.isCurrent
        ? messages.deviceList.current
        : options.i18n.t('menu.profile.deviceList.lastSeen', {
            date: formatDateTime(device.lastLoginAt, locale),
          }),
    }));

    header.setState({
      accountStatus: launcherStatus,
      languageLabel,
      memberSince,
      profile: snapshot.profile,
      trustedDevice: trustedDeviceStatus,
      userId: `@${snapshot.profile.nickname}`,
    });
    overview.setState({
      currentDeviceLabel: currentDevice?.label ?? messages.fallbackValue,
      languageLabel,
      launcherStatus,
      trustedDeviceStatus,
    });
    accountDetails.setState({
      languageLabel,
      memberSince,
      profile: snapshot.profile,
    });
    deviceStatus.setState({
      currentDeviceMeta: currentDevice
        ? buildDeviceMeta(currentDevice.appVersion, currentDevice.lastLoginAt, locale, options.i18n)
        : messages.fallbackValue,
      currentDeviceStatus: currentDevice?.label ?? messages.fallbackValue,
      lastActiveMeta: lastActiveDevice
        ? buildDeviceMeta(
            lastActiveDevice.appVersion,
            lastActiveDevice.lastLoginAt,
            locale,
            options.i18n,
          )
        : messages.fallbackValue,
      lastActiveStatus: lastActiveDevice?.label ?? messages.fallbackValue,
      recentDevices,
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
        message: resolveApiErrorMessage(error, options.i18n),
        tone: 'error',
      });
    });

  return rootElement;
}

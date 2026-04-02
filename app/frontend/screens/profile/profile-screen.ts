import { resolveApiErrorMessage } from '@frontend/services/api/api-error';
import type { AuthSessionSnapshot } from '@frontend/services/auth/auth-types';
import type { ProfileFeedback, ProfileSnapshot } from '@frontend/services/profile/profile.types';
import { createElementFromTemplate } from '@frontend/lib/html';
import type { AppI18n } from '@shared/i18n';
import type { ProfileStore } from '@frontend/stores/profile.store';

import '@frontend/components/modal-chrome.css';

import profileScreenTemplate from './profile-screen.html?raw';
import { createProfileAvatarUploader } from './profile-avatar-uploader';
import { createProfileHeader } from './profile-header';
import { createProfileNameEditor } from './profile-name-editor';
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

export function createProfileScreen(options: ProfileScreenOptions): HTMLElement {
  const messages = options.i18n.getMessages().menu.profile;
  const rootElement = createElementFromTemplate(profileScreenTemplate);
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

  content.append(header.element, avatarUploader.modal);

  const applySnapshot = (snapshot: ProfileSnapshot): void => {
    const locale = options.i18n.getLocale();
    const languageLabel = options.i18n.getMessages().login.locale.options[locale].label;
    const memberSince = formatDate(snapshot.profile.createdAt, locale);
    const launcherStatus = messages.status.launcherReady;
    const trustedDeviceStatus = options.session.rememberDevice
      ? messages.status.trustedDeviceSaved
      : messages.status.sessionOnly;

    header.setState({
      accountStatus: launcherStatus,
      languageLabel,
      memberSince,
      profile: snapshot.profile,
      trustedDevice: trustedDeviceStatus,
      userId: `@${snapshot.profile.nickname}`,
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

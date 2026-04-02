import { createElementFromTemplate } from '@app/utils/html';
import type { AppI18n } from '@shared/i18n';
import type { AuthUser } from '@app/services/auth/auth-types';

import profileHeaderTemplate from './profile-header.html?raw';
import type { ProfileAvatarUploader } from './profile-avatar-uploader';
import type { ProfileNameEditor } from './profile-name-editor';

interface CreateProfileHeaderOptions {
  avatarUploader: ProfileAvatarUploader;
  i18n: AppI18n;
  nameEditor: ProfileNameEditor;
}

export interface ProfileHeader {
  element: HTMLElement;
  setState: (input: {
    accountStatus: string;
    languageLabel: string;
    memberSince: string;
    profile: AuthUser;
    trustedDevice: string;
    userId: string;
  }) => void;
}

export function createProfileHeader(options: CreateProfileHeaderOptions): ProfileHeader {
  const messages = options.i18n.getMessages().menu.profile;
  const element = createElementFromTemplate(profileHeaderTemplate, {
    PROFILE_HERO_ARIA_LABEL: messages.heroAriaLabel,
    PROFILE_LANGUAGE_LABEL: messages.hero.language,
    PROFILE_LAUNCHER_STATUS_LABEL: messages.hero.launcherStatus,
    PROFILE_MEMBER_SINCE_LABEL: messages.hero.memberSince,
    PROFILE_TRUSTED_DEVICE_LABEL: messages.hero.trustedDevice,
    PROFILE_USER_ID_LABEL: messages.hero.userId,
  });
  const avatarSlot = element.querySelector<HTMLElement>('[data-avatar-slot]');
  const nameSlot = element.querySelector<HTMLElement>('[data-name-slot]');
  const memberSinceValue = element.querySelector<HTMLElement>('[data-member-since]');
  const userIdValue = element.querySelector<HTMLElement>('[data-user-id-value]');
  const launcherStatusValue = element.querySelector<HTMLElement>('[data-launcher-status]');
  const languageValue = element.querySelector<HTMLElement>('[data-language-value]');
  const trustedDeviceValue = element.querySelector<HTMLElement>('[data-trusted-device]');

  if (
    !avatarSlot ||
    !nameSlot ||
    !memberSinceValue ||
    !userIdValue ||
    !launcherStatusValue ||
    !languageValue ||
    !trustedDeviceValue
  ) {
    throw new Error('Profile header could not be initialized.');
  }

  avatarSlot.append(options.avatarUploader.button);
  nameSlot.append(options.nameEditor.element);

  return {
    element,
    setState(input) {
      options.avatarUploader.setProfile(input.profile);
      options.nameEditor.setProfile(input.profile);
      memberSinceValue.textContent = input.memberSince;
      userIdValue.textContent = input.userId;
      launcherStatusValue.textContent = input.accountStatus;
      languageValue.textContent = input.languageLabel;
      trustedDeviceValue.textContent = input.trustedDevice;
    },
  };
}

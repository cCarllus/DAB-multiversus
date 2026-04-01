import { createElementFromTemplate } from '@app/utils/html';
import type { AppI18n } from '@shared/i18n';
import type { AuthUser } from '@app/services/auth/auth-types';

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
  const element = createElementFromTemplate(`
    <section class="profile-hero" aria-label="${messages.heroAriaLabel}">
      <div class="profile-hero__avatar-slot" data-avatar-slot></div>

      <div class="profile-hero__copy">
        <div class="profile-hero__name-slot" data-name-slot></div>

        <div class="profile-hero__meta">
          <span class="profile-hero__meta-pill">
            <span class="profile-hero__meta-label">${messages.hero.memberSince}</span>
            <strong class="profile-hero__meta-value" data-member-since></strong>
          </span>

          <span class="profile-hero__meta-pill">
            <span class="profile-hero__meta-label">${messages.hero.userId}</span>
            <strong class="profile-hero__meta-value" data-user-id-value></strong>
          </span>

          <span class="profile-hero__meta-pill">
            <span class="profile-hero__meta-label">${messages.hero.launcherStatus}</span>
            <strong class="profile-hero__meta-value" data-launcher-status></strong>
          </span>

          <span class="profile-hero__meta-pill">
            <span class="profile-hero__meta-label">${messages.hero.language}</span>
            <strong class="profile-hero__meta-value" data-language-value></strong>
          </span>

          <span class="profile-hero__meta-pill">
            <span class="profile-hero__meta-label">${messages.hero.trustedDevice}</span>
            <strong class="profile-hero__meta-value" data-trusted-device></strong>
          </span>
        </div>
      </div>
    </section>
  `);
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

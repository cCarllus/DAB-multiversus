import { createElementFromTemplate } from '@frontend/lib/html';
import type { AppI18n } from '@shared/i18n';
import type { AuthUser } from '@frontend/services/auth/auth-types';

import {
  MAX_PROFILE_AVATAR_BYTES,
  PROFILE_AVATAR_ACCEPT,
} from '@frontend/services/profile/profile.types';

import profileAvatarModalTemplate from './profile-avatar-modal.html?raw';
import profileAvatarUploaderTemplate from './profile-avatar-uploader.html?raw';

interface CreateProfileAvatarUploaderOptions {
  i18n: AppI18n;
  onConfirm: (file: File) => Promise<void> | void;
  onInvalid: (message: string) => void;
}

export interface ProfileAvatarUploader {
  button: HTMLElement;
  modal: HTMLElement;
  setBusy: (busy: boolean) => void;
  setProfile: (profile: AuthUser) => void;
}

function getInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) {
    return 'DA';
  }

  return parts
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
}

export function createProfileAvatarUploader(
  options: CreateProfileAvatarUploaderOptions,
): ProfileAvatarUploader {
  const messages = options.i18n.getMessages().menu.profile;
  const acceptedTypes = new Set(PROFILE_AVATAR_ACCEPT.split(','));
  const button = createElementFromTemplate(profileAvatarUploaderTemplate, {
    PROFILE_AVATAR_ACCEPT,
    PROFILE_AVATAR_CHANGE_PHOTO: messages.avatar.changePhoto,
  });
  const modal = createElementFromTemplate(profileAvatarModalTemplate, {
    PROFILE_AVATAR_CANCEL: messages.avatar.cancel,
    PROFILE_AVATAR_CONFIRM: messages.avatar.confirm,
    PROFILE_AVATAR_PREVIEW_EYEBROW: messages.avatar.previewEyebrow,
    PROFILE_AVATAR_PREVIEW_SUMMARY: messages.avatar.previewSummary,
    PROFILE_AVATAR_PREVIEW_TITLE: messages.avatar.previewTitle,
  });
  const image = button.querySelector<HTMLElement>('[data-avatar-image]');
  const monogram = button.querySelector<HTMLElement>('[data-avatar-monogram]');
  const fileInput = button.querySelector<HTMLInputElement>('[data-avatar-input]');
  const trigger = button.querySelector<HTMLButtonElement>('[data-avatar-trigger]');
  const previewImage = modal.querySelector<HTMLElement>('[data-avatar-preview-image]');
  const confirmButton = modal.querySelector<HTMLButtonElement>('[data-avatar-confirm]');
  const cancelButtons = modal.querySelectorAll<HTMLElement>('[data-avatar-cancel]');

  if (!image || !monogram || !fileInput || !trigger || !previewImage || !confirmButton) {
    throw new Error('Profile avatar uploader could not be initialized.');
  }

  let previewFile: File | null = null;
  let previewUrl: string | null = null;

  const hideModal = (): void => {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
  };

  const showModal = (): void => {
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'grid';
  };

  const clearPreview = (): void => {
    previewFile = null;
    previewImage.style.backgroundImage = '';
    hideModal();

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }

    fileInput.value = '';
  };

  const openPreview = (file: File): void => {
    previewFile = file;
    previewUrl = URL.createObjectURL(file);
    previewImage.style.backgroundImage = `url("${previewUrl}")`;
    showModal();
  };

  hideModal();

  trigger.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type || !acceptedTypes.has(file.type)) {
      options.onInvalid(messages.feedback.invalidAvatarType);
      clearPreview();
      return;
    }

    if (file.size > MAX_PROFILE_AVATAR_BYTES) {
      options.onInvalid(messages.feedback.avatarTooLarge);
      clearPreview();
      return;
    }

    openPreview(file);
  });

  cancelButtons.forEach((buttonElement) => {
    buttonElement.addEventListener('click', clearPreview);
  });

  confirmButton.addEventListener('click', () => {
    if (!previewFile) {
      return;
    }

    void Promise.resolve(options.onConfirm(previewFile))
      .then(() => {
        clearPreview();
      })
      .catch(() => undefined);
  });

  return {
    button,
    modal,
    setBusy(busy) {
      trigger.disabled = busy;
      fileInput.disabled = busy;
      confirmButton.disabled = busy;
      confirmButton.textContent = busy ? messages.avatar.uploading : messages.avatar.confirm;
    },
    setProfile(profile) {
      const label = profile.name || profile.nickname || profile.email;
      monogram.textContent = getInitials(label);

      if (profile.profileImageUrl) {
        image.style.backgroundImage = `url("${profile.profileImageUrl}")`;
        image.dataset.hasImage = 'true';
      } else {
        image.style.backgroundImage = '';
        image.dataset.hasImage = 'false';
      }
    },
  };
}

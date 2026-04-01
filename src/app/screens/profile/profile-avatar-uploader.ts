import { createElementFromTemplate } from '@app/utils/html';
import type { AppI18n } from '@shared/i18n';
import type { AuthUser } from '@app/services/auth/auth-types';

import {
  MAX_PROFILE_AVATAR_BYTES,
  PROFILE_AVATAR_ACCEPT,
} from '@app/services/profile/profile.types';

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
  const parts = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

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
  const button = createElementFromTemplate(`
    <div class="profile-avatar">
      <button type="button" class="profile-avatar__button" data-avatar-trigger>
        <span class="profile-avatar__image" data-avatar-image></span>
        <span class="profile-avatar__monogram" data-avatar-monogram></span>
        <span class="profile-avatar__overlay">${messages.avatar.changePhoto}</span>
      </button>
      <input
        accept="${PROFILE_AVATAR_ACCEPT}"
        class="profile-avatar__input"
        data-avatar-input
        hidden
        type="file"
      />
    </div>
  `);
  const modal = createElementFromTemplate(`
    <div class="profile-avatar-modal" data-avatar-modal hidden>
      <div class="profile-avatar-modal__backdrop" data-avatar-cancel></div>
      <div class="profile-avatar-modal__panel" role="dialog" aria-modal="true">
        <button type="button" class="launcher-modal-dismiss" data-avatar-cancel>
          <span class="launcher-modal-dismiss__icon">×</span>
        </button>

        <div class="profile-avatar-modal__copy">
          <p class="profile-avatar-modal__eyebrow">${messages.avatar.previewEyebrow}</p>
          <h3 class="profile-avatar-modal__title">${messages.avatar.previewTitle}</h3>
          <p class="profile-avatar-modal__summary">${messages.avatar.previewSummary}</p>
        </div>

        <div class="profile-avatar-modal__preview">
          <span class="profile-avatar-modal__image" data-avatar-preview-image></span>
        </div>

        <div class="profile-avatar-modal__actions">
          <button type="button" class="profile-avatar-modal__confirm" data-avatar-confirm>
            ${messages.avatar.confirm}
          </button>
          <button type="button" class="profile-avatar-modal__cancel" data-avatar-cancel>
            ${messages.avatar.cancel}
          </button>
        </div>
      </div>
    </div>
  `);
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

    void Promise.resolve(options.onConfirm(previewFile)).then(() => {
      clearPreview();
    }).catch(() => undefined);
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

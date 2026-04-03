import { createElementFromTemplate } from '@frontend/lib/html';
import type { AppI18n } from '@shared/i18n';
import type { AuthUser } from '@frontend/services/auth/auth-types';

import profileNameEditorTemplate from './profile-name-editor.html?raw';

interface CreateProfileNameEditorOptions {
  i18n: AppI18n;
  onInvalid?: (message: string) => void;
  onSave?: (name: string) => Promise<void> | void;
}

export interface ProfileNameEditor {
  element: HTMLElement;
  setBusy: (busy: boolean) => void;
  setProfile: (profile: AuthUser) => void;
}

export function createProfileNameEditor(
  options: CreateProfileNameEditorOptions,
): ProfileNameEditor {
  const messages = options.i18n.getMessages().menu.profile;
  const element = createElementFromTemplate(profileNameEditorTemplate, {
    PROFILE_NAME_EDITOR_HINT: messages.nameEditor.hint,
    PROFILE_NAME_EDITOR_INPUT_LABEL: messages.nameEditor.inputLabel,
    PROFILE_NAME_EDITOR_LABEL: messages.nameEditor.label,
  });
  const view = element.querySelector<HTMLElement>('[data-name-view]');
  const value = element.querySelector<HTMLElement>('[data-name-value]');
  const nickname = element.querySelector<HTMLElement>('[data-name-nickname]');

  if (!view || !value || !nickname) {
    throw new Error('Profile name editor could not be initialized.');
  }

  return {
    element,
    setBusy(_busy) {
      // Name changes now live in launcher settings, so this panel stays read-only.
    },
    setProfile(profile) {
      view.hidden = false;
      view.style.display = '';
      value.textContent = profile.name || messages.fallbackUsername;
      nickname.textContent = profile.nickname ? `@${profile.nickname}` : '';
    },
  };
}

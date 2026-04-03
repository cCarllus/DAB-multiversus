import { createElementFromTemplate } from '@frontend/lib/html';
import type { AppI18n } from '@shared/i18n';
import type { AuthUser } from '@frontend/services/auth/auth-types';

import profileNameEditorTemplate from './profile-name-editor.html?raw';

interface CreateProfileNameEditorOptions {
  i18n: AppI18n;
  onInvalid: (message: string) => void;
  onSave: (name: string) => Promise<void> | void;
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
    PROFILE_NAME_EDITOR_CANCEL: messages.nameEditor.cancel,
    PROFILE_NAME_EDITOR_EDIT: messages.nameEditor.edit,
    PROFILE_NAME_EDITOR_HINT: messages.nameEditor.hint,
    PROFILE_NAME_EDITOR_INPUT_LABEL: messages.nameEditor.inputLabel,
    PROFILE_NAME_EDITOR_LABEL: messages.nameEditor.label,
    PROFILE_NAME_EDITOR_SAVE: messages.nameEditor.save,
  });
  const view = element.querySelector<HTMLElement>('[data-name-view]');
  const form = element.querySelector<HTMLFormElement>('[data-name-form]');
  const value = element.querySelector<HTMLElement>('[data-name-value]');
  const nickname = element.querySelector<HTMLElement>('[data-name-nickname]');
  const formNickname = element.querySelector<HTMLElement>('[data-name-form-nickname]');
  const input = element.querySelector<HTMLInputElement>('[data-name-input]');
  const editButton = element.querySelector<HTMLButtonElement>('[data-name-edit]');
  const cancelButton = element.querySelector<HTMLButtonElement>('[data-name-cancel]');
  const saveButton = element.querySelector<HTMLButtonElement>('[data-name-save]');

  if (
    !view ||
    !form ||
    !value ||
    !nickname ||
    !formNickname ||
    !input ||
    !editButton ||
    !cancelButton ||
    !saveButton
  ) {
    throw new Error('Profile name editor could not be initialized.');
  }

  let currentName = '';

  const hideView = (): void => {
    view.hidden = true;
    view.style.display = 'none';
  };

  const showView = (): void => {
    view.hidden = false;
    view.style.display = '';
  };

  const hideForm = (): void => {
    form.hidden = true;
    form.style.display = 'none';
  };

  const showForm = (): void => {
    form.hidden = false;
    form.style.display = 'grid';
  };

  const toggleEditing = (editing: boolean): void => {
    if (editing) {
      hideView();
      showForm();
    } else {
      showView();
      hideForm();
    }

    if (editing) {
      input.focus();
      input.select();
    }
  };

  toggleEditing(false);

  editButton.addEventListener('click', () => {
    input.value = currentName;
    toggleEditing(true);
  });

  cancelButton.addEventListener('click', () => {
    input.value = currentName;
    toggleEditing(false);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const nextName = input.value.trim().replace(/\s+/g, ' ');

    if (nextName.length < 2) {
      options.onInvalid(messages.feedback.invalidName);
      return;
    }

    void Promise.resolve(options.onSave(nextName))
      .then(() => {
        toggleEditing(false);
      })
      .catch(() => undefined);
  });

  return {
    element,
    setBusy(busy) {
      input.disabled = busy;
      editButton.disabled = busy;
      cancelButton.disabled = busy;
      saveButton.disabled = busy;
      saveButton.textContent = busy ? messages.nameEditor.saving : messages.nameEditor.save;
    },
    setProfile(profile) {
      currentName = profile.name;
      value.textContent = profile.name || messages.fallbackUsername;
      nickname.textContent = profile.nickname;
      formNickname.textContent = profile.nickname;
      input.value = profile.name;
    },
  };
}

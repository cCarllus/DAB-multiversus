import { createElementFromTemplate } from '@app/utils/html';
import type { AppI18n } from '@shared/i18n';
import type { AuthUser } from '@app/services/auth/auth-types';

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
  const element = createElementFromTemplate(`
    <section class="profile-name-editor">
      <div class="profile-name-editor__view" data-name-view>
        <span class="profile-name-editor__label">${messages.nameEditor.label}</span>
        <div class="profile-name-editor__row">
          <h1 class="profile-name-editor__value" data-name-value></h1>
          <button type="button" class="profile-name-editor__edit" data-name-edit>
            ${messages.nameEditor.edit}
          </button>
        </div>
        <p class="profile-name-editor__hint">${messages.nameEditor.hint}</p>
      </div>

      <form class="profile-name-editor__form" data-name-form hidden>
        <label class="profile-name-editor__field">
          <span class="profile-name-editor__label">${messages.nameEditor.inputLabel}</span>
          <input
            class="profile-name-editor__input"
            data-name-input
            maxlength="40"
            type="text"
          />
        </label>

        <div class="profile-name-editor__actions">
          <button type="submit" class="profile-name-editor__save" data-name-save>
            ${messages.nameEditor.save}
          </button>
          <button type="button" class="profile-name-editor__cancel" data-name-cancel>
            ${messages.nameEditor.cancel}
          </button>
        </div>
      </form>
    </section>
  `);
  const view = element.querySelector<HTMLElement>('[data-name-view]');
  const form = element.querySelector<HTMLFormElement>('[data-name-form]');
  const value = element.querySelector<HTMLElement>('[data-name-value]');
  const input = element.querySelector<HTMLInputElement>('[data-name-input]');
  const editButton = element.querySelector<HTMLButtonElement>('[data-name-edit]');
  const cancelButton = element.querySelector<HTMLButtonElement>('[data-name-cancel]');
  const saveButton = element.querySelector<HTMLButtonElement>('[data-name-save]');

  if (!view || !form || !value || !input || !editButton || !cancelButton || !saveButton) {
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

    void Promise.resolve(options.onSave(nextName)).then(() => {
      toggleEditing(false);
    }).catch(() => undefined);
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
      value.textContent = profile.name;
      input.value = profile.name;
    },
  };
}

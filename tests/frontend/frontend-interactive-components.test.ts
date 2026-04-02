// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLoginScreen } from '../../app/frontend/screens/login/login-screen';
import { createProfileAvatarUploader } from '../../app/frontend/screens/profile/profile-avatar-uploader';
import { createProfileHeader } from '../../app/frontend/screens/profile/profile-header';
import { createProfileNameEditor } from '../../app/frontend/screens/profile/profile-name-editor';
import { MAX_PROFILE_AVATAR_BYTES } from '../../app/frontend/services/profile/profile.types';
import { createTestI18n, createTestUser, flushPromises } from '../helpers/frontend';

async function importWithHtmlStub<T>(modulePath: string, html: HTMLElement): Promise<T> {
  vi.resetModules();
  vi.doMock('@frontend/lib/html', () => ({
    createElementFromTemplate: vi.fn(() => html),
  }));

  return import(modulePath) as Promise<T>;
}

function setInputFiles(input: HTMLInputElement, files: File[]): void {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: files,
  });
}

describe('frontend interactive components', () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
    URL.createObjectURL = vi.fn(() => 'blob:avatar-preview');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('renders the login screen and submits trimmed values', async () => {
    const onSubmit = vi.fn();
    const onLocaleChange = vi.fn();
    const onDevShortcutSubmit = vi.fn();
    const screen = createLoginScreen({
      appVersion: '0.1.0',
      enableDevShortcut: true,
      errorMessage: 'Bad credentials',
      identifier: ' player@example.com ',
      i18n: createTestI18n('en'),
      isSubmitting: false,
      locale: 'en',
      musicMuted: true,
      onDevShortcutSubmit,
      onLocaleChange,
      onSubmit,
      rememberDevice: true,
      rememberDeviceSupported: true,
    });

    document.body.append(screen);
    await flushPromises();

    const identifier = screen.querySelector<HTMLInputElement>('[data-login-identifier]')!;
    const password = screen.querySelector<HTMLInputElement>('[data-login-password]')!;
    const remember = screen.querySelector<HTMLInputElement>('[data-login-remember]')!;
    const form = screen.querySelector<HTMLFormElement>('[data-login-form]')!;
    const localeOption = screen.querySelector<HTMLButtonElement>(
      '[data-login-locale-option="pt-BR"]',
    )!;
    const devShortcut = screen.querySelector<HTMLButtonElement>('[data-login-dev-shortcut]')!;

    expect(screen.textContent).toContain('Bad credentials');
    expect(identifier.value).toBe(' player@example.com ');
    expect(remember.checked).toBe(true);
    expect(document.activeElement).toBe(identifier);

    identifier.value = '  player@example.com  ';
    password.value = '12345678';
    form.dispatchEvent(new Event('submit'));
    expect(onSubmit).toHaveBeenCalledWith({
      identifier: 'player@example.com',
      password: '12345678',
      rememberDevice: true,
    });

    localeOption.click();
    expect(onLocaleChange).toHaveBeenCalledWith('pt-BR');

    devShortcut.click();
    expect(identifier.value).toBe('teste@dab.local');
    expect(password.value).toBe('SenhaForte123!');
    expect(onDevShortcutSubmit).toHaveBeenCalled();
  });

  it('keeps the login screen inert while submitting or when callbacks are unavailable', () => {
    const onSubmit = vi.fn();
    const onLocaleChange = vi.fn();
    const submitting = createLoginScreen({
      appVersion: '0.1.0',
      enableDevShortcut: false,
      i18n: createTestI18n('en'),
      isSubmitting: true,
      locale: 'en',
      musicMuted: false,
      onLocaleChange,
      onSubmit,
      rememberDevice: true,
      rememberDeviceSupported: false,
    });
    const identifier = submitting.querySelector<HTMLInputElement>('[data-login-identifier]')!;
    const form = submitting.querySelector<HTMLFormElement>('[data-login-form]')!;
    const localeOption = submitting.querySelector<HTMLButtonElement>(
      '[data-login-locale-option="en"]',
    )!;
    const devShortcut = submitting.querySelector<HTMLButtonElement>('[data-login-dev-shortcut]')!;

    expect(identifier.disabled).toBe(true);
    expect(devShortcut.hidden).toBe(true);
    expect(
      submitting.querySelector<HTMLElement>('[data-login-remember-hint]')?.textContent,
    ).toContain('Electron launcher');

    form.dispatchEvent(new Event('submit'));
    localeOption.click();
    devShortcut.click();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onLocaleChange).not.toHaveBeenCalled();

    const noCallbackScreen = createLoginScreen({
      appVersion: '0.1.0',
      enableDevShortcut: true,
      i18n: createTestI18n('en'),
      isSubmitting: false,
      locale: 'en',
      musicMuted: false,
      onSubmit: vi.fn(),
      rememberDevice: true,
      rememberDeviceSupported: true,
    });
    const noCallbackLocale = noCallbackScreen.querySelector<HTMLButtonElement>(
      '[data-login-locale-option="pt-BR"]',
    )!;
    const noCallbackDevShortcut = noCallbackScreen.querySelector<HTMLButtonElement>(
      '[data-login-dev-shortcut]',
    )!;
    const localeDetails = noCallbackScreen.querySelector<HTMLDetailsElement>(
      '[data-login-locale-details]',
    )!;

    localeDetails.open = true;
    noCallbackLocale.click();
    expect(localeDetails.open).toBe(false);
    noCallbackDevShortcut.click();
  });

  it('throws when the login screen structure is incomplete', async () => {
    const brokenElement = document.createElement('div');
    const { createLoginScreen: createBrokenLoginScreen } = await importWithHtmlStub<{
      createLoginScreen: typeof createLoginScreen;
    }>('../../app/frontend/screens/login/login-screen', brokenElement);

    expect(() =>
      createBrokenLoginScreen({
        appVersion: '0.1.0',
        i18n: createTestI18n('en'),
        isSubmitting: false,
        locale: 'en',
        musicMuted: false,
        onSubmit: vi.fn(),
        rememberDevice: true,
        rememberDeviceSupported: true,
      }),
    ).toThrow('Login screen could not be initialized.');
  });

  it('edits profile names with validation, busy state, and error handling', async () => {
    const onInvalid = vi.fn();
    const onSave = vi.fn(async () => undefined);
    const editor = createProfileNameEditor({
      i18n: createTestI18n('en'),
      onInvalid,
      onSave,
    });

    document.body.append(editor.element);
    editor.setProfile(createTestUser());

    const edit = editor.element.querySelector<HTMLButtonElement>('[data-name-edit]')!;
    const cancel = editor.element.querySelector<HTMLButtonElement>('[data-name-cancel]')!;
    const input = editor.element.querySelector<HTMLInputElement>('[data-name-input]')!;
    const form = editor.element.querySelector<HTMLFormElement>('[data-name-form]')!;
    const view = editor.element.querySelector<HTMLElement>('[data-name-view]')!;
    const save = editor.element.querySelector<HTMLButtonElement>('[data-name-save]')!;

    expect(view.hidden).toBe(false);
    edit.click();
    expect(view.hidden).toBe(true);
    expect(document.activeElement).toBe(input);

    input.value = 'a';
    form.dispatchEvent(new Event('submit'));
    expect(onInvalid).toHaveBeenCalled();

    input.value = '  Updated   Player ';
    form.dispatchEvent(new Event('submit'));
    await flushPromises();
    expect(onSave).toHaveBeenCalledWith('Updated Player');
    expect(view.hidden).toBe(false);

    edit.click();
    input.value = 'Another Name';
    cancel.click();
    expect(input.value).toBe('Player One');

    editor.setBusy(true);
    expect(input.disabled).toBe(true);
    expect(save.textContent).toContain('Saving');
    editor.setBusy(false);
    expect(save.textContent).toContain('Save');

    const failingEditor = createProfileNameEditor({
      i18n: createTestI18n('en'),
      onInvalid: vi.fn(),
      onSave: vi.fn(async () => {
        throw new Error('failed');
      }),
    });
    failingEditor.setProfile(createTestUser());
    const failingEdit = failingEditor.element.querySelector<HTMLButtonElement>('[data-name-edit]')!;
    const failingInput = failingEditor.element.querySelector<HTMLInputElement>('[data-name-input]')!;
    const failingForm = failingEditor.element.querySelector<HTMLFormElement>('[data-name-form]')!;
    failingEdit.click();
    failingInput.value = 'Updated';
    failingForm.dispatchEvent(new Event('submit'));
    await flushPromises();
    expect(failingEditor.element.querySelector<HTMLElement>('[data-name-view]')?.hidden).toBe(
      true,
    );
  });

  it('throws when the profile name editor or profile header structure is incomplete', async () => {
    const brokenElement = document.createElement('div');
    const { createProfileNameEditor: createBrokenNameEditor } = await importWithHtmlStub<{
      createProfileNameEditor: typeof createProfileNameEditor;
    }>('../../app/frontend/screens/profile/profile-name-editor', brokenElement);

    expect(() =>
      createBrokenNameEditor({
        i18n: createTestI18n('en'),
        onInvalid: vi.fn(),
        onSave: vi.fn(),
      }),
    ).toThrow('Profile name editor could not be initialized.');

    const { createProfileHeader: createBrokenHeader } = await importWithHtmlStub<{
      createProfileHeader: typeof createProfileHeader;
    }>('../../app/frontend/screens/profile/profile-header', brokenElement);

    expect(() =>
      createBrokenHeader({
        avatarUploader: {
          button: document.createElement('button'),
          modal: document.createElement('div'),
          setBusy: vi.fn(),
          setProfile: vi.fn(),
        },
        i18n: createTestI18n('en'),
        nameEditor: {
          element: document.createElement('div'),
          setBusy: vi.fn(),
          setProfile: vi.fn(),
        },
      }),
    ).toThrow('Profile header could not be initialized.');
  });

  it('handles avatar upload previews, validation, busy state, and profile rendering', async () => {
    const onConfirm = vi.fn(async () => undefined);
    const onInvalid = vi.fn();
    const uploader = createProfileAvatarUploader({
      i18n: createTestI18n('en'),
      onConfirm,
      onInvalid,
    });
    document.body.append(uploader.button, uploader.modal);

    const trigger = uploader.button.querySelector<HTMLButtonElement>('[data-avatar-trigger]')!;
    const fileInput = uploader.button.querySelector<HTMLInputElement>('[data-avatar-input]')!;
    const confirm = uploader.modal.querySelector<HTMLButtonElement>('[data-avatar-confirm]')!;
    const cancel = uploader.modal.querySelector<HTMLElement>('[data-avatar-cancel]')!;
    const preview = uploader.modal.querySelector<HTMLElement>('[data-avatar-preview-image]')!;
    const image = uploader.button.querySelector<HTMLElement>('[data-avatar-image]')!;
    const monogram = uploader.button.querySelector<HTMLElement>('[data-avatar-monogram]')!;

    uploader.setProfile(createTestUser());
    expect(monogram.textContent).toBe('PO');
    expect(image.dataset.hasImage).toBe('false');

    uploader.setProfile(
      createTestUser({
        name: '',
        nickname: '',
        email: '',
        profileImageUrl: 'https://example.com/avatar.png',
      }),
    );
    expect(monogram.textContent).toBe('DA');
    expect(image.dataset.hasImage).toBe('true');

    trigger.click();
    expect(fileInput).toBeDefined();
    confirm.click();
    expect(onConfirm).not.toHaveBeenCalled();

    setInputFiles(fileInput, []);
    fileInput.dispatchEvent(new Event('change'));
    expect(onInvalid).not.toHaveBeenCalled();

    setInputFiles(fileInput, [new File(['avatar'], 'avatar.txt', { type: 'text/plain' })]);
    fileInput.dispatchEvent(new Event('change'));
    expect(onInvalid).toHaveBeenCalled();
    expect(uploader.modal.hidden).toBe(true);

    setInputFiles(
      fileInput,
      [new File([new Uint8Array(MAX_PROFILE_AVATAR_BYTES + 1)], 'avatar.png', { type: 'image/png' })],
    );
    fileInput.dispatchEvent(new Event('change'));
    expect(onInvalid).toHaveBeenCalledTimes(2);

    const validFile = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    setInputFiles(fileInput, [validFile]);
    fileInput.dispatchEvent(new Event('change'));
    expect(uploader.modal.hidden).toBe(false);
    expect(preview.style.backgroundImage).toContain('blob:avatar-preview');

    uploader.setBusy(true);
    expect(confirm.disabled).toBe(true);
    uploader.setBusy(false);
    expect(confirm.textContent).toContain('Update photo');

    confirm.click();
    await flushPromises();
    expect(onConfirm).toHaveBeenCalledWith(validFile);
    expect(uploader.modal.hidden).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalled();

    setInputFiles(fileInput, [validFile]);
    fileInput.dispatchEvent(new Event('change'));
    cancel.click();
    expect(uploader.modal.hidden).toBe(true);

    const failingUploader = createProfileAvatarUploader({
      i18n: createTestI18n('en'),
      onConfirm: vi.fn(async () => {
        throw new Error('failed');
      }),
      onInvalid: vi.fn(),
    });
    document.body.append(failingUploader.button, failingUploader.modal);
    const failingInput = failingUploader.button.querySelector<HTMLInputElement>('[data-avatar-input]')!;
    const failingConfirm = failingUploader.modal.querySelector<HTMLButtonElement>('[data-avatar-confirm]')!;
    setInputFiles(failingInput, [validFile]);
    failingInput.dispatchEvent(new Event('change'));
    failingConfirm.click();
    await flushPromises();
    expect(failingUploader.modal.hidden).toBe(false);
  });

  it('throws when the avatar uploader structure is incomplete', async () => {
    const brokenElement = document.createElement('div');
    const { createProfileAvatarUploader: createBrokenUploader } = await importWithHtmlStub<{
      createProfileAvatarUploader: typeof createProfileAvatarUploader;
    }>('../../app/frontend/screens/profile/profile-avatar-uploader', brokenElement);

    expect(() =>
      createBrokenUploader({
        i18n: createTestI18n('en'),
        onConfirm: vi.fn(),
        onInvalid: vi.fn(),
      }),
    ).toThrow('Profile avatar uploader could not be initialized.');
  });

  it('updates profile header state through the nested avatar uploader and name editor', () => {
    const avatarUploader = {
      button: document.createElement('button'),
      modal: document.createElement('div'),
      setBusy: vi.fn(),
      setProfile: vi.fn(),
    };
    const nameEditor = {
      element: document.createElement('div'),
      setBusy: vi.fn(),
      setProfile: vi.fn(),
    };
    const header = createProfileHeader({
      avatarUploader,
      i18n: createTestI18n('en'),
      nameEditor,
    });

    header.setState({
      accountStatus: 'Ready',
      languageLabel: 'English',
      memberSince: 'Jan 01, 2024',
      profile: createTestUser(),
      trustedDevice: 'Trusted',
      userId: '@player.one',
    });

    expect(avatarUploader.setProfile).toHaveBeenCalled();
    expect(nameEditor.setProfile).toHaveBeenCalled();
    expect(header.element.textContent).toContain('Ready');
    expect(header.element.textContent).toContain('@player.one');
  });
});

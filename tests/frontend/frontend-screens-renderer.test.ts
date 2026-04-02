// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMenuScreen } from '../../app/frontend/screens/menu/menu-screen';
import { createProfileScreen } from '../../app/frontend/screens/profile/profile-screen';
import { createSystemScreen } from '../../app/frontend/screens/system/system-screen';
import {
  createDesktopBridgeMock,
  createTestI18n,
  createTestProfileSnapshot,
  createTestSessionSnapshot,
  createTestUser,
  flushPromises,
  resetDom,
} from '../helpers/frontend';

async function importWithHtmlStub<T>(modulePath: string, html: HTMLElement): Promise<T> {
  vi.resetModules();
  vi.doMock('@frontend/lib/html', () => ({
    createElementFromTemplate: vi.fn(() => html),
  }));

  return import(modulePath) as Promise<T>;
}

describe('frontend composed screens and renderer', () => {
  beforeEach(() => {
    resetDom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('renders profile screen with cached and loaded snapshots plus feedback updates', async () => {
    const snapshot = createTestProfileSnapshot();
    const load = vi.fn(async () => snapshot);
    const updateName = vi.fn(async () => snapshot);
    const uploadAvatar = vi.fn(async () => snapshot);
    URL.createObjectURL = vi.fn(() => 'blob:avatar-preview');
    URL.revokeObjectURL = vi.fn();

    const screen = createProfileScreen({
      i18n: createTestI18n('en'),
      profileStore: {
        getSnapshot: vi.fn(() => snapshot),
        load,
        updateName,
        uploadAvatar,
      } as never,
      session: createTestSessionSnapshot(),
    });
    document.body.append(screen);
    await flushPromises();

    expect(load).toHaveBeenCalledWith(false);
    expect(screen.textContent).toContain(snapshot.profile.nickname);
    expect(screen.textContent).toContain('Trusted');

    const editButton = screen.querySelector<HTMLButtonElement>('[data-name-edit]')!;
    const nameInput = screen.querySelector<HTMLInputElement>('[data-name-input]')!;
    const nameForm = screen.querySelector<HTMLFormElement>('[data-name-form]')!;
    editButton.click();
    nameInput.value = 'Name';
    nameForm.dispatchEvent(new Event('submit'));
    await flushPromises();
    expect(updateName).toHaveBeenCalledWith('Name');
    expect(screen.textContent).toContain('Display name updated.');

    const avatarInput = screen.querySelector<HTMLInputElement>('[data-avatar-input]')!;
    const confirmAvatar = screen.querySelector<HTMLButtonElement>('[data-avatar-confirm]')!;
    Object.defineProperty(avatarInput, 'files', {
      configurable: true,
      value: [new File(['avatar'], 'avatar.png', { type: 'image/png' })],
    });
    avatarInput.dispatchEvent(new Event('change'));
    confirmAvatar.click();
    await flushPromises();
    expect(uploadAvatar).toHaveBeenCalled();
    expect(screen.textContent).toContain('Profile photo updated');

    updateName.mockRejectedValueOnce(new Error('save failed'));
    editButton.click();
    nameInput.value = 'Name';
    nameForm.dispatchEvent(new Event('submit'));
    await flushPromises();
    expect(screen.textContent).toContain('save failed');

    uploadAvatar.mockRejectedValueOnce(new Error('upload failed'));
    avatarInput.dispatchEvent(new Event('change'));
    confirmAvatar.click();
    await flushPromises();
    expect(screen.textContent).toContain('upload failed');

    const sessionOnlyScreen = createProfileScreen({
      i18n: createTestI18n('en'),
      profileStore: {
        getSnapshot: vi.fn(() => snapshot),
        load: vi.fn(async () => snapshot),
        updateName: vi.fn(async () => snapshot),
        uploadAvatar: vi.fn(async () => snapshot),
      } as never,
      session: createTestSessionSnapshot({
        rememberDevice: false,
      }),
    });
    document.body.append(sessionOnlyScreen);
    await flushPromises();
    expect(sessionOnlyScreen.textContent).toContain('Session only');
  });

  it('loads the profile screen without a cached snapshot and handles load failures', async () => {
    const header = {
      element: document.createElement('div'),
      setState: vi.fn(),
    };
    vi.doMock('../../app/frontend/screens/profile/profile-avatar-uploader', () => ({
      createProfileAvatarUploader: vi.fn(() => ({
        button: document.createElement('button'),
        modal: document.createElement('div'),
        setBusy: vi.fn(),
        setProfile: vi.fn(),
      })),
    }));
    vi.doMock('../../app/frontend/screens/profile/profile-header', () => ({
      createProfileHeader: vi.fn(() => header),
    }));
    vi.doMock('../../app/frontend/screens/profile/profile-name-editor', () => ({
      createProfileNameEditor: vi.fn(() => ({
        element: document.createElement('div'),
        setBusy: vi.fn(),
        setProfile: vi.fn(),
      })),
    }));

    const { createProfileScreen: createScreen } = await import(
      '../../app/frontend/screens/profile/profile-screen'
    );
    const screen = createScreen({
      i18n: createTestI18n('en'),
      profileStore: {
        getSnapshot: vi.fn(() => null),
        load: vi.fn(async () => {
          throw new Error('load failed');
        }),
      } as never,
      session: createTestSessionSnapshot({
        rememberDevice: false,
      }),
    });
    document.body.append(screen);
    await flushPromises();
    expect(screen.textContent).toContain('load failed');
  });

  it('surfaces invalid profile edits from nested uploader and name editor callbacks', async () => {
    let avatarInvalid: ((message: string) => void) | null = null;
    let nameInvalid: ((message: string) => void) | null = null;

    vi.doMock('../../app/frontend/screens/profile/profile-avatar-uploader', () => ({
      createProfileAvatarUploader: vi.fn((options: { onInvalid: (message: string) => void }) => {
        avatarInvalid = options.onInvalid;
        return {
          button: document.createElement('button'),
          modal: document.createElement('div'),
          setBusy: vi.fn(),
          setProfile: vi.fn(),
        };
      }),
    }));
    vi.doMock('../../app/frontend/screens/profile/profile-header', () => ({
      createProfileHeader: vi.fn(() => ({
        element: document.createElement('div'),
        setState: vi.fn(),
      })),
    }));
    vi.doMock('../../app/frontend/screens/profile/profile-name-editor', () => ({
      createProfileNameEditor: vi.fn((options: { onInvalid: (message: string) => void }) => {
        nameInvalid = options.onInvalid;
        return {
          element: document.createElement('div'),
          setBusy: vi.fn(),
          setProfile: vi.fn(),
        };
      }),
    }));

    const { createProfileScreen: createScreen } = await import(
      '../../app/frontend/screens/profile/profile-screen'
    );
    const screen = createScreen({
      i18n: createTestI18n('en'),
      profileStore: {
        getSnapshot: vi.fn(() => createTestProfileSnapshot()),
        load: vi.fn(async () => createTestProfileSnapshot()),
      } as never,
      session: createTestSessionSnapshot(),
    });
    document.body.append(screen);
    await flushPromises();

    avatarInvalid?.('invalid avatar');
    expect(screen.textContent).toContain('invalid avatar');
    nameInvalid?.('invalid name');
    expect(screen.textContent).toContain('invalid name');
  });

  it('throws when the profile screen structure is incomplete', async () => {
    const brokenElement = document.createElement('div');
    const { createProfileScreen: createBrokenScreen } = await importWithHtmlStub<{
      createProfileScreen: typeof createProfileScreen;
    }>('../../app/frontend/screens/profile/profile-screen', brokenElement);

    expect(() =>
      createBrokenScreen({
        i18n: createTestI18n('en'),
        profileStore: {
          getSnapshot: vi.fn(() => null),
          load: vi.fn(),
        } as never,
        session: createTestSessionSnapshot(),
      }),
    ).toThrow('Profile screen could not be initialized.');
  });

  it('renders the system screen with device data and error fallback', async () => {
    const snapshot = createTestProfileSnapshot();
    const load = vi.fn(async () => snapshot);
    const store = {
      getSnapshot: vi.fn(() => snapshot),
      load,
    };

    const system = createSystemScreen({
      desktop: createDesktopBridgeMock(),
      i18n: createTestI18n('en'),
      profileStore: store as never,
      session: createTestSessionSnapshot(),
    });
    document.body.append(system);
    await flushPromises();

    expect(system.textContent).toContain('Electron 31');
    expect(system.textContent).toContain(snapshot.devices.currentDevice?.label ?? '');
    expect(load).toHaveBeenCalledWith(false);

    const failed = createSystemScreen({
      desktop: createDesktopBridgeMock({
        platform: '',
        osVersion: '',
      }),
      i18n: createTestI18n('en'),
      profileStore: {
        getSnapshot: vi.fn(() => null),
        load: vi.fn(async () => {
          throw new Error('devices failed');
        }),
      } as never,
      session: createTestSessionSnapshot({
        rememberDevice: false,
      }),
    });
    document.body.append(failed);
    await flushPromises();
    expect(failed.textContent).toContain('Session only');
    expect(failed.textContent).toContain('devices failed');

    const windows = createSystemScreen({
      desktop: createDesktopBridgeMock({
        platform: 'win32',
      }),
      i18n: createTestI18n('en'),
      profileStore: store as never,
      session: createTestSessionSnapshot(),
    });
    document.body.append(windows);
    await flushPromises();
    expect(windows.textContent).toContain('Windows');

    const browser = createSystemScreen({
      desktop: createDesktopBridgeMock({
        platform: 'browser',
      }),
      i18n: createTestI18n('en'),
      profileStore: store as never,
      session: createTestSessionSnapshot(),
    });
    document.body.append(browser);
    await flushPromises();
    expect(browser.textContent).toContain('Browser');

    const noVersionSnapshot = createTestProfileSnapshot({
      devices: {
        ...snapshot.devices,
        devices: snapshot.devices.devices.map((device, index) =>
          index === 0 ? { ...device, appVersion: null } : device,
        ),
      },
    });
    const noVersionSystem = createSystemScreen({
      desktop: createDesktopBridgeMock(),
      i18n: createTestI18n('en'),
      profileStore: {
        getSnapshot: vi.fn(() => noVersionSnapshot),
        load: vi.fn(async () => noVersionSnapshot),
      } as never,
      session: createTestSessionSnapshot(),
    });
    document.body.append(noVersionSystem);
    await flushPromises();
    expect(noVersionSystem.textContent).toContain(
      createTestI18n('en').getMessages().menu.system.list.noVersion,
    );

    const linux = createSystemScreen({
      desktop: createDesktopBridgeMock({
        platform: 'linux',
      }),
      i18n: createTestI18n('en'),
      profileStore: store as never,
      session: createTestSessionSnapshot(),
    });
    document.body.append(linux);
    await flushPromises();
    expect(linux.textContent).toContain('Linux');
  });

  it('throws when the system screen structure is incomplete', async () => {
    const brokenElement = document.createElement('div');
    const { createSystemScreen: createBrokenSystemScreen } = await importWithHtmlStub<{
      createSystemScreen: typeof createSystemScreen;
    }>('../../app/frontend/screens/system/system-screen', brokenElement);

    expect(() =>
      createBrokenSystemScreen({
        desktop: createDesktopBridgeMock(),
        i18n: createTestI18n('en'),
        profileStore: {
          getSnapshot: vi.fn(() => null),
          load: vi.fn(),
        } as never,
        session: createTestSessionSnapshot(),
      }),
    ).toThrow('System screen could not be initialized.');
  });

  it('renders the menu screen for home, profile, system, and exit modal variants', () => {
    const i18n = createTestI18n('en');
    const snapshot = createTestProfileSnapshot();
    const profileStore = {
      getSnapshot: vi.fn(() => null),
      load: vi.fn(async () => snapshot),
    };

    const home = createMenuScreen({
      desktop: createDesktopBridgeMock(),
      i18n,
      musicMuted: false,
      profileStore: profileStore as never,
      session: createTestSessionSnapshot(),
      user: createTestUser(),
      view: 'home',
    });
    expect(home.textContent).toContain(i18n.getMessages().product.title);

    const profile = createMenuScreen({
      desktop: createDesktopBridgeMock(),
      i18n,
      musicMuted: false,
      profileStore: profileStore as never,
      session: createTestSessionSnapshot(),
      user: createTestUser(),
      view: 'profile',
    });
    expect(profile.querySelector('[data-profile-content]')).not.toBeNull();

    const system = createMenuScreen({
      desktop: createDesktopBridgeMock(),
      i18n,
      musicMuted: true,
      profileStore: profileStore as never,
      session: createTestSessionSnapshot(),
      user: createTestUser(),
      view: 'system',
      exitModal: {
        errorMessage: 'logout failed',
        isLoggingOut: false,
        status: 'open',
      },
    });
    expect(system.textContent).toContain('logout failed');
    expect(system.textContent).toContain(createTestUser().name);
  });

  it('renders the fatal screen when renderer bootstrap fails and throws without app root', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    resetDom('<div id="app"></div>');
    vi.doMock('@frontend/bootstrap/bootstrapApplication', () => ({
      bootstrapApplication: vi.fn(() => {
        throw new Error('bootstrap failed');
      }),
    }));

    await import('../../app/frontend/bootstrap/renderer');
    expect(document.querySelector('#app')?.innerHTML.length).toBeGreaterThan(0);
    expect(errorSpy).toHaveBeenCalled();

    vi.resetModules();
    document.body.innerHTML = '';
    await expect(import('../../app/frontend/bootstrap/renderer')).rejects.toThrow(
      'Application root element "#app" was not found.',
    );
  });

  it('boots the renderer when bootstrap succeeds', async () => {
    resetDom('<div id="app"></div>');
    const bootstrapApplication = vi.fn();
    vi.doMock('@frontend/bootstrap/bootstrapApplication', () => ({
      bootstrapApplication,
    }));

    await import('../../app/frontend/bootstrap/renderer');
    expect(bootstrapApplication).toHaveBeenCalledWith(
      document.querySelector<HTMLElement>('#app'),
    );
  });
});

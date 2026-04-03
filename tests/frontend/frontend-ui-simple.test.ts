// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApplicationShell } from '../../app/frontend/layout/create-application-shell';
import { createMenuFooterBar } from '../../app/frontend/layout/menu/createMenuFooterBar';
import { createMenuNavbar } from '../../app/frontend/layout/menu/createMenuNavbar';
import { createMenuShell } from '../../app/frontend/layout/menu/createMenuShell';
import { createAppRouter } from '../../app/frontend/navigation/app-router';
import { createLauncherHistory } from '../../app/frontend/navigation/launcher-history';
import { createExitModal } from '../../app/frontend/components/exit-modal';
import { createBootScreen } from '../../app/frontend/screens/boot/boot-screen';
import { createGameScreen } from '../../app/game/shell/game-screen';
import { createHomeScreen } from '../../app/frontend/screens/home/home-screen';
import { createLoadingScreen } from '../../app/frontend/screens/loading/loading-screen';
import { createDesktopBridgeMock, createTestI18n, createTestSessionSnapshot, createTestUser } from '../helpers/frontend';

async function importWithHtmlStub<T>(modulePath: string, html: HTMLElement): Promise<T> {
  vi.resetModules();
  vi.doMock('@frontend/lib/html', () => ({
    createElementFromTemplate: vi.fn(() => html),
  }));

  return import(modulePath) as Promise<T>;
}

describe('frontend simple ui modules', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('creates the application shell and swaps pages', () => {
    const host = document.querySelector<HTMLElement>('#host')!;
    const shell = createApplicationShell(host);
    const page = document.createElement('div');
    page.textContent = 'page';
    const overlay = document.createElement('div');
    overlay.textContent = 'overlay';

    shell.setPage(page);
    shell.setOverlay(overlay);

    expect(shell.interactiveLayer).toBeInstanceOf(HTMLElement);
    expect(host.textContent).toContain('page');
    expect(host.textContent).toContain('overlay');

    shell.setOverlay(null);
    expect(host.textContent).not.toContain('overlay');
  });

  it('throws when the application shell structure is incomplete', async () => {
    const host = document.querySelector<HTMLElement>('#host')!;
    const brokenElement = document.createElement('div');
    const { createApplicationShell: createBrokenShell } = await importWithHtmlStub<{
      createApplicationShell: typeof createApplicationShell;
    }>('../../app/frontend/layout/create-application-shell', brokenElement);

    expect(() => createBrokenShell(host)).toThrow('Application shell could not be initialized.');
  });

  it('renders menu shell, navbar, footer, and exit modal states', () => {
    const i18n = createTestI18n('en');
    const content = document.createElement('section');
    content.textContent = 'content';

    const navbar = createMenuNavbar({
      activeView: 'profile',
      brandImage: '/brand.png',
      canGoBack: true,
      canGoForward: false,
      i18n,
      isSettingsOpen: true,
    });
    expect(navbar.textContent).toContain(i18n.getMessages().menu.topbar.tabs.system);
    expect(navbar.querySelector('[data-action="show-profile-page"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(
      navbar.querySelector('[data-action="navigate-history-back"]')?.hasAttribute('disabled'),
    ).toBe(false);
    expect(
      navbar.querySelector('[data-action="navigate-history-forward"]')?.hasAttribute('disabled'),
    ).toBe(true);
    expect(navbar.querySelector('[data-action="open-settings-modal"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(navbar.querySelector('[data-topbar-level]')).toBeNull();

    const footer = createMenuFooterBar({
      i18n,
      musicMuted: true,
    });
    expect(footer.textContent).toContain(i18n.getMessages().menu.footer.play);
    expect(footer.innerHTML).toContain('icon-mic-off');

    const shell = createMenuShell({
      activeView: 'home',
      brandImage: '/brand.png',
      canGoBack: false,
      canGoForward: true,
      content,
      i18n,
      isSettingsOpen: false,
      musicMuted: false,
    });
    expect(shell.textContent).toContain('content');
    expect(shell.querySelector('[data-action="toggle-music-mute"]')).not.toBeNull();

    const profileShell = createMenuShell({
      activeView: 'profile',
      brandImage: '/brand.png',
      canGoBack: true,
      canGoForward: false,
      content: document.createElement('div'),
      i18n,
      isSettingsOpen: false,
      musicMuted: false,
    });
    expect(profileShell.querySelector('[data-action="toggle-music-mute"]')).toBeNull();

    const exitModal = createExitModal({
      errorMessage: 'logout failed',
      i18n,
      isClosing: true,
      isLoggingOut: true,
      userLabel: 'Player One',
    });
    expect(exitModal.textContent).toContain('Player One');
    expect(exitModal.textContent).toContain('logout failed');
    expect(exitModal.className).toContain('exit-modal--closing');

    const quietExitModal = createExitModal({
      i18n,
      isClosing: false,
      isLoggingOut: false,
      userLabel: 'Player One',
    });
    expect(quietExitModal.querySelector('[data-exit-modal-error]')?.textContent).toBe('');
  });

  it('throws when menu shell or exit modal structure is incomplete', async () => {
    const brokenMenu = document.createElement('div');
    const { createMenuShell: createBrokenMenuShell } = await importWithHtmlStub<{
      createMenuShell: typeof createMenuShell;
    }>('../../app/frontend/layout/menu/createMenuShell', brokenMenu);

    expect(() =>
      createBrokenMenuShell({
        activeView: 'home',
        brandImage: '/brand.png',
        canGoBack: false,
        canGoForward: false,
        content: document.createElement('div'),
        i18n: createTestI18n('en'),
        isSettingsOpen: false,
        musicMuted: false,
      }),
    ).toThrow('Menu shell frame could not be initialized.');

    const brokenExitModal = document.createElement('div');
    const { createExitModal: createBrokenExitModal } = await importWithHtmlStub<{
      createExitModal: typeof createExitModal;
    }>('../../app/frontend/components/exit-modal', brokenExitModal);

    expect(() =>
      createBrokenExitModal({
        i18n: createTestI18n('en'),
        isClosing: false,
        isLoggingOut: false,
        userLabel: 'Player',
      }),
    ).toThrow('Exit modal could not be initialized.');
  });

  it('renders boot, home, game, and loading screens and updates loading state', () => {
    const i18n = createTestI18n('en');
    const user = createTestUser();

    const boot = createBootScreen({
      appVersion: '0.1.0',
      i18n,
      status: 'Booting',
    });
    expect(boot.textContent).toContain('Booting');
    expect(boot.textContent).toContain('v0.1.0');

    const home = createHomeScreen({
      i18n,
      user,
    });
    expect(home.textContent).toContain(i18n.getMessages().product.title);
    expect(home.innerHTML).toContain('data:image/svg+xml');

    const homeWithAvatar = createHomeScreen({
      i18n,
      user: createTestUser({
        profileImageUrl: 'https://example.com/avatar.png',
      }),
    });
    expect(homeWithAvatar.innerHTML).toContain('https://example.com/avatar.png');

    const homeWithFallbackMonogram = createHomeScreen({
      i18n,
      user: createTestUser({
        email: '',
        name: '',
        nickname: '',
      }),
    });
    expect(homeWithFallbackMonogram.innerHTML).toContain('%3F');

    const game = createGameScreen({
      appVersion: '0.1.0',
      i18n,
      user,
    });
    expect(game.textContent).toContain(user.email);
    expect(game.textContent).toContain('v0.1.0');

    const loading = createLoadingScreen({
      appVersion: '0.1.0',
      detail: 'Preparing',
      eyebrow: 'Loading',
      i18n,
      progress: 0.25,
      status: 'Starting',
    });
    expect(loading.element.textContent).toContain('Preparing');
    expect(loading.element.textContent).toContain('25%');

    loading.setState({
      detail: undefined,
      progress: Number.NaN,
      title: 'Custom',
    });
    expect(loading.element.textContent).toContain('Custom');
    expect(loading.element.textContent).toContain('0%');

    loading.setState({
      progress: 2,
      status: 'Done',
    });
    expect(loading.element.textContent).toContain('100%');
    expect(loading.element.textContent).toContain('Done');

    loading.setState({
      title: undefined,
    });
    expect(loading.element.textContent).toContain(i18n.getMessages().loading.defaultTitle);
  });

  it('throws when game or loading screen structure is incomplete', async () => {
    const brokenElement = document.createElement('div');
    const { createGameScreen: createBrokenGameScreen } = await importWithHtmlStub<{
      createGameScreen: typeof createGameScreen;
    }>('../../app/game/shell/game-screen', brokenElement);
    const { createLoadingScreen: createBrokenLoadingScreen } = await importWithHtmlStub<{
      createLoadingScreen: typeof createLoadingScreen;
    }>('../../app/frontend/screens/loading/loading-screen', brokenElement);

    expect(() =>
      createBrokenGameScreen({
        appVersion: '0.1.0',
        i18n: createTestI18n('en'),
        user: createTestUser(),
      }),
    ).toThrow('Game screen could not be initialized.');

    expect(() =>
      createBrokenLoadingScreen({
        appVersion: '0.1.0',
        eyebrow: 'Loading',
        i18n: createTestI18n('en'),
        progress: 0,
        status: 'Loading',
      }),
    ).toThrow('Loading screen could not be initialized.');
  });

  it('routes shell updates to screen factories', () => {
    const host = document.querySelector<HTMLElement>('#host')!;
    const shell = createApplicationShell(host);
    const i18n = createTestI18n('en');
    const router = createAppRouter({
      appVersion: '0.1.0',
      i18n,
      shell,
    });

    router.showBoot('Booting');
    expect(host.textContent).toContain('Booting');

    const loading = router.showLoading({
      detail: 'Preparing',
      eyebrow: 'Loading',
      progress: 0.5,
      status: 'Starting',
    });
    expect(host.textContent).toContain('50%');
    loading.setState({
      progress: 0.75,
    });
    expect(host.textContent).toContain('75%');

    router.showLogin({
      appVersion: '0.1.0',
      i18n,
      isSubmitting: false,
      locale: 'en',
      musicMuted: false,
      onSubmit: vi.fn(),
      rememberDevice: true,
      rememberDeviceSupported: true,
    } as never);
    expect(host.querySelector('[data-login-form]')).not.toBeNull();

    router.showMenu({
      canGoBack: false,
      canGoForward: false,
      desktop: createDesktopBridgeMock(),
      i18n,
      isSettingsOpen: false,
      musicMuted: false,
      profileStore: {
        getSnapshot: vi.fn(() => null),
        load: vi.fn(),
      },
      session: createTestSessionSnapshot(),
      user: createTestUser(),
      view: 'home',
    } as never);
    expect(host.querySelector('[data-menu-frame]')).not.toBeNull();

    router.showGame({
      user: createTestUser(),
    });
    expect(host.textContent).toContain(createTestUser().email);
  });

  it('tracks launcher navigation history like a browser stack', () => {
    const history = createLauncherHistory({
      compare: (left, right) => left.view === right.view && left.target === right.target,
      initial: {
        target: null as string | null,
        view: 'home',
      },
    });

    history.push({
      target: null,
      view: 'players',
    });
    history.push({
      target: 'player.one',
      view: 'profile',
    });

    expect(history.getSnapshot()).toMatchObject({
      canGoBack: true,
      canGoForward: false,
      index: 2,
    });
    expect(history.back()).toMatchObject({
      target: null,
      view: 'players',
    });
    expect(history.getSnapshot()).toMatchObject({
      canGoBack: true,
      canGoForward: true,
      index: 1,
    });
    expect(history.forward()).toMatchObject({
      target: 'player.one',
      view: 'profile',
    });

    history.back();
    history.push({
      target: null,
      view: 'system',
    });

    expect(history.getSnapshot()).toMatchObject({
      canGoBack: true,
      canGoForward: false,
      current: {
        target: null,
        view: 'system',
      },
      index: 2,
    });
  });
});

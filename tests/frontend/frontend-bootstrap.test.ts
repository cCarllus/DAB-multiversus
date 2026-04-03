// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDesktopBridgeMock, flushPromises } from '../helpers/frontend';

async function flushTimers(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushPromises();
}

function createLoadingMessages(stepHoldMs = 0) {
  const steps =
    stepHoldMs === 0
      ? [{ holdMs: 0, progress: 1, status: 'Step 1', detail: 'Detail 1' }]
      : [
          { holdMs: stepHoldMs, progress: 0.5, status: 'Step 1', detail: 'Detail 1' },
          { holdMs: stepHoldMs, progress: 1, status: 'Step 2', detail: 'Detail 2' },
        ];

  return {
    boot: {
      statuses: {
        validatingRememberedSession: 'Validating session',
      },
    },
    loading: {
      defaultTitle: 'Loading',
      sequences: {
        gameToMenu: {
          eyebrow: 'Back',
          title: 'Back',
          steps,
        },
        loginToMenu: {
          eyebrow: 'Login',
          title: 'Login',
          steps,
        },
        menuToGame: {
          eyebrow: 'Game',
          title: 'Game',
          steps,
        },
        resumeToMenu: {
          eyebrow: 'Resume',
          title: 'Resume',
          steps,
        },
      },
    },
    login: {
      locale: {
        options: {
          en: {
            label: 'English',
          },
          'pt-BR': {
            label: 'Portuguese',
          },
        },
      },
    },
    menu: {
      exitModal: {
        body: '{{userLabel}}',
      },
      profile: {
        status: {
          launcherReady: 'Ready',
          sessionOnly: 'Session only',
          trustedDeviceSaved: 'Trusted',
        },
      },
    },
  };
}

const bootstrapState = vi.hoisted(() => ({
  audio: {
    bindInteractionSurface: vi.fn(),
    dispose: vi.fn(),
    isMusicMuted: vi.fn(() => false),
    playTransitionCue: vi.fn(),
    toggleMusicMute: vi.fn(() => false),
    toggleSoundMute: vi.fn(() => false),
  },
  currentSession: null as null | {
    user: {
      email: string;
      name: string;
      nickname: string;
    } | null;
  },
  authService: {
    getCurrentSession: vi.fn(() => bootstrapState.currentSession),
    initialize: vi.fn(async () => null),
    login: vi.fn(async () => undefined),
    loginWithDevAccount: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    supportsRememberedSessions: vi.fn(async () => true),
  },
  i18n: {
    currentLocale: 'en' as 'en' | 'pt-BR',
    formatNumber: vi.fn((value: number) => String(value)),
    getLocale: vi.fn(() => bootstrapState.i18n.currentLocale),
    getMessages: vi.fn(() => createLoadingMessages()),
    setLocale: vi.fn((locale: 'en' | 'pt-BR') => {
      bootstrapState.i18n.currentLocale = locale;
    }),
    t: vi.fn((key: string) => key),
  },
  profileStore: {
    reset: vi.fn(),
  },
  router: {
    showBoot: vi.fn(),
    showGame: vi.fn(),
    showLoading: vi.fn(() => ({
      element: document.createElement('div'),
      setState: vi.fn(),
    })),
    showLogin: vi.fn(),
    showMenu: vi.fn(),
  },
  shell: {
    interactiveLayer: document.createElement('div'),
    setPage: vi.fn(),
  },
}));

vi.mock('@frontend/services/audio/app-audio.service', () => ({
  AppAudioManager: function AppAudioManager() {
    return bootstrapState.audio;
  },
}));

vi.mock('@frontend/services/auth/auth-service', () => ({
  AuthService: function AuthService() {
    return bootstrapState.authService;
  },
}));

vi.mock('@frontend/stores/profile.store', () => ({
  ProfileStore: function ProfileStore() {
    return bootstrapState.profileStore;
  },
}));

vi.mock('@frontend/layout/create-application-shell', () => ({
  createApplicationShell: vi.fn(() => bootstrapState.shell),
}));

vi.mock('@frontend/navigation/app-router', () => ({
  createAppRouter: vi.fn(() => bootstrapState.router),
}));

vi.mock('@frontend/services/api/api-error', () => ({
  resolveApiErrorMessage: vi.fn((error: unknown) =>
    error instanceof Error ? error.message : 'unknown error',
  ),
}));

vi.mock('@shared/i18n', () => ({
  createI18n: vi.fn(() => bootstrapState.i18n),
}));

describe('frontend bootstrap application', () => {
  beforeEach(() => {
    bootstrapState.shell.interactiveLayer = document.createElement('div');
    bootstrapState.shell.setPage.mockReset();
    bootstrapState.audio.bindInteractionSurface.mockReset();
    bootstrapState.audio.dispose.mockReset();
    bootstrapState.audio.isMusicMuted.mockReset().mockReturnValue(false);
    bootstrapState.audio.playTransitionCue.mockReset();
    bootstrapState.audio.toggleMusicMute.mockReset().mockReturnValue(false);
    bootstrapState.audio.toggleSoundMute.mockReset().mockReturnValue(false);
    bootstrapState.currentSession = null;
    bootstrapState.authService.getCurrentSession.mockReset().mockImplementation(
      () => bootstrapState.currentSession,
    );
    bootstrapState.authService.initialize.mockReset().mockResolvedValue(null);
    bootstrapState.authService.login.mockReset().mockImplementation(async () => {
      bootstrapState.currentSession = {
        user: {
          email: 'player@example.com',
          name: 'Player One',
          nickname: 'player.one',
        },
      };
    });
    bootstrapState.authService.loginWithDevAccount.mockReset().mockImplementation(async () => {
      bootstrapState.currentSession = {
        user: {
          email: 'player@example.com',
          name: 'Player One',
          nickname: 'player.one',
        },
      };
    });
    bootstrapState.authService.logout.mockReset().mockImplementation(async () => {
      bootstrapState.currentSession = null;
    });
    bootstrapState.authService.supportsRememberedSessions.mockReset().mockResolvedValue(true);
    bootstrapState.profileStore.reset.mockReset();
    bootstrapState.router.showBoot.mockReset();
    bootstrapState.router.showGame.mockReset();
    bootstrapState.router.showLoading.mockReset().mockReturnValue({
      element: document.createElement('div'),
      setState: vi.fn(),
    });
    bootstrapState.router.showLogin.mockReset();
    bootstrapState.router.showMenu.mockReset();
    bootstrapState.i18n.currentLocale = 'en';
    bootstrapState.i18n.getMessages.mockReset().mockImplementation(() => createLoadingMessages());
    bootstrapState.i18n.getLocale.mockImplementation(() => bootstrapState.i18n.currentLocale);
    bootstrapState.i18n.setLocale.mockImplementation((locale: 'en' | 'pt-BR') => {
      bootstrapState.i18n.currentLocale = locale;
    });
    bootstrapState.i18n.t.mockReset().mockImplementation((key: string) => key);
    document.body.innerHTML = '<div id="host"></div>';
    (window as typeof window & { desktop?: unknown }).desktop = createDesktopBridgeMock();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('boots into the login flow, validates submission, and handles login success and failure', async () => {
    const host = document.querySelector<HTMLElement>('#host')!;
    const { bootstrapApplication } = await import('../../app/frontend/bootstrap/bootstrapApplication');

    bootstrapApplication(host);
    await flushPromises();

    expect(bootstrapState.audio.bindInteractionSurface).toHaveBeenCalledWith(
      bootstrapState.shell.interactiveLayer,
    );
    expect(bootstrapState.router.showBoot).toHaveBeenCalledWith('boot.statuses.validatingRememberedSession');
    expect(bootstrapState.router.showLogin).toHaveBeenCalled();

    const firstLoginOptions = bootstrapState.router.showLogin.mock.calls.at(-1)?.[0];
    firstLoginOptions.onSubmit({
      identifier: '',
      password: '',
      rememberDevice: true,
    });
    expect(bootstrapState.router.showLogin.mock.calls.at(-1)?.[0].errorMessage).toBe(
      'auth.validation.missingCredentials',
    );

    bootstrapState.authService.login.mockRejectedValueOnce(new Error('bad login'));
    firstLoginOptions.onSubmit({
      identifier: 'player@example.com',
      password: '12345678',
      rememberDevice: true,
    });
    await flushPromises();
    expect(bootstrapState.router.showLogin.mock.calls.at(-1)?.[0].errorMessage).toBe('bad login');

    bootstrapState.authService.login.mockResolvedValueOnce(undefined);
    bootstrapState.authService.getCurrentSession.mockReturnValue({
      user: {
        email: 'player@example.com',
        name: 'Player One',
        nickname: 'player.one',
      },
    });
    firstLoginOptions.onSubmit({
      identifier: 'player@example.com',
      password: '12345678',
      rememberDevice: true,
    });
    await flushPromises();
    expect(bootstrapState.profileStore.reset).toHaveBeenCalled();
    expect(bootstrapState.audio.playTransitionCue).toHaveBeenCalledWith('screen-shift');
    expect(bootstrapState.router.showLoading).toHaveBeenCalled();
    await flushTimers();
    expect(bootstrapState.router.showMenu).toHaveBeenCalled();
  });

  it('restores sessions, reacts to interactive actions, and processes logout flows', async () => {
    const loggedInSession = {
      user: {
        email: 'player@example.com',
        name: 'Player One',
        nickname: 'player.one',
      },
    };
    bootstrapState.currentSession = loggedInSession;
    bootstrapState.authService.getCurrentSession.mockReturnValue(loggedInSession);
    bootstrapState.authService.initialize.mockImplementationOnce(async () => {
      bootstrapState.currentSession = loggedInSession;
      return loggedInSession;
    });
    const desktop = createDesktopBridgeMock({
      windowControls: {
        close: vi.fn(async () => undefined),
        getState: vi.fn(async () => ({ isMaximized: false })),
        minimize: vi.fn(async () => undefined),
        onStateChange: vi.fn(() => () => undefined),
        toggleMaximize: vi.fn(async () => ({ isMaximized: false })),
      },
    });
    (window as typeof window & { desktop?: unknown }).desktop = desktop;

    const host = document.querySelector<HTMLElement>('#host')!;
    const { bootstrapApplication } = await import('../../app/frontend/bootstrap/bootstrapApplication');
    bootstrapApplication(host);
    await flushPromises();
    await flushTimers();

    expect(bootstrapState.router.showMenu).toHaveBeenCalled();

    const clickAction = async (action: string): Promise<void> => {
      const button = document.createElement('button');
      button.dataset.action = action;
      bootstrapState.shell.interactiveLayer.append(button);
      button.click();
      await flushPromises();
      button.remove();
    };

    await clickAction('toggle-music-mute');
    expect(bootstrapState.audio.toggleMusicMute).toHaveBeenCalled();
    await clickAction('toggle-sound-mute');
    expect(bootstrapState.audio.toggleSoundMute).toHaveBeenCalled();

    await clickAction('show-profile-page');
    expect(bootstrapState.router.showMenu.mock.calls.at(-1)?.[0].view).toBe('profile');
    await clickAction('show-system-page');
    expect(bootstrapState.router.showMenu.mock.calls.at(-1)?.[0].view).toBe('system');
    await clickAction('show-menu-home');
    expect(bootstrapState.router.showMenu.mock.calls.at(-1)?.[0].view).toBe('home');

    await clickAction('play-now');
    await flushTimers();
    expect(bootstrapState.router.showGame).toHaveBeenCalled();

    await clickAction('game-return-menu');
    await flushTimers();
    expect(bootstrapState.router.showMenu).toHaveBeenCalled();

    await clickAction('window-minimize');
    expect(desktop.windowControls.minimize).toHaveBeenCalled();
    await clickAction('window-maximize');
    expect(desktop.windowControls.toggleMaximize).toHaveBeenCalled();

    await clickAction('window-close');
    expect(bootstrapState.router.showMenu.mock.calls.at(-1)?.[0].exitModal).toMatchObject({
      status: 'open',
    });
    await clickAction('dismiss-exit-modal');
    await flushPromises();
    expect(bootstrapState.router.showMenu).toHaveBeenCalled();

    bootstrapState.authService.logout.mockRejectedValueOnce(new Error('logout failed'));
    await clickAction('auth-logout');
    await flushPromises();
    expect(bootstrapState.router.showMenu.mock.calls.at(-1)?.[0].exitModal.errorMessage).toBe(
      'logout failed',
    );

    bootstrapState.authService.logout.mockResolvedValueOnce(undefined);
    bootstrapState.authService.getCurrentSession.mockReturnValue(loggedInSession);
    await clickAction('auth-logout');
    await flushPromises();
    expect(bootstrapState.router.showLogin).toHaveBeenCalled();

    await clickAction('launcher-force-close');
    expect(desktop.windowControls.close).toHaveBeenCalled();

    window.dispatchEvent(new Event('beforeunload'));
    expect(bootstrapState.audio.dispose).toHaveBeenCalled();
  });

  it('handles locale changes, dev shortcut login, init failures, and close fallback outside desktop', async () => {
    const closeSpy = vi.fn();
    Object.defineProperty(window, 'close', {
      configurable: true,
      value: closeSpy,
    });
    (window as typeof window & { desktop?: unknown }).desktop = undefined;
    bootstrapState.authService.initialize.mockRejectedValueOnce(new Error('init failed'));

    const host = document.querySelector<HTMLElement>('#host')!;
    const { bootstrapApplication } = await import('../../app/frontend/bootstrap/bootstrapApplication');
    bootstrapApplication(host);
    await flushPromises();

    expect(bootstrapState.router.showLogin.mock.calls.at(-1)?.[0].errorMessage).toBe('init failed');

    const loginOptions = bootstrapState.router.showLogin.mock.calls.at(-1)?.[0];
    loginOptions.onLocaleChange('pt-BR');
    expect(bootstrapState.i18n.setLocale).toHaveBeenCalledWith('pt-BR');

    bootstrapState.authService.loginWithDevAccount.mockRejectedValueOnce(new Error('dev failed'));
    loginOptions.onDevShortcutSubmit();
    await flushPromises();
    expect(bootstrapState.router.showLogin.mock.calls.at(-1)?.[0].errorMessage).toBe('dev failed');

    bootstrapState.authService.loginWithDevAccount.mockResolvedValueOnce(undefined);
    bootstrapState.authService.getCurrentSession.mockReturnValue({
      user: {
        email: 'player@example.com',
        name: 'Player One',
        nickname: 'player.one',
      },
    });
    loginOptions.onDevShortcutSubmit();
    await flushTimers();
    await flushTimers();
    expect(bootstrapState.router.showMenu).toHaveBeenCalled();

    bootstrapState.currentSession = null;
    const forceClose = document.createElement('button');
    forceClose.dataset.action = 'window-close';
    bootstrapState.shell.interactiveLayer.append(forceClose);
    forceClose.dispatchEvent(new Event('click', { bubbles: true }));
    await flushPromises();
    expect(bootstrapState.router.showLogin).toHaveBeenCalled();
  });

  it('rerenders by locale, cancels overlapping loading sequences, and covers non-menu action guards', async () => {
    vi.useFakeTimers();
    bootstrapState.i18n.getMessages.mockImplementation(() => createLoadingMessages(25));

    const host = document.querySelector<HTMLElement>('#host')!;
    const { bootstrapApplication } = await import('../../app/frontend/bootstrap/bootstrapApplication');
    bootstrapApplication(host);
    await flushPromises();

    const loginOptions = bootstrapState.router.showLogin.mock.calls.at(-1)?.[0];
    const onLocaleChange = loginOptions.onLocaleChange as (locale: 'en' | 'pt-BR') => void;

    bootstrapState.i18n.setLocale.mockClear();
    onLocaleChange('en');
    expect(bootstrapState.i18n.setLocale).not.toHaveBeenCalled();

    onLocaleChange('pt-BR');
    expect(bootstrapState.i18n.setLocale).toHaveBeenCalledWith('pt-BR');
    expect(bootstrapState.router.showLogin.mock.calls.at(-1)?.[0].locale).toBe('pt-BR');

    const clickAction = async (action: string): Promise<void> => {
      const button = document.createElement('button');
      button.dataset.action = action;
      bootstrapState.shell.interactiveLayer.append(button);
      button.click();
      await flushPromises();
      button.remove();
    };

    await clickAction('show-menu-home');
    await clickAction('show-profile-page');
    await clickAction('show-system-page');
    expect(bootstrapState.router.showMenu).not.toHaveBeenCalled();

    bootstrapState.authService.getCurrentSession.mockReturnValue({
      user: {
        email: 'player@example.com',
        name: 'Player One',
        nickname: 'player.one',
      },
    });
    loginOptions.onSubmit({
      identifier: 'player@example.com',
      password: '12345678',
      rememberDevice: true,
    });
    await flushPromises();

    await clickAction('game-return-menu');
    await vi.runAllTimersAsync();
    await flushPromises();
    expect(bootstrapState.router.showMenu).toHaveBeenCalled();

    onLocaleChange('en');
    expect(bootstrapState.router.showMenu.mock.calls.at(-1)?.[0].view).toBe('home');

    await clickAction('play-now');
    await clickAction('game-return-menu');
    await vi.runAllTimersAsync();
    await flushPromises();
    expect(bootstrapState.router.showMenu).toHaveBeenCalled();

    await clickAction('play-now');
    await vi.runAllTimersAsync();
    await flushPromises();
    expect(bootstrapState.router.showGame).toHaveBeenCalled();

    onLocaleChange('pt-BR');
    expect(bootstrapState.router.showGame).toHaveBeenCalled();
  });

  it('covers exit-modal timers, close fallbacks, and authenticated render guards', async () => {
    vi.useFakeTimers();
    const windowCloseSpy = vi.fn();
    Object.defineProperty(window, 'close', {
      configurable: true,
      value: windowCloseSpy,
    });

    const desktop = createDesktopBridgeMock({
      windowControls: {
        close: vi.fn(async () => {
          throw new Error('close failed');
        }),
        getState: vi.fn(async () => ({ isMaximized: false })),
        minimize: vi.fn(async () => undefined),
        onStateChange: vi.fn(() => () => undefined),
        toggleMaximize: vi.fn(async () => ({ isMaximized: false })),
      },
    });
    (window as typeof window & { desktop?: unknown }).desktop = desktop;

    const loggedInSession = {
      accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
      rememberDevice: true,
      sessionExpiresAt: '2099-01-02T00:00:00.000Z',
      user: {
        email: 'player@example.com',
        name: 'Player One',
        nickname: 'player.one',
      },
    };
    bootstrapState.currentSession = loggedInSession;
    bootstrapState.authService.getCurrentSession.mockReturnValue(loggedInSession);
    bootstrapState.authService.initialize.mockResolvedValueOnce(loggedInSession);

    const host = document.querySelector<HTMLElement>('#host')!;
    const { bootstrapApplication } = await import('../../app/frontend/bootstrap/bootstrapApplication');
    bootstrapApplication(host);
    await flushPromises();
    await vi.runAllTimersAsync();
    await flushPromises();

    const clickAction = async (action: string): Promise<void> => {
      const button = document.createElement('button');
      button.dataset.action = action;
      bootstrapState.shell.interactiveLayer.append(button);
      button.click();
      await flushPromises();
      button.remove();
    };

    await clickAction('window-close');
    expect(bootstrapState.router.showMenu.mock.calls.at(-1)?.[0].exitModal?.status).toBe('open');

    await clickAction('dismiss-exit-modal');
    expect(bootstrapState.router.showMenu.mock.calls.at(-1)?.[0].exitModal?.status).toBe('closing');
    await vi.advanceTimersByTimeAsync(180);
    await flushPromises();
    expect(bootstrapState.router.showMenu.mock.calls.at(-1)?.[0].exitModal).toBeUndefined();

    let resolveLogout = () => undefined;
    bootstrapState.authService.logout.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveLogout = resolve;
        }),
    );
    await clickAction('window-close');
    await clickAction('auth-logout');
    const showMenuCallCount = bootstrapState.router.showMenu.mock.calls.length;
    await clickAction('auth-logout');
    await clickAction('dismiss-exit-modal');
    expect(bootstrapState.router.showMenu.mock.calls).toHaveLength(showMenuCallCount);
    resolveLogout();
    await flushPromises();

    bootstrapState.authService.getCurrentSession.mockReturnValue(null);
    await clickAction('launcher-force-close');
    await flushPromises();
    expect(windowCloseSpy).toHaveBeenCalled();

    const closeDisabledDesktop = createDesktopBridgeMock({
      windowControls: undefined,
    });
    (window as typeof window & { desktop?: unknown }).desktop = closeDisabledDesktop;
    document.body.innerHTML = '<div id="host"></div>';
    bootstrapState.currentSession = null;
    bootstrapState.authService.getCurrentSession.mockReturnValue(null);
    bootstrapState.authService.initialize.mockResolvedValueOnce(null);
    bootstrapApplication(document.querySelector<HTMLElement>('#host')!);
    await flushPromises();
    const closeOnlyButton = document.createElement('button');
    closeOnlyButton.dataset.action = 'window-close';
    bootstrapState.shell.interactiveLayer.append(closeOnlyButton);
    closeOnlyButton.click();
    await flushPromises();
    expect(windowCloseSpy).toHaveBeenCalled();

    (window as typeof window & { desktop?: unknown }).desktop = desktop;
    document.body.innerHTML = '<div id="host"></div>';
    bootstrapState.currentSession = loggedInSession;
    bootstrapState.authService.getCurrentSession.mockReturnValue(loggedInSession);
    bootstrapState.authService.initialize.mockResolvedValueOnce(loggedInSession);
    bootstrapApplication(document.querySelector<HTMLElement>('#host')!);
    await flushPromises();
    await vi.runAllTimersAsync();
    await flushPromises();

    bootstrapState.authService.getCurrentSession.mockReturnValue(null);
    expect(() => {
      const button = document.createElement('button');
      button.dataset.action = 'toggle-music-mute';
      bootstrapState.shell.interactiveLayer.append(button);
      button.click();
    }).toThrow('Home page requires an authenticated user session.');

    bootstrapState.authService.getCurrentSession.mockReturnValue(loggedInSession);
    const toGameButton = document.createElement('button');
    toGameButton.dataset.action = 'play-now';
    bootstrapState.shell.interactiveLayer.append(toGameButton);
    toGameButton.click();
    await vi.runAllTimersAsync();
    await flushPromises();

    bootstrapState.authService.getCurrentSession.mockReturnValue(null);
    expect(() => {
      const button = document.createElement('button');
      button.dataset.action = 'toggle-music-mute';
      bootstrapState.shell.interactiveLayer.append(button);
      button.click();
    }).toThrow('Game page requires an authenticated user session.');
  });

  it('exposes fallback desktop bridge helpers and rerenders the boot surface directly', async () => {
    const closeSpy = vi.fn();
    Object.defineProperty(window, 'close', {
      configurable: true,
      value: closeSpy,
    });

    const {
      createDesktopBridgeFallback,
      rerenderActiveSurface,
    } = await import('../../app/frontend/bootstrap/bootstrapApplication');
    const fallback = createDesktopBridgeFallback();

    expect(await fallback.authStorage.getRememberedSession()).toBeNull();
    expect(await fallback.authStorage.isPersistentStorageAvailable()).toBe(false);
    await fallback.authStorage.clearRememberedSession();
    await expect(
      fallback.authStorage.setRememberedSession({
        refreshToken: 'refresh-token',
        rememberDevice: true,
        savedAt: '2024-01-01T00:00:00.000Z',
        sessionExpiresAt: '2099-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow('Secure remembered sessions are unavailable outside Electron.');
    await fallback.windowControls?.close();
    await expect(fallback.windowControls?.getState()).resolves.toEqual({ isMaximized: false });
    await expect(fallback.windowControls?.toggleMaximize()).resolves.toEqual({
      isMaximized: false,
    });
    await fallback.windowControls?.minimize();
    expect(fallback.windowControls?.onStateChange(() => undefined)).toBeTypeOf('function');
    expect(closeSpy).toHaveBeenCalled();

    const router = {
      showBoot: vi.fn(),
    };
    rerenderActiveSurface({
      activeSurface: 'boot',
      i18n: bootstrapState.i18n as never,
      renderGamePage: vi.fn(),
      renderLoginPage: vi.fn(),
      renderMenuPage: vi.fn(),
      router: router as never,
    });
    expect(router.showBoot).toHaveBeenCalledWith('boot.statuses.validatingRememberedSession');
  });
});

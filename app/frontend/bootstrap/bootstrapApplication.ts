import { AppAudioManager } from '@frontend/services/audio/app-audio.service';
import { resolveApiErrorMessage } from '@frontend/services/api/api-error';
import { AuthService } from '@frontend/services/auth/auth-service';
import { type LoginFormValues } from '@frontend/services/auth/auth-types';
import { createDesktopBridgeFallback } from '@frontend/bootstrap/desktop-bridge-fallback';
import {
  rerenderActiveSurface,
  type AppSurface,
} from '@frontend/bootstrap/rerender-active-surface';
import { createApplicationShell } from '@frontend/layout/create-application-shell';
import { createAppRouter } from '@frontend/navigation/app-router';
import { ProfileStore } from '@frontend/stores/profile.store';
import { SocialStore } from '@frontend/stores/social.store';
import {
  createI18n,
  type AppLocale,
  type TranslationMessages,
} from '@shared/i18n';

const EXIT_MODAL_TRANSITION_MS = 180;

interface LoadingStep {
  detail?: string;
  holdMs: number;
  progress: number;
  status: string;
}

interface LoadingSequence {
  eyebrow: string;
  steps: LoadingStep[];
  title: string;
}
type LoadingSequenceKey = keyof TranslationMessages['loading']['sequences'];
type MenuView = 'home' | 'players' | 'profile' | 'system';
export { createDesktopBridgeFallback, rerenderActiveSurface };

export function bootstrapApplication(host: HTMLElement): void {
  const desktop = window.desktop ?? createDesktopBridgeFallback();
  const i18n = createI18n();
  const shell = createApplicationShell(host);
  const router = createAppRouter({
    appVersion: __APP_VERSION__,
    i18n,
    shell,
  });
  const audio = new AppAudioManager();
  const authService = new AuthService(desktop, __APP_VERSION__);
  const profileStore = new ProfileStore({
    appVersion: __APP_VERSION__,
    authService,
    desktop,
  });
  const enableDevLoginShortcut =
    desktop.environment === 'development' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  let rememberDeviceSupported = false;
  let activeSurface: AppSurface = 'boot';
  const socialStore = new SocialStore({
    authService,
  });

  let activeMenuView: MenuView = 'home';
  let activeProfileNickname: string | null = null;
  let loginState = {
    errorMessage: null as string | null,
    identifier: '',
    isSubmitting: false,
    rememberDevice: true,
  };
  let loadingSequenceId = 0;
  let exitModalState = {
    errorMessage: null as string | null,
    isLoggingOut: false,
    status: 'closed' as 'closed' | 'open' | 'closing',
  };
  let exitModalCloseTimer: number | null = null;

  audio.bindInteractionSurface(shell.interactiveLayer);

  const cancelLoadingSequence = (): void => {
    loadingSequenceId += 1;
  };

  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const requestLauncherClose = (): void => {
    const closeWindow = (): void => {
      globalThis.window?.close();
    };

    if (!desktop.windowControls?.close) {
      closeWindow();
      return;
    }

    void desktop.windowControls.close().catch(() => {
      closeWindow();
    });
  };

  const getLoadingSequence = (sequenceKey: LoadingSequenceKey): LoadingSequence => {
    const sequence = i18n.getMessages().loading.sequences[sequenceKey];

    return {
      eyebrow: sequence.eyebrow,
      steps: sequence.steps.map((step) => ({
        detail: step.detail,
        holdMs: step.holdMs,
        progress: step.progress,
        status: step.status,
      })),
      title: sequence.title,
    };
  };

  const resolveMenuPresenceActivity = (): string => {
    if (activeMenuView === 'players') {
      return i18n.t('menu.social.presence.browsingPlayers');
    }

    if (activeMenuView === 'profile') {
      return i18n.t('menu.social.presence.reviewingProfile');
    }

    if (activeMenuView === 'system') {
      return i18n.t('menu.social.presence.checkingSystem');
    }

    return i18n.t('menu.social.presence.inLauncherActivity');
  };

  const renderMenuPage = (): void => {
    const session = authService.getCurrentSession();

    if (!session?.user) {
      throw new Error('Home page requires an authenticated user session.');
    }

    cancelLoadingSequence();
    activeSurface = 'menu';
    router.showMenu({
      desktop,
      musicMuted: audio.isMusicMuted(),
      exitModal:
        exitModalState.status === 'closed'
          ? undefined
          : {
              errorMessage: exitModalState.errorMessage,
              isLoggingOut: exitModalState.isLoggingOut,
              status: exitModalState.status,
            },
      session: {
        accessTokenExpiresAt: session.accessTokenExpiresAt,
        rememberDevice: session.rememberDevice,
        sessionExpiresAt: session.sessionExpiresAt,
      },
      onOpenProfile: (nickname) => {
        openProfileView(nickname);
      },
      profileStore,
      profileTargetNickname: activeProfileNickname,
      socialStore,
      user: session.user,
      view: activeMenuView,
    });

    void socialStore.updatePresence({
      currentActivity: resolveMenuPresenceActivity(),
      status: 'in_launcher',
    }).catch(() => undefined);
  };

  const openProfileView = (nickname: string | null): void => {
    if (activeSurface !== 'menu') {
      return;
    }

    activeProfileNickname = nickname?.trim().toLowerCase() ?? null;
    activeMenuView = 'profile';
    renderMenuPage();
  };

  const renderGamePage = (): void => {
    const session = authService.getCurrentSession();

    if (!session?.user) {
      throw new Error('Game page requires an authenticated user session.');
    }

    cancelLoadingSequence();
    activeSurface = 'game';
    router.showGame({
      user: session.user,
    });

    void socialStore
      .updatePresence({
        currentActivity: i18n.t('menu.social.presence.online'),
        status: 'online',
      })
      .catch(() => undefined);
  };

  const runLoadingSequence = async (sequence: LoadingSequence): Promise<boolean> => {
    const transitionId = ++loadingSequenceId;
    const firstStep = sequence.steps[0];
    const loadingScreen = router.showLoading({
      detail: firstStep?.detail,
      eyebrow: sequence.eyebrow,
      progress: 0,
      status: firstStep?.status ?? i18n.getMessages().loading.defaultTitle,
      title: sequence.title,
    });

    activeSurface = 'loading';

    for (const step of sequence.steps) {
      if (transitionId !== loadingSequenceId) {
        return false;
      }

      loadingScreen.setState({
        detail: step.detail,
        progress: step.progress,
        status: step.status,
      });

      await wait(step.holdMs);
    }

    return transitionId === loadingSequenceId;
  };

  const transitionToMenu = async (
    sequence: LoadingSequence = getLoadingSequence('loginToMenu'),
  ): Promise<void> => {
    const completed = await runLoadingSequence(sequence);

    if (!completed) {
      return;
    }

    renderMenuPage();
  };

  const transitionToGame = async (): Promise<void> => {
    const completed = await runLoadingSequence(getLoadingSequence('menuToGame'));

    if (!completed) {
      return;
    }

    renderGamePage();
  };

  const clearExitModalCloseTimer = (): void => {
    if (exitModalCloseTimer === null) {
      return;
    }

    window.clearTimeout(exitModalCloseTimer);
    exitModalCloseTimer = null;
  };

  const openExitModal = (): void => {
    clearExitModalCloseTimer();
    exitModalState = {
      errorMessage: null,
      isLoggingOut: false,
      status: 'open',
    };
    renderMenuPage();
  };

  const handleLocaleChange = (locale: AppLocale): void => {
    if (locale === i18n.getLocale()) {
      return;
    }

    i18n.setLocale(locale);
    loginState = {
      ...loginState,
      errorMessage: null,
    };
    exitModalState = {
      ...exitModalState,
      errorMessage: null,
    };

    rerenderActiveSurface({
      activeSurface,
      i18n,
      openProfileView,
      renderGamePage,
      renderLoginPage,
      renderMenuPage,
      router,
    });
  };

  const renderLoginPage = (): void => {
    cancelLoadingSequence();
    activeSurface = 'login';
    router.showLogin({
      appVersion: __APP_VERSION__,
      enableDevShortcut: enableDevLoginShortcut,
      musicMuted: audio.isMusicMuted(),
      errorMessage: loginState.errorMessage,
      identifier: loginState.identifier,
      locale: i18n.getLocale(),
      isSubmitting: loginState.isSubmitting,
      onLocaleChange: handleLocaleChange,
      onDevShortcutSubmit: handleDevShortcutSubmit,
      rememberDevice: rememberDeviceSupported && loginState.rememberDevice,
      rememberDeviceSupported,
      onSubmit: handleLoginSubmit,
    });
  };

  const handleLoginSubmit = (values: LoginFormValues): void => {
    const rememberDevice = rememberDeviceSupported && values.rememberDevice;

    if (!values.identifier || !values.password) {
      loginState = {
        ...loginState,
        errorMessage: i18n.t('auth.validation.missingCredentials'),
        identifier: values.identifier,
        isSubmitting: false,
        rememberDevice,
      };
      renderLoginPage();
      return;
    }

    loginState = {
      errorMessage: null,
      identifier: values.identifier,
      isSubmitting: true,
      rememberDevice,
    };
    renderLoginPage();

    void authService
      .login({
        ...values,
        rememberDevice,
      })
      .then(() => {
        profileStore.reset();
        socialStore.reset();
        activeMenuView = 'home';
        activeProfileNickname = null;
        audio.playTransitionCue('screen-shift');
        void transitionToMenu(getLoadingSequence('loginToMenu'));
      })
      .catch((error: unknown) => {
        loginState = {
          ...loginState,
          errorMessage: resolveApiErrorMessage(error, i18n),
          isSubmitting: false,
        };
        renderLoginPage();
      });
  };

  const handleDevShortcutSubmit = (): void => {
    loginState = {
      errorMessage: null,
      identifier: 'teste@dab.local',
      isSubmitting: true,
      rememberDevice: rememberDeviceSupported,
    };
    renderLoginPage();

    void authService
      .loginWithDevAccount()
      .then(() => {
        profileStore.reset();
        socialStore.reset();
        activeMenuView = 'home';
        activeProfileNickname = null;
        audio.playTransitionCue('screen-shift');
        void transitionToMenu(getLoadingSequence('loginToMenu'));
      })
      .catch((error: unknown) => {
        loginState = {
          ...loginState,
          errorMessage: resolveApiErrorMessage(error, i18n),
          isSubmitting: false,
        };
        renderLoginPage();
      });
  };

  const handleLogoutFromModal = (): void => {
    if (exitModalState.isLoggingOut) {
      return;
    }

    const previousSession = authService.getCurrentSession();

    exitModalState = {
      ...exitModalState,
      errorMessage: null,
      isLoggingOut: true,
      status: 'open',
    };
    renderMenuPage();

    void socialStore
      .disconnectRealtime()
      .catch(() => undefined)
      .then(() => authService.logout())
      .then(() => {
        profileStore.reset();
        socialStore.reset();
        activeMenuView = 'home';
        activeProfileNickname = null;
        exitModalState = {
          errorMessage: null,
          isLoggingOut: false,
          status: 'closed',
        };
        loginState = {
          errorMessage: null,
          identifier: previousSession?.user?.email ?? '',
          isSubmitting: false,
          rememberDevice: true,
        };
        renderLoginPage();
      })
      .catch((error: unknown) => {
        exitModalState = {
          errorMessage: resolveApiErrorMessage(error, i18n),
          isLoggingOut: false,
          status: 'open',
        };
        renderMenuPage();
      });
  };

  const closeExitModal = (): void => {
    if (exitModalState.isLoggingOut || exitModalState.status !== 'open') {
      return;
    }

    exitModalState = {
      errorMessage: null,
      isLoggingOut: false,
      status: 'closing',
    };
    renderMenuPage();

    clearExitModalCloseTimer();
    exitModalCloseTimer = window.setTimeout(() => {
      exitModalState = {
        errorMessage: null,
        isLoggingOut: false,
        status: 'closed',
      };
      exitModalCloseTimer = null;
      renderMenuPage();
    }, EXIT_MODAL_TRANSITION_MS);
  };

  void (async () => {
    cancelLoadingSequence();
    activeSurface = 'boot';
    router.showBoot(i18n.t('boot.statuses.validatingRememberedSession'));
    rememberDeviceSupported = await authService.supportsRememberedSessions();
    loginState = {
      ...loginState,
      rememberDevice: rememberDeviceSupported && loginState.rememberDevice,
    };

    try {
      const restoredSession = await authService.initialize();

      if (restoredSession?.user) {
        profileStore.reset();
        socialStore.reset();
        activeProfileNickname = null;
        exitModalState = {
          errorMessage: null,
          isLoggingOut: false,
          status: 'closed',
        };
        audio.playTransitionCue('screen-shift');
        await transitionToMenu(getLoadingSequence('resumeToMenu'));
      } else {
        loginState = {
          ...loginState,
          errorMessage: null,
          isSubmitting: false,
        };
        renderLoginPage();
      }
    } catch (error) {
      loginState = {
        ...loginState,
        errorMessage: resolveApiErrorMessage(error, i18n),
        isSubmitting: false,
      };
      renderLoginPage();
    }

  })();

  shell.interactiveLayer.addEventListener('click', (event) => {
    const actionTarget =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-action]')
        : null;
    const action = actionTarget?.dataset.action;

    if (action === 'toggle-music-mute') {
      audio.toggleMusicMute();
      if (activeSurface === 'menu') {
        renderMenuPage();
      } else if (activeSurface === 'game') {
        renderGamePage();
      } else if (activeSurface === 'login') {
        renderLoginPage();
      }
      return;
    }

    if (action === 'toggle-sound-mute') {
      audio.toggleSoundMute();
      return;
    }

    if (action === 'show-menu-home') {
      if (activeSurface !== 'menu') {
        return;
      }

      activeMenuView = 'home';
      activeProfileNickname = null;
      renderMenuPage();
      return;
    }

    if (action === 'show-profile-page') {
      if (activeSurface !== 'menu') {
        return;
      }

      activeMenuView = 'profile';
      activeProfileNickname = null;
      renderMenuPage();
      return;
    }

    if (action === 'show-players-page') {
      if (activeSurface !== 'menu') {
        return;
      }

      activeMenuView = 'players';
      activeProfileNickname = null;
      renderMenuPage();
      return;
    }

    if (action === 'show-system-page') {
      if (activeSurface !== 'menu') {
        return;
      }

      activeMenuView = 'system';
      activeProfileNickname = null;
      renderMenuPage();
      return;
    }

    if (action === 'play-now') {
      audio.playTransitionCue('screen-shift');
      if (activeSurface === 'menu') {
        void transitionToGame();
      }
      return;
    }

    if (action === 'window-minimize') {
      void desktop.windowControls?.minimize();
      return;
    }

    if (action === 'window-maximize') {
      void desktop.windowControls?.toggleMaximize();
      return;
    }

    if (action === 'window-close') {
      if (authService.getCurrentSession()?.user) {
        openExitModal();
        return;
      }

      requestLauncherClose();
      return;
    }

    if (action === 'auth-logout') {
      handleLogoutFromModal();
      return;
    }

    if (action === 'dismiss-exit-modal') {
      closeExitModal();
      return;
    }

    if (action === 'launcher-force-close') {
      requestLauncherClose();
      return;
    }

    if (action === 'game-return-menu') {
      audio.playTransitionCue('screen-shift');
      void transitionToMenu(getLoadingSequence('gameToMenu'));
    }
  });

  window.addEventListener('beforeunload', () => {
    clearExitModalCloseTimer();
    void socialStore.disconnectRealtime().catch(() => undefined);
    audio.dispose();
  });
}

import { AppAudioManager } from '@app/audio/AppAudioManager';
import { AuthService, resolveAuthErrorMessage } from '@app/auth/auth-service';
import { type LoginFormValues } from '@app/auth/auth-types';
import { createApplicationShell } from '@app/layout/createApplicationShell';
import { createAppRouter } from '@app/navigation/app-router';
import { ProfileStore } from '@app/screens/profile/profile-store';
import { BabylonRuntime } from '@game/bootstrap/BabylonRuntime';
import {
  createI18n,
  type AppLocale,
  type TranslationMessages,
} from '@shared/i18n';
import type { DesktopBridge } from '@shared/types/desktop';

const EXIT_MODAL_TRANSITION_MS = 180;

type AppSurface = 'boot' | 'game' | 'loading' | 'login' | 'menu';

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

function createDesktopBridgeFallback(): DesktopBridge {
  return {
    authStorage: {
      clearRememberedSession: () => Promise.resolve(),
      getRememberedSession: () => Promise.resolve(null),
      isPersistentStorageAvailable: () => Promise.resolve(false),
      setRememberedSession: () =>
        Promise.reject(
          new Error('Secure remembered sessions are unavailable outside Electron.'),
        ),
    },
    environment: import.meta.env.DEV ? 'development' : 'production',
    isPackaged: false,
    osVersion: 'web',
    platform: 'browser',
    versions: {
      chrome: 'web',
      electron: 'web',
      node: 'web',
    },
    windowControls: {
      close: () => Promise.resolve(),
      getState: () => Promise.resolve({ isMaximized: false }),
      minimize: () => Promise.resolve(),
      onStateChange: () => () => undefined,
      toggleMaximize: () => Promise.resolve({ isMaximized: false }),
    },
  };
}

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
  const runtime = new BabylonRuntime(shell.canvas);
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
  let activeMenuView: 'home' | 'profile' | 'system' = 'home';
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
  runtime.start();

  const cancelLoadingSequence = (): void => {
    loadingSequenceId += 1;
  };

  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });

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

  const renderMenuPage = (): void => {
    const session = authService.getCurrentSession();

    if (!session?.user) {
      throw new Error('Home page requires an authenticated user session.');
    }

    cancelLoadingSequence();
    activeSurface = 'menu';
    router.showHome({
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
      profileStore,
      user: session.user,
      view: activeMenuView,
    });
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

    if (activeSurface === 'login') {
      renderLoginPage();
      return;
    }

    if (activeSurface === 'menu') {
      renderMenuPage();
      return;
    }

    if (activeSurface === 'game') {
      renderGamePage();
      return;
    }

    if (activeSurface === 'boot') {
      router.showBoot(i18n.t('boot.statuses.validatingRememberedSession'));
    }
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
        activeMenuView = 'home';
        audio.playTransitionCue('screen-shift');
        void transitionToMenu(getLoadingSequence('loginToMenu'));
      })
      .catch((error: unknown) => {
        loginState = {
          ...loginState,
          errorMessage: resolveAuthErrorMessage(error, i18n),
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
        activeMenuView = 'home';
        audio.playTransitionCue('screen-shift');
        void transitionToMenu(getLoadingSequence('loginToMenu'));
      })
      .catch((error: unknown) => {
        loginState = {
          ...loginState,
          errorMessage: resolveAuthErrorMessage(error, i18n),
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

    void authService
      .logout()
      .then(() => {
        profileStore.reset();
        activeMenuView = 'home';
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
          errorMessage: resolveAuthErrorMessage(error, i18n),
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
        errorMessage: resolveAuthErrorMessage(error, i18n),
        isSubmitting: false,
      };
      renderLoginPage();
    }

    audio.startBackgroundMusic();
  })();

  shell.interactiveLayer.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const action = target?.closest<HTMLElement>('[data-action]')?.dataset.action;

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
      renderMenuPage();
      return;
    }

    if (action === 'show-profile-page') {
      if (activeSurface !== 'menu') {
        return;
      }

      activeMenuView = 'profile';
      renderMenuPage();
      return;
    }

    if (action === 'show-system-page') {
      if (activeSurface !== 'menu') {
        return;
      }

      activeMenuView = 'system';
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

      void desktop.windowControls?.close();
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
      void desktop.windowControls?.close();
      return;
    }

    if (action === 'game-return-menu') {
      audio.playTransitionCue('screen-shift');
      void transitionToMenu(getLoadingSequence('gameToMenu'));
    }
  });

  shell.interactiveLayer.addEventListener('pointermove', (event) => {
    const bounds = shell.interactiveLayer.getBoundingClientRect();
    const normalizedX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const normalizedY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    runtime.setPointerInfluence(normalizedX, normalizedY);
  });

  shell.interactiveLayer.addEventListener('pointerleave', () => {
    runtime.setPointerInfluence(0, 0);
  });

  window.addEventListener('beforeunload', () => {
    clearExitModalCloseTimer();
    audio.dispose();
    runtime.dispose();
  });
}

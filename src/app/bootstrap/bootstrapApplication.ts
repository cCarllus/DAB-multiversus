import { AppAudioManager } from '@app/audio/AppAudioManager';
import { AuthService, resolveAuthErrorMessage } from '@app/auth/auth-service';
import { type LoginFormValues } from '@app/auth/auth-types';
import { createApplicationShell } from '@app/layout/createApplicationShell';
import { createAppRouter } from '@app/navigation/app-router';
import { BabylonRuntime } from '@game/bootstrap/BabylonRuntime';
import type { DesktopBridge } from '@shared/types/desktop';

const EXIT_MODAL_TRANSITION_MS = 180;
const DEV_TEST_LOGIN: LoginFormValues = {
  identifier: 'teste@dab.local',
  password: 'SenhaForte123!',
  rememberDevice: true,
};

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

const LOGIN_TO_MENU_SEQUENCE: LoadingSequence = {
  eyebrow: 'Secure Session Link',
  title: 'Loading launcher',
  steps: [
    {
      detail: 'JWT access link accepted',
      holdMs: 220,
      progress: 0.18,
      status: 'Vinculando a sessão autenticada',
    },
    {
      detail: 'Launcher shell and navigation',
      holdMs: 260,
      progress: 0.42,
      status: 'Montando a interface principal',
    },
    {
      detail: 'Background scene and profile modules',
      holdMs: 320,
      progress: 0.74,
      status: 'Carregando assets iniciais do menu',
    },
    {
      detail: 'The proving grounds are ready',
      holdMs: 200,
      progress: 1,
      status: 'Entrada liberada para o menu',
    },
  ],
};

const RESUME_TO_MENU_SEQUENCE: LoadingSequence = {
  eyebrow: 'Remembered Device',
  title: 'Restoring launcher',
  steps: [
    {
      detail: 'Refresh token rotated successfully',
      holdMs: 180,
      progress: 0.28,
      status: 'Revalidando a sessão salva',
    },
    {
      detail: 'Rehydrating launcher state',
      holdMs: 220,
      progress: 0.66,
      status: 'Reconstruindo os módulos do menu',
    },
    {
      detail: 'Returning to the proving grounds',
      holdMs: 170,
      progress: 1,
      status: 'Entrada autenticada restaurada',
    },
  ],
};

const MENU_TO_GAME_SEQUENCE: LoadingSequence = {
  eyebrow: 'Arena Deployment',
  title: 'Loading battle',
  steps: [
    {
      detail: 'Champion slot and arena sigils',
      holdMs: 240,
      progress: 0.18,
      status: 'Travando a configuração da partida',
    },
    {
      detail: 'Combat shell and match bridge',
      holdMs: 280,
      progress: 0.44,
      status: 'Sincronizando o handoff do jogo',
    },
    {
      detail: 'Streaming battle-side assets',
      holdMs: 320,
      progress: 0.78,
      status: 'Carregando os assets iniciais da arena',
    },
    {
      detail: 'Arena ready for deployment',
      holdMs: 220,
      progress: 1,
      status: 'A arena está pronta',
    },
  ],
};

const GAME_TO_MENU_SEQUENCE: LoadingSequence = {
  eyebrow: 'Launcher Recall',
  title: 'Returning to menu',
  steps: [
    {
      detail: 'Detaching battle shell',
      holdMs: 180,
      progress: 0.32,
      status: 'Encerrando a transição do jogo',
    },
    {
      detail: 'Rehydrating launcher chrome',
      holdMs: 220,
      progress: 0.72,
      status: 'Restaurando o menu principal',
    },
    {
      detail: 'Menu ready',
      holdMs: 180,
      progress: 1,
      status: 'Menu preparado novamente',
    },
  ],
};

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
  const shell = createApplicationShell(host);
  const router = createAppRouter({
    appVersion: __APP_VERSION__,
    shell,
  });
  const audio = new AppAudioManager();
  const runtime = new BabylonRuntime(shell.canvas);
  const authService = new AuthService(desktop, __APP_VERSION__);
  const enableDevLoginShortcut =
    desktop.environment === 'development' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  let rememberDeviceSupported = false;
  let activeSurface: AppSurface = 'boot';
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

  const renderMenuPage = (): void => {
    const session = authService.getCurrentSession();

    if (!session?.user) {
      throw new Error('Home page requires an authenticated user session.');
    }

    cancelLoadingSequence();
    activeSurface = 'menu';
    router.showHome({
      musicMuted: audio.isMusicMuted(),
      exitModal:
        exitModalState.status === 'closed'
          ? undefined
          : {
              errorMessage: exitModalState.errorMessage,
              isLoggingOut: exitModalState.isLoggingOut,
              status: exitModalState.status,
            },
      user: session.user,
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
      status: firstStep?.status ?? 'Loading',
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
    sequence: LoadingSequence = LOGIN_TO_MENU_SEQUENCE,
  ): Promise<void> => {
    const completed = await runLoadingSequence(sequence);

    if (!completed) {
      return;
    }

    renderMenuPage();
  };

  const transitionToGame = async (): Promise<void> => {
    const completed = await runLoadingSequence(MENU_TO_GAME_SEQUENCE);

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

  const renderLoginPage = (): void => {
    cancelLoadingSequence();
    activeSurface = 'login';
    router.showLogin({
      appVersion: __APP_VERSION__,
      devShortcutLabel: 'Entrar com usuario de teste',
      enableDevShortcut: enableDevLoginShortcut,
      musicMuted: audio.isMusicMuted(),
      errorMessage: loginState.errorMessage,
      identifier: loginState.identifier,
      isSubmitting: loginState.isSubmitting,
      rememberDevice: loginState.rememberDevice,
      rememberDeviceSupported,
      onDevShortcutSubmit: () => handleLoginSubmit(DEV_TEST_LOGIN),
      onSubmit: handleLoginSubmit,
    });
  };

  const handleLoginSubmit = (values: LoginFormValues): void => {
    if (!values.identifier || !values.password) {
      loginState = {
        ...loginState,
        errorMessage: 'Informe seu email/nome de usuário e senha para continuar.',
        identifier: values.identifier,
        isSubmitting: false,
        rememberDevice: values.rememberDevice,
      };
      renderLoginPage();
      return;
    }

    loginState = {
      errorMessage: null,
      identifier: values.identifier,
      isSubmitting: true,
      rememberDevice: values.rememberDevice,
    };
    renderLoginPage();

    void authService
      .login(values)
      .then(() => {
        audio.playTransitionCue('screen-shift');
        void transitionToMenu(LOGIN_TO_MENU_SEQUENCE);
      })
      .catch((error: unknown) => {
        loginState = {
          ...loginState,
          errorMessage: resolveAuthErrorMessage(error),
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
          errorMessage: resolveAuthErrorMessage(error),
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
    router.showBoot('Validating remembered session signature...');
    rememberDeviceSupported = await authService.supportsRememberedSessions();

    try {
      const restoredSession = await authService.initialize();

      if (restoredSession?.user) {
        exitModalState = {
          errorMessage: null,
          isLoggingOut: false,
          status: 'closed',
        };
        audio.playTransitionCue('screen-shift');
        await transitionToMenu(RESUME_TO_MENU_SEQUENCE);
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
        errorMessage: resolveAuthErrorMessage(error),
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
      void transitionToMenu(GAME_TO_MENU_SEQUENCE);
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
    void authService.handleBeforeUnload();
    audio.dispose();
    runtime.dispose();
  });
}

import { AppAudioManager } from '@app/audio/AppAudioManager';
import { AuthService, resolveAuthErrorMessage } from '@app/auth/auth-service';
import { type LoginFormValues } from '@app/auth/auth-types';
import { createApplicationShell } from '@app/layout/createApplicationShell';
import { createAppRouter } from '@app/navigation/app-router';
import { BabylonRuntime } from '@game/bootstrap/BabylonRuntime';
import type { DesktopBridge } from '@shared/types/desktop';

const EXIT_MODAL_TRANSITION_MS = 180;

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

  let rememberDeviceSupported = false;
  let loginState = {
    errorMessage: null as string | null,
    identifier: '',
    isSubmitting: false,
    rememberDevice: true,
  };
  let exitModalState = {
    errorMessage: null as string | null,
    isLoggingOut: false,
    status: 'closed' as 'closed' | 'open' | 'closing',
  };
  let exitModalCloseTimer: number | null = null;

  audio.bindInteractionSurface(shell.interactiveLayer);
  runtime.start();

  const renderHomePage = (): void => {
    const session = authService.getCurrentSession();

    if (!session?.user) {
      throw new Error('Home page requires an authenticated user session.');
    }

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
    renderHomePage();
  };

  const renderLoginPage = (): void => {
    router.showLogin({
      appVersion: __APP_VERSION__,
      musicMuted: audio.isMusicMuted(),
      errorMessage: loginState.errorMessage,
      identifier: loginState.identifier,
      isSubmitting: loginState.isSubmitting,
      rememberDevice: loginState.rememberDevice,
      rememberDeviceSupported,
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
        renderHomePage();
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
    renderHomePage();

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
        renderHomePage();
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
    renderHomePage();

    clearExitModalCloseTimer();
    exitModalCloseTimer = window.setTimeout(() => {
      exitModalState = {
        errorMessage: null,
        isLoggingOut: false,
        status: 'closed',
      };
      exitModalCloseTimer = null;
      renderHomePage();
    }, EXIT_MODAL_TRANSITION_MS);
  };

  void (async () => {
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
        renderHomePage();
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
      if (authService.getCurrentSession()?.user) {
        renderHomePage();
      } else {
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

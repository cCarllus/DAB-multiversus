import { AppAudioManager } from '@app/audio/AppAudioManager';
import { AuthService, resolveAuthErrorMessage } from '@app/auth/auth-service';
import type { LoginFormValues } from '@app/auth/auth-types';
import { createApplicationShell } from '@app/layout/createApplicationShell';
import { createAppRouter } from '@app/navigation/app-router';
import { BabylonRuntime } from '@game/bootstrap/BabylonRuntime';
import type { DesktopBridge } from '@shared/types/desktop';

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
    desktop,
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

  audio.bindInteractionSurface(shell.interactiveLayer);
  runtime.start();

  const renderHomePage = (): void => {
    const session = authService.getCurrentSession();

    if (!session?.user) {
      throw new Error('Home page requires an authenticated user session.');
    }

    router.showHome({
      audioMuted: audio.isMuted(),
      user: session.user,
    });
  };

  const renderLoginPage = (): void => {
    router.showLogin({
      appVersion: __APP_VERSION__,
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

  void (async () => {
    router.showBoot('Validating remembered session signature...');
    rememberDeviceSupported = await authService.supportsRememberedSessions();

    try {
      const restoredSession = await authService.initialize();

      if (restoredSession?.user) {
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

    if (action === 'toggle-mute') {
      audio.toggleMute();
      if (authService.getCurrentSession()?.user) {
        renderHomePage();
      }
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
    void authService.handleBeforeUnload();
    audio.dispose();
    runtime.dispose();
  });
}

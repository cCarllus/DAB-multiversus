import { AppAudioManager } from '@frontend/services/audio/app-audio.service';
import { resolveApiErrorMessage } from '@frontend/services/api/api-error';
import { AuthService } from '@frontend/services/auth/auth-service';
import { type LoginFormValues } from '@frontend/services/auth/auth-types';
import { createDesktopBridgeFallback } from '@frontend/bootstrap/desktop-bridge-fallback';
import {
  createSettingsModal,
  type LauncherDisplayProfile,
  type LauncherSettingsSnapshot,
  type SettingsActionResult,
  type SettingsCategory,
} from '@frontend/components/settings-modal';
import {
  rerenderActiveSurface,
  type AppSurface,
} from '@frontend/bootstrap/rerender-active-surface';
import { createApplicationShell } from '@frontend/layout/create-application-shell';
import { createLauncherHistory } from '@frontend/navigation/launcher-history';
import { createAppRouter } from '@frontend/navigation/app-router';
import type { PlayerNotification } from '@frontend/services/notifications/notifications-types';
import { ChatStore } from '@frontend/stores/chat.store';
import { CardsStore } from '@frontend/stores/cards.store';
import { NotificationsStore } from '@frontend/stores/notifications.store';
import { ProfileStore } from '@frontend/stores/profile.store';
import { ProgressionStore } from '@frontend/stores/progression.store';
import { SocialStore } from '@frontend/stores/social.store';
import { WalletStore } from '@frontend/stores/wallet.store';
import {
  createI18n,
  type AppLocale,
  type TranslationMessages,
} from '@shared/i18n';
import type { DesktopWindowState } from '@shared/contracts/desktop.contract';

const EXIT_MODAL_TRANSITION_MS = 180;
const DISPLAY_PROFILES: LauncherDisplayProfile[] = [
  {
    detail: 'Ultra-wide tactical HUD profile',
    id: '3440x1440',
    label: '3440 × 1440',
  },
  {
    detail: 'Native desktop command deck',
    id: '2560x1440',
    label: '2560 × 1440',
  },
  {
    detail: 'Tournament-standard widescreen',
    id: '1920x1080',
    label: '1920 × 1080',
  },
  {
    detail: 'Compact client fallback',
    id: '1600x900',
    label: '1600 × 900',
  },
] as const;

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
type MenuView = 'characters' | 'home' | 'players' | 'profile' | 'system';
interface MenuRouteState {
  profileTargetNickname: string | null;
  view: MenuView;
}

interface LauncherSettingsState {
  activeCategory: SettingsCategory;
  audio: LauncherSettingsSnapshot['audio'];
  isOpen: boolean;
  video: LauncherSettingsSnapshot['video'];
}

export { createDesktopBridgeFallback, rerenderActiveSurface };

function createDefaultMenuRoute(): MenuRouteState {
  return {
    profileTargetNickname: null,
    view: 'home',
  };
}

function getInitialDisplayProfileId(): string {
  const screenWidth = globalThis.window?.screen?.availWidth ?? globalThis.window?.screen?.width;
  const screenHeight = globalThis.window?.screen?.availHeight ?? globalThis.window?.screen?.height;

  if (screenWidth && screenHeight) {
    const exactProfile = DISPLAY_PROFILES.find(
      (profile) => profile.id === `${screenWidth}x${screenHeight}`,
    );

    if (exactProfile) {
      return exactProfile.id;
    }
  }

  return '1920x1080';
}

function parseDisplayProfileId(
  profileId: string,
): {
  height: number;
  width: number;
} | null {
  const [rawWidth, rawHeight] = profileId.split('x');
  const width = Number.parseInt(rawWidth ?? '', 10);
  const height = Number.parseInt(rawHeight ?? '', 10);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    height,
    width,
  };
}

function resolveProfileIdFromWindowState(
  windowState: DesktopWindowState,
  fallbackId: string,
): string {
  return (
    DISPLAY_PROFILES.find(
      (profile) => profile.id === `${windowState.width}x${windowState.height}`,
    )?.id ?? fallbackId
  );
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
  const authService = new AuthService(desktop, __APP_VERSION__);
  const profileStore = new ProfileStore({
    appVersion: __APP_VERSION__,
    authService,
    desktop,
  });
  const progressionStore = new ProgressionStore({
    authService,
  });
  const walletStore = new WalletStore({
    authService,
  });
  const cardsStore = new CardsStore({
    authService,
  });
  const notificationsStore = new NotificationsStore({
    authService,
  });
  const chatStore = new ChatStore({
    authService,
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

  const resolveNotificationCue = (
    notification: PlayerNotification,
  ): 'info' | 'reward' | 'social' | 'warning' => {
    if (notification.type === 'reward' || notification.category === 'economy') {
      return 'reward';
    }

    if (notification.type === 'social' || notification.category === 'social') {
      return 'social';
    }

    if (
      notification.type === 'warning' ||
      notification.type === 'error' ||
      notification.category === 'system'
    ) {
      return 'warning';
    }

    return 'info';
  };

  notificationsStore.subscribeEvents((event) => {
    if (event.type === 'received' && activeSurface !== 'login') {
      audio.playNotificationCue(resolveNotificationCue(event.notification));
    }
  });

  const areMenuRoutesEqual = (left: MenuRouteState, right: MenuRouteState): boolean =>
    left.view === right.view && left.profileTargetNickname === right.profileTargetNickname;
  const menuHistory = createLauncherHistory<MenuRouteState>({
    compare: areMenuRoutesEqual,
    initial: createDefaultMenuRoute(),
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
  let settingsState: LauncherSettingsState = {
    activeCategory: 'video',
    audio: {
      musicMuted: audio.isMusicMuted(),
      musicVolume: audio.getMusicVolume(),
      soundVolume: audio.getSoundVolume(),
    },
    isOpen: false,
    video: {
      fullscreenEnabled: false,
      profiles: [...DISPLAY_PROFILES],
      selectedProfileId: getInitialDisplayProfileId(),
    },
  };

  audio.bindInteractionSurface(shell.interactiveLayer);
  const applyWindowState = (windowState: DesktopWindowState): void => {
    settingsState = {
      ...settingsState,
      video: {
        ...settingsState.video,
        fullscreenEnabled: windowState.isFullScreen,
        selectedProfileId: resolveProfileIdFromWindowState(
          windowState,
          settingsState.video.selectedProfileId,
        ),
      },
    };
  };
  const releaseWindowStateListener =
    desktop.windowControls?.onStateChange((windowState) => {
      applyWindowState(windowState);
    }) ?? null;
  void desktop.windowControls
    ?.getState()
    .then((windowState) => {
      applyWindowState(windowState);
    })
    .catch(() => undefined);

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

  const syncActiveMenuRoute = (route: MenuRouteState): void => {
    activeMenuView = route.view;
    activeProfileNickname = route.profileTargetNickname;
  };

  const resetMenuNavigation = (): void => {
    const defaultRoute = createDefaultMenuRoute();
    menuHistory.reset(defaultRoute);
    syncActiveMenuRoute(defaultRoute);
  };

  const closeSettingsOverlay = (): void => {
    settingsState = {
      ...settingsState,
      isOpen: false,
    };
  };

  const buildSettingsSnapshot = (): LauncherSettingsSnapshot => ({
    activeCategory: settingsState.activeCategory,
    audio: {
      musicMuted: settingsState.audio.musicMuted,
      musicVolume: settingsState.audio.musicVolume,
      soundVolume: settingsState.audio.soundVolume,
    },
    video: {
      fullscreenEnabled: settingsState.video.fullscreenEnabled,
      profiles: [...settingsState.video.profiles],
      selectedProfileId: settingsState.video.selectedProfileId,
    },
  });

  const renderLauncherOverlay = (): void => {
    const session = authService.getCurrentSession();

    if (activeSurface !== 'menu' || !settingsState.isOpen || !session?.user) {
      shell.setOverlay(null);
      return;
    }

    shell.setOverlay(
      createSettingsModal({
        account: {
          email: session.user.email,
          name: session.user.name || session.user.nickname,
          nickname: session.user.nickname,
        },
        i18n,
        onClose: () => {
          closeSettingsOverlay();
          renderMenuPage();
        },
        onDeleteAccount: () => ({
          applied: false,
          message: i18n.t('menu.settings.feedback.deleteUnavailable'),
          tone: 'warning',
        }),
        onToggleMusicMute: () => {
          const nextMuted = audio.toggleMusicMute();

          settingsState = {
            ...settingsState,
            audio: {
              ...settingsState.audio,
              musicMuted: nextMuted,
            },
          };

          return nextMuted;
        },
        onMusicVolumeChange: (volume) => {
          const nextVolume = audio.setMusicVolume(volume);

          settingsState = {
            ...settingsState,
            audio: {
              ...settingsState.audio,
              musicMuted: audio.isMusicMuted(),
              musicVolume: nextVolume,
            },
          };
        },
        onPersistCategory: (category) => {
          settingsState = {
            ...settingsState,
            activeCategory: category,
          };
        },
        onResolutionChange: (profileId) => {
          const resolution = parseDisplayProfileId(profileId);

          if (!resolution || !desktop.windowControls?.setResolution) {
            return {
              applied: false,
              message: i18n.t('menu.settings.feedback.resolutionUnsupported'),
              tone: 'warning',
            } satisfies SettingsActionResult;
          }

          return desktop.windowControls
            .setResolution(resolution.width, resolution.height)
            .then((windowState) => {
              applyWindowState(windowState);
              settingsState = {
                ...settingsState,
                video: {
                  ...settingsState.video,
                  selectedProfileId: resolveProfileIdFromWindowState(windowState, profileId),
                },
              };

              return {
                applied: true,
                message: i18n.t('menu.settings.feedback.resolutionUpdated'),
                tone: 'success',
              } satisfies SettingsActionResult;
            })
            .catch(() => ({
              applied: false,
              message: i18n.t('menu.settings.feedback.resolutionUnsupported'),
              tone: 'warning',
            }));
        },
        onSaveEmail: () => ({
          applied: false,
          message: i18n.t('menu.settings.feedback.emailUnavailable'),
          tone: 'warning',
        }),
        onSaveName: async (name) => {
          await profileStore.updateName(name);

          return {
            applied: true,
            message: i18n.t('menu.profile.feedback.nameUpdated'),
            tone: 'success',
          } satisfies SettingsActionResult;
        },
        onSavePassword: () => ({
          applied: false,
          message: i18n.t('menu.settings.feedback.passwordUnavailable'),
          tone: 'warning',
        }),
        onSoundVolumeChange: (volume) => {
          const nextVolume = audio.setSoundVolume(volume);

          settingsState = {
            ...settingsState,
            audio: {
              ...settingsState.audio,
              soundVolume: nextVolume,
            },
          };
        },
        onToggleFullscreen: async (enabled) => {
          if (!desktop.windowControls?.setFullscreen) {
            return {
              applied: false,
              message: i18n.t('menu.settings.feedback.fullscreenUnsupported'),
              tone: 'warning',
            } satisfies SettingsActionResult;
          }

          try {
            const windowState = await desktop.windowControls.setFullscreen(enabled);
            applyWindowState(windowState);
          } catch {
            return {
              applied: false,
              message: i18n.t('menu.settings.feedback.fullscreenUnsupported'),
              tone: 'warning',
            } satisfies SettingsActionResult;
          }

          settingsState = {
            ...settingsState,
            video: {
              ...settingsState.video,
              fullscreenEnabled: enabled,
            },
          };

          return {
            applied: true,
            message: enabled
              ? i18n.t('menu.settings.feedback.fullscreenEnabled')
              : i18n.t('menu.settings.feedback.fullscreenDisabled'),
            tone: 'info',
          } satisfies SettingsActionResult;
        },
        settings: buildSettingsSnapshot(),
      }),
    );
  };

  const navigateMenu = (route: MenuRouteState): void => {
    if (activeSurface !== 'menu') {
      return;
    }

    notificationsStore.closePanel();
    closeSettingsOverlay();
    const snapshot = menuHistory.push(route);
    syncActiveMenuRoute(snapshot.current);
    renderMenuPage();
  };

  const moveThroughMenuHistory = (direction: 'back' | 'forward'): void => {
    if (activeSurface !== 'menu') {
      return;
    }

    notificationsStore.closePanel();
    closeSettingsOverlay();
    const route = direction === 'back' ? menuHistory.back() : menuHistory.forward();

    if (!route) {
      return;
    }

    syncActiveMenuRoute(route);
    renderMenuPage();
  };

  const resolveMenuPresenceActivity = (): string => {
    if (activeMenuView === 'characters') {
      return i18n.t('menu.social.presence.configuringLoadout');
    }

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
    const historySnapshot = menuHistory.getSnapshot();
    router.showMenu({
      canGoBack: historySnapshot.canGoBack,
      canGoForward: historySnapshot.canGoForward,
      cardsStore,
      chatStore,
      desktop,
      isSettingsOpen: settingsState.isOpen,
      musicMuted: audio.isMusicMuted(),
      notificationsStore,
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
      progressionStore,
      socialStore,
      user: session.user,
      view: activeMenuView,
      walletStore,
    });
    renderLauncherOverlay();

    void progressionStore.load().catch(() => undefined);
    void walletStore.load().catch(() => undefined);
    void notificationsStore.load().catch(() => undefined);
    void chatStore.connectRealtime().catch(() => false);

    void socialStore.updatePresence({
      currentActivity: resolveMenuPresenceActivity(),
      status: 'in_launcher',
    }).catch(() => undefined);
  };

  const openProfileView = (nickname: string | null): void => {
    navigateMenu({
      profileTargetNickname: nickname?.trim().toLowerCase() ?? null,
      view: 'profile',
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
    renderLauncherOverlay();

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
    renderLauncherOverlay();

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
    notificationsStore.closePanel();
    closeSettingsOverlay();
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
    renderLauncherOverlay();
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
        progressionStore.reset();
        walletStore.reset();
        cardsStore.reset();
        notificationsStore.reset();
        chatStore.reset();
        socialStore.reset();
        resetMenuNavigation();
        closeSettingsOverlay();
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
        progressionStore.reset();
        walletStore.reset();
        cardsStore.reset();
        notificationsStore.reset();
        chatStore.reset();
        socialStore.reset();
        resetMenuNavigation();
        closeSettingsOverlay();
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

    const realtimeShutdown = Promise.allSettled([
      socialStore.disconnectRealtime(),
      notificationsStore.disconnectRealtime(),
      chatStore.disconnectRealtime(),
    ]);

    void authService
      .logout()
      .then(() => realtimeShutdown)
      .then(() => {
        profileStore.reset();
        progressionStore.reset();
        walletStore.reset();
        cardsStore.reset();
        notificationsStore.reset();
        chatStore.reset();
        socialStore.reset();
        resetMenuNavigation();
        closeSettingsOverlay();
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
    renderLauncherOverlay();
    rememberDeviceSupported = await authService.supportsRememberedSessions();
    loginState = {
      ...loginState,
      rememberDevice: rememberDeviceSupported && loginState.rememberDevice,
    };

    try {
      const restoredSession = await authService.initialize();

      if (restoredSession?.user) {
        profileStore.reset();
        progressionStore.reset();
        walletStore.reset();
        cardsStore.reset();
        notificationsStore.reset();
        chatStore.reset();
        socialStore.reset();
        resetMenuNavigation();
        closeSettingsOverlay();
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
      navigateMenu({
        profileTargetNickname: null,
        view: 'home',
      });
      return;
    }

    if (action === 'show-characters-page') {
      navigateMenu({
        profileTargetNickname: null,
        view: 'characters',
      });
      return;
    }

    if (action === 'show-profile-page') {
      navigateMenu({
        profileTargetNickname: null,
        view: 'profile',
      });
      return;
    }

    if (action === 'show-players-page') {
      navigateMenu({
        profileTargetNickname: null,
        view: 'players',
      });
      return;
    }

    if (action === 'show-system-page') {
      navigateMenu({
        profileTargetNickname: null,
        view: 'system',
      });
      return;
    }

    if (action === 'navigate-history-back') {
      moveThroughMenuHistory('back');
      return;
    }

    if (action === 'navigate-history-forward') {
      moveThroughMenuHistory('forward');
      return;
    }

    if (action === 'open-settings-modal') {
      if (activeSurface !== 'menu') {
        return;
      }

      notificationsStore.closePanel();
      settingsState = {
        ...settingsState,
        isOpen: true,
      };
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

    if (action === 'toggle-notifications-panel') {
      if (activeSurface !== 'menu') {
        return;
      }

      notificationsStore.togglePanel();
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
    releaseWindowStateListener?.();
    void socialStore.disconnectRealtime().catch(() => undefined);
    void notificationsStore.disconnectRealtime().catch(() => undefined);
    void chatStore.disconnectRealtime().catch(() => undefined);
    audio.dispose();
  });
}

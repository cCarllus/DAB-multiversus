import type { ApplicationShell } from '@app/layout/createApplicationShell';
import type { AppI18n } from '@shared/i18n';

import {
  createLoginScreen,
  type LoginScreenOptions,
} from '@app/auth/login-screen';
import { createBootScreen } from '@app/screens/boot/boot-screen';
import { createGameScreen } from '@app/screens/game/game-screen';
import { createHomeScreen } from '@app/screens/home/home-screen';
import type { ProfileStore } from '@app/screens/profile/profile-store';
import type { DesktopBridge } from '@shared/types/desktop';
import {
  createLoadingScreen,
  type LoadingScreenHandle,
  type LoadingScreenOptions,
} from '@app/screens/loading/loading-screen';
import type { AuthSessionSnapshot, AuthUser } from '@app/auth/auth-types';

interface CreateAppRouterOptions {
  appVersion: string;
  i18n: AppI18n;
  shell: ApplicationShell;
}

interface HomeRouteOptions {
  desktop: DesktopBridge;
  musicMuted: boolean;
  exitModal?: {
    errorMessage?: string | null;
    isLoggingOut: boolean;
    status: 'open' | 'closing';
  };
  profileStore: ProfileStore;
  session: AuthSessionSnapshot;
  user: AuthUser;
  view: 'home' | 'profile' | 'system';
}

interface GameRouteOptions {
  user: AuthUser;
}

export interface AppRouter {
  showBoot: (status: string) => void;
  showGame: (options: GameRouteOptions) => void;
  showHome: (options: HomeRouteOptions) => void;
  showLogin: (options: Omit<LoginScreenOptions, 'i18n'>) => void;
  showLoading: (
    options: Omit<LoadingScreenOptions, 'appVersion' | 'i18n'>,
  ) => LoadingScreenHandle;
}

export function createAppRouter(options: CreateAppRouterOptions): AppRouter {
  return {
    showBoot(status) {
      options.shell.setPage(
        createBootScreen({
          appVersion: options.appVersion,
          i18n: options.i18n,
          status,
        }),
      );
    },

    showLogin(loginScreenOptions) {
      options.shell.setPage(
        createLoginScreen({
          ...loginScreenOptions,
          i18n: options.i18n,
        }),
      );
    },

    showLoading(loadingScreenOptions) {
      const loadingScreen = createLoadingScreen({
        ...loadingScreenOptions,
        appVersion: options.appVersion,
        i18n: options.i18n,
      });
      options.shell.setPage(loadingScreen.element);
      return loadingScreen;
    },

    showHome(homeOptions) {
      options.shell.setPage(
        createHomeScreen({
          desktop: homeOptions.desktop,
          i18n: options.i18n,
          musicMuted: homeOptions.musicMuted,
          exitModal: homeOptions.exitModal,
          session: homeOptions.session,
          profileStore: homeOptions.profileStore,
          user: homeOptions.user,
          view: homeOptions.view,
        }),
      );
    },

    showGame(gameOptions) {
      options.shell.setPage(
        createGameScreen({
          appVersion: options.appVersion,
          i18n: options.i18n,
          user: gameOptions.user,
        }),
      );
    },
  };
}

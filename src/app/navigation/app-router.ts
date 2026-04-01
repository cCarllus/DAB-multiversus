import type { ApplicationShell } from '@app/layout/createApplicationShell';

import {
  createLoginScreen,
  type LoginScreenOptions,
} from '@app/auth/login-screen';
import { createBootScreen } from '@app/screens/boot/boot-screen';
import { createGameScreen } from '@app/screens/game/game-screen';
import { createHomeScreen } from '@app/screens/home/home-screen';
import {
  createLoadingScreen,
  type LoadingScreenHandle,
  type LoadingScreenOptions,
} from '@app/screens/loading/loading-screen';
import type { AuthUser } from '@app/auth/auth-types';

interface CreateAppRouterOptions {
  appVersion: string;
  shell: ApplicationShell;
}

interface HomeRouteOptions {
  musicMuted: boolean;
  exitModal?: {
    errorMessage?: string | null;
    isLoggingOut: boolean;
    status: 'open' | 'closing';
  };
  user: AuthUser;
}

interface GameRouteOptions {
  user: AuthUser;
}

export interface AppRouter {
  showBoot: (status: string) => void;
  showGame: (options: GameRouteOptions) => void;
  showHome: (options: HomeRouteOptions) => void;
  showLogin: (options: LoginScreenOptions) => void;
  showLoading: (
    options: Omit<LoadingScreenOptions, 'appVersion'>,
  ) => LoadingScreenHandle;
}

export function createAppRouter(options: CreateAppRouterOptions): AppRouter {
  return {
    showBoot(status) {
      options.shell.setPage(
        createBootScreen({
          appVersion: options.appVersion,
          status,
        }),
      );
    },

    showLogin(loginScreenOptions) {
      options.shell.setPage(createLoginScreen(loginScreenOptions));
    },

    showLoading(loadingScreenOptions) {
      const loadingScreen = createLoadingScreen({
        ...loadingScreenOptions,
        appVersion: options.appVersion,
      });
      options.shell.setPage(loadingScreen.element);
      return loadingScreen;
    },

    showHome(homeOptions) {
      options.shell.setPage(
        createHomeScreen({
          musicMuted: homeOptions.musicMuted,
          exitModal: homeOptions.exitModal,
          user: homeOptions.user,
        }),
      );
    },

    showGame(gameOptions) {
      options.shell.setPage(
        createGameScreen({
          appVersion: options.appVersion,
          user: gameOptions.user,
        }),
      );
    },
  };
}

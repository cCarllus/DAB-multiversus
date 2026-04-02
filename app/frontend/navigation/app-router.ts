import type { ApplicationShell } from '@frontend/layout/create-application-shell';
import type { AppI18n } from '@shared/i18n';

import {
  createLoginScreen,
  type LoginScreenOptions,
} from '@frontend/screens/login/login-screen';
import { createBootScreen } from '@frontend/screens/boot/boot-screen';
import { createGameScreen } from '@frontend/screens/game/game-screen';
import { createMenuScreen } from '@frontend/screens/menu/menu-screen';
import type { ProfileStore } from '@frontend/stores/profile.store';
import type { DesktopBridge } from '@shared/contracts/desktop.contract';
import {
  createLoadingScreen,
  type LoadingScreenHandle,
  type LoadingScreenOptions,
} from '@frontend/screens/loading/loading-screen';
import type { AuthSessionSnapshot, AuthUser } from '@frontend/services/auth/auth-types';

interface CreateAppRouterOptions {
  appVersion: string;
  i18n: AppI18n;
  shell: ApplicationShell;
}

interface MenuRouteOptions {
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
  showMenu: (options: MenuRouteOptions) => void;
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

    showMenu(menuOptions) {
      options.shell.setPage(
        createMenuScreen({
          desktop: menuOptions.desktop,
          i18n: options.i18n,
          musicMuted: menuOptions.musicMuted,
          exitModal: menuOptions.exitModal,
          session: menuOptions.session,
          profileStore: menuOptions.profileStore,
          user: menuOptions.user,
          view: menuOptions.view,
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

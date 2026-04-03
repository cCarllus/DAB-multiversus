import type { ApplicationShell } from '@frontend/layout/create-application-shell';
import type { AppI18n } from '@shared/i18n';

import {
  createLoginScreen,
  type LoginScreenOptions,
} from '@frontend/screens/login/login-screen';
import { createBootScreen } from '@frontend/screens/boot/boot-screen';
import { createGameScreen } from '@game/shell/game-screen';
import { createMenuScreen } from '@frontend/screens/menu/menu-screen';
import type { ChatStore } from '@frontend/stores/chat.store';
import type { CardsStore } from '@frontend/stores/cards.store';
import type { NotificationsStore } from '@frontend/stores/notifications.store';
import type { SocialStore } from '@frontend/stores/social.store';
import type { ProfileStore } from '@frontend/stores/profile.store';
import type { ProgressionStore } from '@frontend/stores/progression.store';
import type { WalletStore } from '@frontend/stores/wallet.store';
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
  canGoBack: boolean;
  canGoForward: boolean;
  cardsStore: CardsStore;
  chatStore: ChatStore;
  desktop: DesktopBridge;
  isSettingsOpen?: boolean;
  musicMuted: boolean;
  notificationsStore: NotificationsStore;
  exitModal?: {
    errorMessage?: string | null;
    isLoggingOut: boolean;
    status: 'open' | 'closing';
  };
  onOpenProfile: (nickname: string) => void;
  profileStore: ProfileStore;
  profileTargetNickname?: string | null;
  progressionStore: ProgressionStore;
  socialStore: SocialStore;
  session: AuthSessionSnapshot;
  user: AuthUser;
  view: 'characters' | 'home' | 'players' | 'profile' | 'system';
  walletStore: WalletStore;
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
          canGoBack: menuOptions.canGoBack,
          canGoForward: menuOptions.canGoForward,
          cardsStore: menuOptions.cardsStore,
          chatStore: menuOptions.chatStore,
          desktop: menuOptions.desktop,
          i18n: options.i18n,
          isSettingsOpen: menuOptions.isSettingsOpen,
          musicMuted: menuOptions.musicMuted,
          notificationsStore: menuOptions.notificationsStore,
          exitModal: menuOptions.exitModal,
          onOpenProfile: menuOptions.onOpenProfile,
          session: menuOptions.session,
          profileStore: menuOptions.profileStore,
          profileTargetNickname: menuOptions.profileTargetNickname,
          progressionStore: menuOptions.progressionStore,
          socialStore: menuOptions.socialStore,
          user: menuOptions.user,
          view: menuOptions.view,
          walletStore: menuOptions.walletStore,
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

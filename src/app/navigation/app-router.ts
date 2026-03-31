import type { ApplicationShell } from '@app/layout/createApplicationShell';

import {
  createLoginScreen,
  type LoginScreenOptions,
} from '@app/auth/login-screen';
import { createBootScreen } from '@app/screens/boot/boot-screen';
import { createHomeScreen } from '@app/screens/home/home-screen';
import type { AuthUser } from '@app/auth/auth-types';
import type { DesktopBridge } from '@shared/types/desktop';

interface CreateAppRouterOptions {
  appVersion: string;
  desktop: DesktopBridge;
  shell: ApplicationShell;
}

interface HomeRouteOptions {
  audioMuted: boolean;
  user: AuthUser;
}

export interface AppRouter {
  showBoot: (status: string) => void;
  showHome: (options: HomeRouteOptions) => void;
  showLogin: (options: LoginScreenOptions) => void;
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

    showHome(homeOptions) {
      options.shell.setPage(
        createHomeScreen({
          appVersion: options.appVersion,
          audioMuted: homeOptions.audioMuted,
          desktop: options.desktop,
          user: homeOptions.user,
        }),
      );
    },
  };
}

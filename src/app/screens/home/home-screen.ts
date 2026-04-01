import { createExitModal } from '@app/ui/createExitModal';
import {
  resolveAuthDisplayName,
  type AuthSessionSnapshot,
  type AuthUser,
} from '@app/auth/auth-types';
import { createMenuShell } from '@app/menu/createMenuShell';
import { createHomePage } from '@app/pages/home/createHomePage';
import { createProfileScreen } from '@app/screens/profile/profile-screen';
import type { ProfileStore } from '@app/screens/profile/profile-store';
import titleGameNameImage from '@assets/images/ui/icons/title-game-name.png';
import type { AppI18n } from '@shared/i18n';

interface HomeScreenOptions {
  musicMuted: boolean;
  i18n: AppI18n;
  exitModal?: {
    errorMessage?: string | null;
    isLoggingOut: boolean;
    status: 'open' | 'closing';
  };
  profileStore: ProfileStore;
  view: 'home' | 'profile';
  session: AuthSessionSnapshot;
  user: AuthUser;
}

export function createHomeScreen(options: HomeScreenOptions): HTMLElement {
  const content =
    options.view === 'profile'
      ? createProfileScreen({
          i18n: options.i18n,
          profileStore: options.profileStore,
          session: options.session,
        })
      : createHomePage({
          i18n: options.i18n,
          user: options.user,
        });

  const rootElement = createMenuShell({
    activeView: options.view,
    brandImage: titleGameNameImage,
    content,
    i18n: options.i18n,
    musicMuted: options.musicMuted,
  });

  if (options.exitModal) {
    rootElement.append(
      createExitModal({
        errorMessage: options.exitModal.errorMessage,
        i18n: options.i18n,
        isClosing: options.exitModal.status === 'closing',
        isLoggingOut: options.exitModal.isLoggingOut,
        userLabel: resolveAuthDisplayName(options.user),
      }),
    );
  }

  return rootElement;
}

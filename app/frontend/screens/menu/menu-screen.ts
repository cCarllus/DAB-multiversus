import { createExitModal } from '@frontend/components/exit-modal';
import {
  resolveAuthDisplayName,
  type AuthSessionSnapshot,
  type AuthUser,
} from '@frontend/services/auth/auth-types';
import { createMenuShell } from '@frontend/layout/menu/createMenuShell';
import { createHomeScreen } from '@frontend/screens/home/home-screen';
import { createProfileScreen } from '@frontend/screens/profile/profile-screen';
import { createSystemScreen } from '@frontend/screens/system/system-screen';
import type { ProfileStore } from '@frontend/stores/profile.store';
import titleGameNameImage from '@assets/images/ui/icons/title-game-name.png';
import type { AppI18n } from '@shared/i18n';
import type { DesktopBridge } from '@shared/contracts/desktop.contract';

interface MenuScreenOptions {
  desktop: DesktopBridge;
  musicMuted: boolean;
  i18n: AppI18n;
  exitModal?: {
    errorMessage?: string | null;
    isLoggingOut: boolean;
    status: 'open' | 'closing';
  };
  profileStore: ProfileStore;
  view: 'home' | 'profile' | 'system';
  session: AuthSessionSnapshot;
  user: AuthUser;
}

export function createMenuScreen(options: MenuScreenOptions): HTMLElement {
  const content =
    options.view === 'profile'
      ? createProfileScreen({
          i18n: options.i18n,
          profileStore: options.profileStore,
          session: options.session,
        })
      : options.view === 'system'
        ? createSystemScreen({
            desktop: options.desktop,
            i18n: options.i18n,
            profileStore: options.profileStore,
            session: options.session,
          })
        : createHomeScreen({
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

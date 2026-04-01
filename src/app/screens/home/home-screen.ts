import { createExitModal } from '@app/ui/createExitModal';
import { resolveAuthDisplayName, type AuthUser } from '@app/auth/auth-types';
import { createMenuShell } from '@app/menu/createMenuShell';
import { createHomePage } from '@app/pages/home/createHomePage';
import titleGameNameImage from '@assets/images/ui/icons/title-game-name.png';

interface HomeScreenOptions {
  musicMuted: boolean;
  exitModal?: {
    errorMessage?: string | null;
    isLoggingOut: boolean;
    status: 'open' | 'closing';
  };
  user: AuthUser;
}

export function createHomeScreen(options: HomeScreenOptions): HTMLElement {
  const rootElement = createMenuShell({
    brandImage: titleGameNameImage,
    content: createHomePage({
      user: options.user,
    }),
    musicMuted: options.musicMuted,
  });

  if (options.exitModal) {
    rootElement.append(
      createExitModal({
        errorMessage: options.exitModal.errorMessage,
        isClosing: options.exitModal.status === 'closing',
        isLoggingOut: options.exitModal.isLoggingOut,
        userLabel: resolveAuthDisplayName(options.user),
      }),
    );
  }

  return rootElement;
}

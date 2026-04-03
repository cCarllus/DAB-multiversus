import { createExitModal } from '@frontend/components/exit-modal';
import { createCardsScreen } from '@frontend/screens/cards/cards-screen';
import {
  resolveAuthDisplayName,
  type AuthSessionSnapshot,
  type AuthUser,
} from '@frontend/services/auth/auth-types';
import { createMenuShell } from '@frontend/layout/menu/createMenuShell';
import { createHomeScreen } from '@frontend/screens/home/home-screen';
import { createProfileScreen } from '@frontend/screens/profile/profile-screen';
import { createSocialScreen } from '@frontend/screens/social/social-screen';
import { createSystemScreen } from '@frontend/screens/system/system-screen';
import type { ChatStore } from '@frontend/stores/chat.store';
import type { CardsStore } from '@frontend/stores/cards.store';
import type { NotificationsStore } from '@frontend/stores/notifications.store';
import type { ProfileStore } from '@frontend/stores/profile.store';
import type { ProgressionStore } from '@frontend/stores/progression.store';
import type { SocialStore } from '@frontend/stores/social.store';
import type { WalletStore } from '@frontend/stores/wallet.store';
import titleGameNameImage from '@assets/images/ui/icons/title-game-name.png';
import type { AppI18n } from '@shared/i18n';
import type { DesktopBridge } from '@shared/contracts/desktop.contract';

interface MenuScreenOptions {
  canGoBack: boolean;
  canGoForward: boolean;
  cardsStore?: CardsStore;
  chatStore?: ChatStore;
  desktop: DesktopBridge;
  isSettingsOpen?: boolean;
  musicMuted: boolean;
  i18n: AppI18n;
  notificationsStore?: NotificationsStore;
  exitModal?: {
    errorMessage?: string | null;
    isLoggingOut: boolean;
    status: 'open' | 'closing';
  };
  onOpenProfile: (nickname: string) => void;
  profileStore: ProfileStore;
  profileTargetNickname?: string | null;
  progressionStore?: ProgressionStore;
  socialStore: SocialStore;
  view: 'characters' | 'home' | 'players' | 'profile' | 'system';
  session: AuthSessionSnapshot;
  user: AuthUser;
  walletStore?: WalletStore;
}

export function createMenuScreen(options: MenuScreenOptions): HTMLElement {
  const content =
    options.view === 'characters'
      ? createCardsScreen({
          cardsStore:
            options.cardsStore ??
            (() => {
              throw new Error('Cards screen requires a cards store.');
            })(),
          i18n: options.i18n,
          walletStore: options.walletStore,
        })
      : options.view === 'profile'
      ? createProfileScreen({
          i18n: options.i18n,
          profileStore: options.profileStore,
          profileTargetNickname: options.profileTargetNickname,
          currentUser: options.user,
          socialStore: options.socialStore,
          session: options.session,
        })
      : options.view === 'players'
        ? createSocialScreen({
            i18n: options.i18n,
            onOpenProfile: options.onOpenProfile,
            socialStore: options.socialStore,
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
            progressionStore: options.progressionStore,
            socialStore: options.socialStore,
            user: options.user,
          });

  const rootElement = createMenuShell({
    activeView: options.view,
    brandImage: titleGameNameImage,
    canGoBack: options.canGoBack,
    canGoForward: options.canGoForward,
    chatStore: options.chatStore,
    content,
    currentUserNickname: options.user.nickname,
    i18n: options.i18n,
    isSettingsOpen: options.isSettingsOpen,
    musicMuted: options.musicMuted,
    notificationsStore: options.notificationsStore,
    walletStore: options.walletStore,
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

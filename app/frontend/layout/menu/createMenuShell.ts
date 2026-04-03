import { createElementFromTemplate } from '@frontend/lib/html';
import { createNotificationsModal } from '@frontend/screens/notifications/notifications-modal';
import type { ChatStore } from '@frontend/stores/chat.store';
import type { NotificationsStore } from '@frontend/stores/notifications.store';
import type { WalletStore } from '@frontend/stores/wallet.store';
import type { AppI18n } from '@shared/i18n';

import { createMenuFooterBar } from './createMenuFooterBar';
import { createMenuNavbar } from './createMenuNavbar';
import menuBackgroundImage from '@assets/images/ui/backgrounds/background-image-menu.webp';

import menuShellTemplate from './menu-shell.html?raw';

interface CreateMenuShellOptions {
  activeView: 'home' | 'players' | 'profile' | 'system';
  brandImage: string;
  canGoBack: boolean;
  canGoForward: boolean;
  chatStore?: ChatStore;
  content: HTMLElement;
  currentUserNickname?: string;
  i18n: AppI18n;
  isSettingsOpen?: boolean;
  musicMuted: boolean;
  notificationsStore?: NotificationsStore;
  walletStore?: WalletStore;
}

export function createMenuShell(options: CreateMenuShellOptions): HTMLElement {
  const messages = options.i18n.getMessages();
  const rootElement = createElementFromTemplate(menuShellTemplate, {
    HOME_SCREEN_ARIA_LABEL: messages.menu.shellAriaLabel,
    HOME_SCREEN_STATE_CLASS: options.activeView === 'home' ? 'home-screen--home' : 'home-screen--profile',
    MENU_BACKGROUND_IMAGE: menuBackgroundImage,
  });
  const frame = rootElement.querySelector<HTMLElement>('[data-menu-frame]');

  if (!frame) {
    throw new Error('Menu shell frame could not be initialized.');
  }

  frame.append(
    createMenuNavbar({
      activeView: options.activeView,
      brandImage: options.brandImage,
      canGoBack: options.canGoBack,
      canGoForward: options.canGoForward,
      i18n: options.i18n,
      isSettingsOpen: options.isSettingsOpen,
      notificationsStore: options.notificationsStore,
      walletStore: options.walletStore,
    }),
    options.content,
  );

  if (options.activeView === 'home') {
    frame.append(
      createMenuFooterBar({
        chatStore: options.chatStore,
        currentUserNickname: options.currentUserNickname,
        i18n: options.i18n,
        musicMuted: options.musicMuted,
      }),
    );
  }

  if (options.notificationsStore) {
    rootElement.append(
      createNotificationsModal({
        i18n: options.i18n,
        notificationsStore: options.notificationsStore,
      }),
    );
  }

  return rootElement;
}

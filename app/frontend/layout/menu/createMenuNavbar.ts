import { createElementFromTemplate } from '@frontend/lib/html';
import type { NotificationsStore } from '@frontend/stores/notifications.store';
import type { ProgressionStore } from '@frontend/stores/progression.store';
import type { WalletStore } from '@frontend/stores/wallet.store';
import type { AppI18n } from '@shared/i18n';

import menuNavbarTemplate from './menu-navbar.html?raw';

interface CreateMenuNavbarOptions {
  activeView: 'home' | 'players' | 'profile' | 'system';
  brandImage: string;
  i18n: AppI18n;
  notificationsStore?: NotificationsStore;
  progressionStore?: ProgressionStore;
  walletStore?: WalletStore;
}

export function createMenuNavbar(options: CreateMenuNavbarOptions): HTMLElement {
  const messages = options.i18n.getMessages();
  const walletShards = options.walletStore?.getSnapshot().wallet?.shards ?? 0;
  const unreadCount = options.notificationsStore?.getSnapshot().unreadCount ?? 0;
  const playerLevel = options.progressionStore?.getSnapshot()?.level ?? 1;

  const element = createElementFromTemplate(menuNavbarTemplate, {
    CLOSE_ARIA_LABEL: messages.menu.topbar.closeAriaLabel,
    CURRENCY_ARIA_LABEL: messages.menu.topbar.currencyAriaLabel,
    CURRENCY_LABEL: messages.menu.topbar.currencyLabel,
    CURRENCY_VALUE: options.i18n.formatNumber(walletShards),
    MINIMIZE_ARIA_LABEL: messages.menu.topbar.minimizeAriaLabel,
    NAVIGATION_ARIA_LABEL: messages.menu.topbar.navigationAriaLabel,
    NOTIFICATIONS_BADGE_HIDDEN: unreadCount > 0 ? '' : 'hidden',
    NOTIFICATIONS_BADGE_VALUE: unreadCount > 99 ? '99+' : String(unreadCount),
    NOTIFICATIONS_ARIA_LABEL: messages.menu.topbar.notificationsAriaLabel,
    PLAYER_LEVEL_LABEL: `LV ${playerLevel}`,
    PLAY_ARIA_LABEL: messages.menu.topbar.playAriaLabel,
    PLAYERS_TAB_STATE_CLASS: options.activeView === 'players' ? 'is-active' : '',
    PLAYERS_TAB_PRESSED: options.activeView === 'players' ? 'true' : 'false',
    PRIMARY_NAVIGATION_ARIA_LABEL: messages.menu.topbar.primaryNavigationAriaLabel,
    PROFILE_BUTTON_STATE_CLASS:
      options.activeView === 'profile' ? 'is-active' : '',
    PROFILE_BUTTON_PRESSED: options.activeView === 'profile' ? 'true' : 'false',
    PROFILE_ARIA_LABEL: messages.menu.topbar.profileAriaLabel,
    SETTINGS_ARIA_LABEL: messages.menu.topbar.settingsAriaLabel,
    TAB_CODEX_LABEL: messages.menu.topbar.tabs.codex,
    TAB_HEROES_LABEL: messages.menu.topbar.tabs.heroes,
    TAB_PLAYERS_LABEL: messages.menu.topbar.tabs.players,
    TAB_STORE_LABEL: messages.menu.topbar.tabs.store,
    TAB_SYSTEM_LABEL: messages.menu.topbar.tabs.system,
    SYSTEM_TAB_STATE_CLASS: options.activeView === 'system' ? 'is-active' : '',
    SYSTEM_TAB_PRESSED: options.activeView === 'system' ? 'true' : 'false',
    TAB_WATCH_LABEL: messages.menu.topbar.tabs.watch,
    TOPBAR_BRAND_ALT: messages.common.brandAlt,
    TOPBAR_BRAND_IMAGE: options.brandImage,
  });

  const currencyValue = element.querySelector<HTMLElement>('[data-topbar-currency-value]');
  const notificationsBadge = element.querySelector<HTMLElement>('[data-topbar-notifications-badge]');
  const levelBadge = element.querySelector<HTMLElement>('[data-topbar-level]');

  const renderLiveState = (): void => {
    if (currencyValue) {
      currencyValue.textContent = options.i18n.formatNumber(
        options.walletStore?.getSnapshot().wallet?.shards ?? 0,
      );
    }

    if (notificationsBadge) {
      const nextUnreadCount = options.notificationsStore?.getSnapshot().unreadCount ?? 0;
      notificationsBadge.textContent = nextUnreadCount > 99 ? '99+' : String(nextUnreadCount);
      notificationsBadge.hidden = nextUnreadCount <= 0;
    }

    if (levelBadge) {
      levelBadge.textContent = `LV ${options.progressionStore?.getSnapshot()?.level ?? 1}`;
    }
  };

  if (options.walletStore) {
    const unsubscribe = options.walletStore.subscribe(() => {
      if (!element.isConnected) {
        unsubscribe();
        return;
      }

      renderLiveState();
    });
  }

  if (options.notificationsStore) {
    const unsubscribe = options.notificationsStore.subscribe(() => {
      if (!element.isConnected) {
        unsubscribe();
        return;
      }

      renderLiveState();
    });
  }

  if (options.progressionStore) {
    const unsubscribe = options.progressionStore.subscribe(() => {
      if (!element.isConnected) {
        unsubscribe();
        return;
      }

      renderLiveState();
    });
  }

  renderLiveState();
  return element;
}

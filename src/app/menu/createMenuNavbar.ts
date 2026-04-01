import { createElementFromTemplate } from '@app/utils/html';
import type { AppI18n } from '@shared/i18n';

import menuNavbarTemplate from './menu-navbar.html?raw';

interface CreateMenuNavbarOptions {
  activeView: 'home' | 'profile' | 'system';
  brandImage: string;
  i18n: AppI18n;
}

export function createMenuNavbar(options: CreateMenuNavbarOptions): HTMLElement {
  const messages = options.i18n.getMessages();

  return createElementFromTemplate(menuNavbarTemplate, {
    CLOSE_ARIA_LABEL: messages.menu.topbar.closeAriaLabel,
    CURRENCY_ARIA_LABEL: messages.menu.topbar.currencyAriaLabel,
    CURRENCY_LABEL: messages.menu.topbar.currencyLabel,
    CURRENCY_VALUE: options.i18n.formatNumber(145800),
    MINIMIZE_ARIA_LABEL: messages.menu.topbar.minimizeAriaLabel,
    NAVIGATION_ARIA_LABEL: messages.menu.topbar.navigationAriaLabel,
    NOTIFICATIONS_ARIA_LABEL: messages.menu.topbar.notificationsAriaLabel,
    PLAY_ARIA_LABEL: messages.menu.topbar.playAriaLabel,
    PRIMARY_NAVIGATION_ARIA_LABEL: messages.menu.topbar.primaryNavigationAriaLabel,
    PROFILE_BUTTON_STATE_CLASS:
      options.activeView === 'profile' ? 'is-active' : '',
    PROFILE_BUTTON_PRESSED: options.activeView === 'profile' ? 'true' : 'false',
    PROFILE_ARIA_LABEL: messages.menu.topbar.profileAriaLabel,
    SETTINGS_ARIA_LABEL: messages.menu.topbar.settingsAriaLabel,
    TAB_CODEX_LABEL: messages.menu.topbar.tabs.codex,
    TAB_HEROES_LABEL: messages.menu.topbar.tabs.heroes,
    TAB_STORE_LABEL: messages.menu.topbar.tabs.store,
    TAB_SYSTEM_LABEL: messages.menu.topbar.tabs.system,
    SYSTEM_TAB_STATE_CLASS: options.activeView === 'system' ? 'is-active' : '',
    SYSTEM_TAB_PRESSED: options.activeView === 'system' ? 'true' : 'false',
    TAB_WATCH_LABEL: messages.menu.topbar.tabs.watch,
    TOPBAR_BRAND_ALT: messages.common.brandAlt,
    TOPBAR_BRAND_IMAGE: options.brandImage,
  });
}

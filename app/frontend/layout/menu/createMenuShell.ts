import { createElementFromTemplate } from '@frontend/lib/html';
import type { AppI18n } from '@shared/i18n';

import { createMenuFooterBar } from './createMenuFooterBar';
import { createMenuNavbar } from './createMenuNavbar';
import menuBackgroundImage from '@assets/images/ui/backgrounds/background-image-menu.webp';

import menuShellTemplate from './menu-shell.html?raw';

interface CreateMenuShellOptions {
  activeView: 'home' | 'profile' | 'system';
  brandImage: string;
  content: HTMLElement;
  i18n: AppI18n;
  musicMuted: boolean;
}

export function createMenuShell(options: CreateMenuShellOptions): HTMLElement {
  const messages = options.i18n.getMessages();
  const rootElement = createElementFromTemplate(menuShellTemplate, {
    HOME_SCREEN_ARIA_LABEL: messages.menu.shellAriaLabel,
    HOME_SCREEN_STATE_CLASS:
      options.activeView === 'home' ? 'home-screen--home' : 'home-screen--profile',
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
      i18n: options.i18n,
    }),
    options.content,
  );

  if (options.activeView === 'home') {
    frame.append(
      createMenuFooterBar({
        i18n: options.i18n,
        musicMuted: options.musicMuted,
      }),
    );
  }

  return rootElement;
}

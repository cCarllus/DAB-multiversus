import { createElementFromTemplate } from '@frontend/lib/html';
import { resolveAuthDisplayName, type AuthUser } from '@frontend/services/auth/auth-types';
import titleGameNameImage from '@assets/images/ui/icons/title-game-name.png';
import menuBackgroundImage from '@assets/images/ui/backgrounds/background-image-menu.webp';
import type { AppI18n } from '@shared/i18n';

import gameScreenTemplate from './game-screen.html?raw';
import './game-screen.css';

interface GameScreenOptions {
  appVersion: string;
  i18n: AppI18n;
  user: AuthUser;
}

export function createGameScreen(options: GameScreenOptions): HTMLElement {
  const messages = options.i18n.getMessages();
  const rootElement = createElementFromTemplate(gameScreenTemplate, {
    GAME_ACCOUNT_LABEL: messages.game.labels.account,
    GAME_AUTHENTICATED_AS_LABEL: messages.game.labels.authenticatedAs,
    GAME_BRAND_ALT: messages.common.brandAlt,
    GAME_CLIENT_LABEL: messages.game.labels.client,
    GAME_CLIENT_VERSION: `v${options.appVersion}`,
    GAME_EYEBROW: messages.game.eyebrow,
    GAME_RETURN_TO_MENU: messages.game.returnToMenu,
    GAME_SCREEN_ARIA_LABEL: messages.game.screenAriaLabel,
    GAME_SUMMARY: messages.game.summary,
    GAME_TITLE: messages.game.title,
  });

  const brandElement = rootElement.querySelector<HTMLImageElement>('[data-game-brand]');
  const backgroundElement = rootElement.querySelector<HTMLImageElement>('[data-game-background]');
  const userDisplayElement = rootElement.querySelector<HTMLElement>('[data-game-user-display]');
  const userEmailElement = rootElement.querySelector<HTMLElement>('[data-game-user-email]');

  if (!brandElement || !backgroundElement || !userDisplayElement || !userEmailElement) {
    throw new Error('Game screen could not be initialized.');
  }

  brandElement.src = titleGameNameImage;
  backgroundElement.src = menuBackgroundImage;
  userDisplayElement.textContent = resolveAuthDisplayName(options.user);
  userEmailElement.textContent = options.user.email;

  return rootElement;
}

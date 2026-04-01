import { createElementFromTemplate } from '@app/utils/html';
import {
  resolveAuthDisplayName,
  type AuthUser,
} from '@app/services/auth/auth-types';
import titleGameNameImage from '@assets/images/ui/icons/title-game-name.png';
import menuBackgroundImage from '@assets/images/ui/backgrounds/background-image-menu.png';
import type { AppI18n } from '@shared/i18n';

import './game-screen.css';

interface GameScreenOptions {
  appVersion: string;
  i18n: AppI18n;
  user: AuthUser;
}

export function createGameScreen(options: GameScreenOptions): HTMLElement {
  const messages = options.i18n.getMessages();
  const rootElement = createElementFromTemplate(`
    <section class="game-screen" aria-label="${messages.game.screenAriaLabel}">
      <div class="game-screen__backdrop" aria-hidden="true">
        <img class="game-screen__background-image" data-game-background alt="" />
        <div class="game-screen__background-overlay"></div>
      </div>

      <div class="game-screen__content">
        <img class="game-screen__brand" data-game-brand alt="${messages.common.brandAlt}" />
        <p class="game-screen__eyebrow">${messages.game.eyebrow}</p>
        <h1 class="game-screen__title">${messages.game.title}</h1>
        <p class="game-screen__summary">${messages.game.summary}</p>

        <div class="game-screen__panel">
          <div class="game-screen__panel-row">
            <span class="game-screen__label">${messages.game.labels.authenticatedAs}</span>
            <strong class="game-screen__value" data-game-user-display></strong>
          </div>
          <div class="game-screen__panel-row">
            <span class="game-screen__label">${messages.game.labels.account}</span>
            <strong class="game-screen__value" data-game-user-email></strong>
          </div>
          <div class="game-screen__panel-row">
            <span class="game-screen__label">${messages.game.labels.client}</span>
            <strong class="game-screen__value">v${options.appVersion}</strong>
          </div>
        </div>

        <div class="game-screen__actions">
          <button type="button" class="game-screen__button" data-action="game-return-menu">
            ${messages.game.returnToMenu}
          </button>
        </div>
      </div>
    </section>
  `);

  const brandElement = rootElement.querySelector<HTMLImageElement>('[data-game-brand]');
  const backgroundElement = rootElement.querySelector<HTMLImageElement>(
    '[data-game-background]',
  );
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

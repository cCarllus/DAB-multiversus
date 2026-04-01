import { createElementFromTemplate } from '@app/utils/html';
import { resolveAuthDisplayName, type AuthUser } from '@app/auth/auth-types';
import titleGameNameImage from '@assets/images/ui/icons/title-game-name.png';
import menuBackgroundImage from '@assets/images/ui/backgrounds/background-image-menu.png';

import './game-screen.css';

interface GameScreenOptions {
  appVersion: string;
  user: AuthUser;
}

export function createGameScreen(options: GameScreenOptions): HTMLElement {
  const rootElement = createElementFromTemplate(`
    <section class="game-screen" aria-label="Game handoff screen">
      <div class="game-screen__backdrop" aria-hidden="true">
        <img class="game-screen__background-image" data-game-background alt="" />
        <div class="game-screen__background-overlay"></div>
      </div>

      <div class="game-screen__content">
        <img class="game-screen__brand" data-game-brand alt="Dead As Battle" />
        <p class="game-screen__eyebrow">Game Runtime Handoff</p>
        <h1 class="game-screen__title">Arena connection established</h1>
        <p class="game-screen__summary">
          O fluxo do launcher agora chega at&eacute; a entrada do jogo. Esta tela segura a transi&ccedil;&atilde;o enquanto o runtime real da partida ser&aacute; conectado na pr&oacute;xima fase.
        </p>

        <div class="game-screen__panel">
          <div class="game-screen__panel-row">
            <span class="game-screen__label">Authenticated as</span>
            <strong class="game-screen__value">${resolveAuthDisplayName(options.user)}</strong>
          </div>
          <div class="game-screen__panel-row">
            <span class="game-screen__label">Account</span>
            <strong class="game-screen__value">${options.user.email}</strong>
          </div>
          <div class="game-screen__panel-row">
            <span class="game-screen__label">Client</span>
            <strong class="game-screen__value">v${options.appVersion}</strong>
          </div>
        </div>

        <div class="game-screen__actions">
          <button type="button" class="game-screen__button" data-action="game-return-menu">
            Voltar ao menu
          </button>
        </div>
      </div>
    </section>
  `);

  const brandElement = rootElement.querySelector<HTMLImageElement>('[data-game-brand]');
  const backgroundElement = rootElement.querySelector<HTMLImageElement>(
    '[data-game-background]',
  );

  if (!brandElement || !backgroundElement) {
    throw new Error('Game screen could not be initialized.');
  }

  brandElement.src = titleGameNameImage;
  backgroundElement.src = menuBackgroundImage;

  return rootElement;
}

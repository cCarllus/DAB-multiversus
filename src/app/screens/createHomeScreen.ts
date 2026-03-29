import dabSigilUrl from '@assets/images/dab-sigil.svg';
import { FOUNDATION_PILLARS, PRODUCT_CONFIG } from '@shared/config/productConfig';

export function createHomeScreen(): HTMLElement {
  const screen = document.createElement('section');
  screen.className = 'screen screen--home';
  screen.dataset.routeId = 'home';

  screen.innerHTML = `
    <div class="home-hero">
      <div class="home-copy">
        <div class="home-mark">
          <img
            class="home-mark__sigil"
            src="${dabSigilUrl}"
            alt=""
          />
          <span class="home-mark__eyebrow">Dead As Battle // Desktop shell</span>
        </div>
        <h1 class="home-title">
          <span>${PRODUCT_CONFIG.title}</span>
          <small>${PRODUCT_CONFIG.subtitle}</small>
        </h1>
        <p class="home-headline">${PRODUCT_CONFIG.homeHeadline}</p>
        <p class="home-summary">${PRODUCT_CONFIG.homeSummary}</p>
        <div class="home-actions">
          <button
            class="action-button action-button--primary"
            type="button"
            data-route-target="play"
          >
            Play
          </button>
          <button
            class="action-button action-button--ghost"
            type="button"
            data-route-target="heroes"
          >
            Inspect Heroes
          </button>
        </div>
      </div>

      <aside class="home-rail">
        <div class="home-rail__section">
          <span class="panel-kicker">Shell posture</span>
          <p>Menus, transitions, and player flow stay in the app layer. Babylon stays focused on scene atmosphere and future runtime ownership.</p>
        </div>
        <div class="home-rail__section">
          <span class="panel-kicker">Player slot</span>
          <strong class="identity-slot__title">Profile imprint reserved</strong>
          <p class="identity-slot__text">A future identity card can dock here without touching the core menu layout.</p>
        </div>
      </aside>
    </div>

    <div class="foundation-strip">
      ${FOUNDATION_PILLARS.map(
        (pillar) => `
          <div class="foundation-strip__item">
            <span class="foundation-strip__label">Foundation</span>
            <strong class="foundation-strip__value">${pillar}</strong>
          </div>
        `,
      ).join('')}
    </div>
  `;

  return screen;
}

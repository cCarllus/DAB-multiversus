import { HERO_CONCEPTS } from '@shared/config/productConfig';

export function createHeroesScreen(): HTMLElement {
  const screen = document.createElement('section');
  screen.className = 'screen screen--panel';
  screen.dataset.routeId = 'heroes';

  screen.innerHTML = `
    <div class="panel-shell">
      <span class="panel-kicker">Roster framing</span>
      <h2 class="panel-title">Character identity can grow here without touching Babylon internals.</h2>
      <p class="panel-copy">
        Use this route for roster discovery, hero bios, unlock presentation, and cinematic selection states.
      </p>
      <div class="detail-list">
        ${HERO_CONCEPTS.map(
          (hero) => `
            <div class="detail-list__row">
              <span>${hero.name}</span>
              <strong>${hero.role}</strong>
            </div>
          `,
        ).join('')}
      </div>
      <div class="panel-actions">
        <button
          class="action-button action-button--primary"
          type="button"
          data-route-target="home"
        >
          Back To Deck
        </button>
        <button
          class="action-button action-button--ghost"
          type="button"
          data-route-target="play"
        >
          Stage Match Flow
        </button>
      </div>
    </div>
  `;

  return screen;
}

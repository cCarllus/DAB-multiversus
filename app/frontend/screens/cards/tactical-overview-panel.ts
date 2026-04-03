import { calculateDeckOverview } from '@frontend/services/cards/cards-selectors';
import type { PlayerDeck } from '@frontend/services/cards/cards-types';
import type { AppI18n } from '@shared/i18n';

interface RenderTacticalOverviewPanelOptions {
  container: HTMLElement;
  deck: PlayerDeck | null;
  i18n: AppI18n;
  maxDeckSlots: number;
}

export function renderTacticalOverviewPanel(
  options: RenderTacticalOverviewPanelOptions,
): void {
  const overview = calculateDeckOverview(options.deck);
  const categoryOrder = [
    'strength',
    'agility',
    'intelligence',
  ] as const;

  options.container.innerHTML = `
    <aside class="cards-overview-panel">
      <header class="cards-overview-panel__header">
        <span class="cards-overview-panel__sigil" aria-hidden="true"></span>
        <div class="cards-overview-panel__heading">
          <p class="cards-overview-panel__eyebrow">${options.i18n.t('menu.cards.overview.title')}</p>
          <h2 class="cards-overview-panel__title">${options.i18n.t('menu.cards.overview.subtitle')}</h2>
        </div>
      </header>

      <article class="cards-overview-panel__metric">
        <span class="cards-overview-panel__metric-glyph" aria-hidden="true"></span>
        <div class="cards-overview-panel__metric-copy">
          <span class="cards-overview-panel__metric-label">${options.i18n.t('menu.cards.overview.avgCost')}</span>
        </div>
        <strong class="cards-overview-panel__metric-value">${overview.averageCost.toFixed(1)}</strong>
      </article>

      <div class="cards-overview-panel__bars">
        ${categoryOrder
          .map((category) => {
            const count = overview.categoryCounts[category];
            const width = (count / options.maxDeckSlots) * 100;

            return `
              <div class="cards-overview-panel__bar" data-category="${category}">
                <span class="cards-overview-panel__bar-glyph" aria-hidden="true"></span>
                <div class="cards-overview-panel__bar-body">
                  <div class="cards-overview-panel__bar-head">
                    <span>${options.i18n.t(`menu.cards.filters.${category}`)}</span>
                    <span>${count}</span>
                  </div>
                  <div class="cards-overview-panel__bar-track">
                    <span class="cards-overview-panel__bar-fill" style="width: ${width}%"></span>
                  </div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    </aside>
  `;
}

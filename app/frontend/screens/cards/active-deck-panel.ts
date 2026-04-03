import type { AppI18n } from '@shared/i18n';

import type { PlayerDeck } from '@frontend/services/cards/cards-types';

interface RenderActiveDeckPanelOptions {
  container: HTMLElement;
  deck: PlayerDeck | null;
  isSavingDeck: boolean;
  maxDeckSlots: number;
  i18n: AppI18n;
}

export function renderActiveDeckPanel(options: RenderActiveDeckPanelOptions): void {
  const deckCards = options.deck?.cards ?? [];
  const slots = Array.from({ length: options.maxDeckSlots }, (_, index) => deckCards[index] ?? null);
  const syncLabel = options.isSavingDeck
    ? options.i18n.t('menu.cards.deck.saving')
    : options.i18n.t('menu.cards.deck.saved');

  options.container.innerHTML = `
    <section class="cards-deck-panel">
      <header class="cards-deck-panel__header">
        <div>
          <p class="cards-deck-panel__eyebrow">${options.i18n.t('menu.cards.deck.title')}</p>
          <h2 class="cards-deck-panel__title">${options.i18n.t('menu.cards.deck.subtitle')}</h2>
        </div>
        <div class="cards-deck-panel__meta">
          <span class="cards-deck-panel__count">
            ${options.i18n.t('menu.cards.deck.count', {
              count: String(deckCards.length),
              max: String(options.maxDeckSlots),
            })}
          </span>
          <span class="cards-deck-panel__sync" data-state="${options.isSavingDeck ? 'saving' : 'saved'}">${syncLabel}</span>
        </div>
      </header>
      <div class="cards-deck-panel__bay">
      <div class="cards-deck-panel__slots">
        ${slots
          .map((deckCard, index) => {
            if (!deckCard) {
              return `
                <div class="cards-deck-slot cards-deck-slot--empty" data-cards-drop-position="${index + 1}">
                  <span class="cards-deck-slot__drop-target"></span>
                  <span class="cards-deck-slot__trim"></span>
                  <span class="cards-deck-slot__position">${index + 1}</span>
                  <span class="cards-deck-slot__empty-pulse"></span>
                  <span class="cards-deck-slot__empty-icon"></span>
                  <span class="cards-deck-slot__empty-copy">${options.i18n.t('menu.cards.deck.empty')}</span>
                </div>
              `;
            }

            return `
              <button
                type="button"
                class="cards-deck-slot cards-deck-slot--filled"
                data-cards-remove="${deckCard.character.id}"
                data-cards-drop-position="${deckCard.position}"
                data-cards-drag-character-id="${deckCard.character.id}"
                data-cards-draggable="${options.isSavingDeck ? 'false' : 'true'}"
                data-cards-inspect="${deckCard.character.slug}"
                data-rarity="${deckCard.character.rarity}"
                data-category="${deckCard.character.category}"
                draggable="${options.isSavingDeck ? 'false' : 'true'}"
                ${options.isSavingDeck ? 'disabled' : ''}
              >
                <span class="cards-deck-slot__trim"></span>
                <span class="cards-deck-slot__position">${deckCard.position}</span>
                <img
                  class="cards-deck-slot__image"
                  src="${deckCard.character.imageUrl ?? ''}"
                  alt="${deckCard.character.name}"
                  draggable="false"
                />
                <span class="cards-deck-slot__veil"></span>
                <span class="cards-deck-slot__rarity">${deckCard.character.rarity}</span>
                <span class="cards-deck-slot__name">${deckCard.character.name}</span>
                <span class="cards-deck-slot__remove">${options.i18n.t('menu.cards.actions.remove')}</span>
              </button>
            `;
          })
          .join('')}
      </div>
      </div>
    </section>
  `;
}

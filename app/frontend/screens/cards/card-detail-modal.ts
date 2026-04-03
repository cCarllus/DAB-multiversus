import type { AppI18n } from '@shared/i18n';

import type { CharacterCatalogEntry } from '@frontend/services/cards/cards-types';

interface RenderCardDetailModalOptions {
  container: HTMLElement;
  character: CharacterCatalogEntry | null;
  i18n: AppI18n;
  isDeckFull: boolean;
  isDetailLoading: boolean;
  isSavingDeck: boolean;
  isUnlockingCharacterId: string | null;
}

function resolvePrimaryAction(
  options: RenderCardDetailModalOptions,
): string {
  const character = options.character;

  if (!character) {
    return '';
  }

  if (!character.isActive) {
    return `<button type="button" class="cards-modal__primary" disabled>${options.i18n.t('menu.cards.status.inactive')}</button>`;
  }

  if (!character.isUnlocked) {
    const isBusy = options.isUnlockingCharacterId === character.id;
    return `
      <button
        type="button"
        class="cards-modal__primary cards-modal__primary--unlock"
        data-cards-unlock="${character.id}"
        ${isBusy ? 'disabled' : ''}
      >
        ${isBusy
          ? options.i18n.t('menu.cards.actions.unlocking')
          : options.i18n.t('menu.cards.actions.unlock', {
              shards: options.i18n.formatNumber(character.unlockPriceShards),
            })}
      </button>
    `;
  }

  if (character.inDeck) {
    return `
      <button
        type="button"
        class="cards-modal__primary"
        data-cards-remove="${character.id}"
        ${options.isSavingDeck ? 'disabled' : ''}
      >
        ${options.i18n.t('menu.cards.actions.remove')}
      </button>
    `;
  }

  return `
    <button
      type="button"
      class="cards-modal__primary"
      data-cards-add="${character.id}"
      ${options.isSavingDeck || options.isDeckFull ? 'disabled' : ''}
    >
      ${options.i18n.t('menu.cards.actions.add')}
    </button>
  `;
}

export function renderCardDetailModal(options: RenderCardDetailModalOptions): void {
  if (!options.character && !options.isDetailLoading) {
    options.container.innerHTML = '';
    return;
  }

  const character = options.character;

  options.container.innerHTML = `
    <div class="cards-modal ${character || options.isDetailLoading ? 'is-open' : ''}">
      <button type="button" class="cards-modal__scrim" data-cards-close-detail aria-label="${options.i18n.t('menu.cards.actions.close')}"></button>
      <div class="cards-modal__panel">
        <button type="button" class="cards-modal__close" data-cards-close-detail aria-label="${options.i18n.t('menu.cards.actions.close')}"></button>
        ${
          options.isDetailLoading || !character
            ? `
              <div class="cards-modal__loading">
                <p class="cards-modal__eyebrow">${options.i18n.t('menu.cards.loading')}</p>
                <h2 class="cards-modal__title">${options.i18n.t('menu.cards.loadingTitle')}</h2>
              </div>
            `
            : `
              <div class="cards-modal__hero" data-rarity="${character.rarity}">
                <img class="cards-modal__image" src="${character.imageUrl ?? ''}" alt="${character.name}" />
                <div class="cards-modal__hero-copy">
                  <p class="cards-modal__eyebrow">${character.rarity}</p>
                  <h2 class="cards-modal__title">${character.name}</h2>
                  <p class="cards-modal__summary">${character.shortLore}</p>
                  <div class="cards-modal__pills">
                    <span>${options.i18n.t('menu.cards.detail.category')}: ${options.i18n.t(`menu.cards.filters.${character.category}`)}</span>
                    <span>${options.i18n.t('menu.cards.detail.mana')}: ${character.costMana}</span>
                    <span>${options.i18n.t('menu.cards.detail.price')}: ${options.i18n.formatNumber(character.unlockPriceShards)}</span>
                  </div>
                </div>
              </div>
              <div class="cards-modal__body">
                <section class="cards-modal__section">
                  <p class="cards-modal__section-eyebrow">${options.i18n.t('menu.cards.detail.lore')}</p>
                  <p class="cards-modal__lore">${character.fullLore}</p>
                </section>
                <section class="cards-modal__section">
                  <p class="cards-modal__section-eyebrow">${options.i18n.t('menu.cards.detail.fieldData')}</p>
                  <dl class="cards-modal__stats">
                    <div>
                      <dt>${options.i18n.t('menu.cards.detail.rarity')}</dt>
                      <dd>${character.rarity}</dd>
                    </div>
                    <div>
                      <dt>${options.i18n.t('menu.cards.detail.category')}</dt>
                      <dd>${options.i18n.t(`menu.cards.filters.${character.category}`)}</dd>
                    </div>
                    <div>
                      <dt>${options.i18n.t('menu.cards.detail.status')}</dt>
                      <dd>${options.i18n.t(`menu.cards.status.${character.status === 'in_deck' ? 'inDeck' : character.status}`)}</dd>
                    </div>
                    <div>
                      <dt>${options.i18n.t('menu.cards.detail.level')}</dt>
                      <dd>${character.level ?? '-'}</dd>
                    </div>
                  </dl>
                </section>
              </div>
              <div class="cards-modal__actions">
                ${resolvePrimaryAction(options)}
              </div>
            `
        }
      </div>
    </div>
  `;
}

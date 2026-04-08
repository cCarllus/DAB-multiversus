import type { AppI18n } from '@shared/i18n';

import type { CharacterCatalogEntry } from '@frontend/services/cards/cards-types';

export interface CardActionPanelOptions {
  character: CharacterCatalogEntry;
  i18n: AppI18n;
  isDeckFull: boolean;
  isSavingDeck: boolean;
  isUnlockingCharacterId: string | null;
}

function escapeAttribute(value: string): string {
  return value.replaceAll('"', '&quot;');
}

function renderSecondaryAction(options: CardActionPanelOptions): string {
  const { character, i18n, isDeckFull, isSavingDeck, isUnlockingCharacterId } = options;

  if (!character.isActive) {
    return '';
  }

  if (!character.isUnlocked) {
    const isBusy = isUnlockingCharacterId === character.id;
    return `
      <button
        type="button"
        class="cards-card__action-btn cards-card__action-btn--unlock"
        data-cards-unlock="${escapeAttribute(character.id)}"
        ${isBusy ? 'disabled' : ''}
      >
        ${isBusy
          ? i18n.t('menu.cards.actions.unlocking')
          : i18n.t('menu.cards.actions.unlock', {
              shards: i18n.formatNumber(character.unlockPriceShards),
            })}
      </button>
    `;
  }

  if (character.inDeck) {
    return `
      <button
        type="button"
        class="cards-card__action-btn cards-card__action-btn--remove"
        data-cards-remove="${escapeAttribute(character.id)}"
        ${isSavingDeck ? 'disabled' : ''}
      >
        ${i18n.t('menu.cards.actions.remove')}
      </button>
    `;
  }

  return `
    <button
      type="button"
      class="cards-card__action-btn cards-card__action-btn--add"
      data-cards-add="${escapeAttribute(character.id)}"
      ${isSavingDeck || isDeckFull ? 'disabled' : ''}
    >
      ${i18n.t('menu.cards.actions.add')}
    </button>
  `;
}

export function renderCardActionPanel(options: CardActionPanelOptions): string {
  const { character, i18n } = options;

  return `
    <div class="cards-card__action-panel" role="menu" aria-label="${escapeAttribute(character.name)}">
      <button
        type="button"
        class="cards-card__action-btn cards-card__action-btn--details"
        data-cards-open-detail="${escapeAttribute(character.slug)}"
      >
        ${i18n.t('menu.cards.actions.details')}
      </button>
      ${renderSecondaryAction(options)}
    </div>
  `;
}

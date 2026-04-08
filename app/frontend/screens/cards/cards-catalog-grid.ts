import type { AppI18n } from '@shared/i18n';

import type { CharacterCatalogEntry } from '@frontend/services/cards/cards-types';
import { groupCatalogCharactersByOwnership } from '@frontend/services/cards/cards-selectors';
import { renderCardActionPanel } from './card-action-panel';

interface RenderCardsCatalogGridOptions {
  container: HTMLElement;
  characters: CharacterCatalogEntry[];
  i18n: AppI18n;
  isSavingDeck: boolean;
  isUnlockingCharacterId: string | null;
  isDeckFull: boolean;
  selectedCardSlug: string | null;
}

function escapeAttribute(value: string): string {
  return value.replaceAll('"', '&quot;');
}

function renderSelectedOverlay(
  character: CharacterCatalogEntry,
  options: RenderCardsCatalogGridOptions,
): string {
  if (!character.inDeck) {
    return '';
  }

  return `
    <span class="cards-card__selected">
      <span class="cards-card__selected-ring">✓</span>
      <span class="cards-card__selected-label">${options.i18n.t('menu.cards.status.inDeck')}</span>
    </span>
  `;
}

export function renderCardsCatalogGrid(options: RenderCardsCatalogGridOptions): void {
  if (options.characters.length === 0) {
    options.container.innerHTML = `
      <div class="cards-grid__empty">
        <p class="cards-grid__empty-title">${options.i18n.t('menu.cards.emptyTitle')}</p>
        <p class="cards-grid__empty-copy">${options.i18n.t('menu.cards.empty')}</p>
      </div>
    `;
    return;
  }

  const groupedCharacters = groupCatalogCharactersByOwnership(options.characters);
  const sections = [
    {
      characters: groupedCharacters.unlocked,
      key: 'unlocked',
      title: options.i18n.t('menu.cards.sections.unlocked'),
    },
    {
      characters: groupedCharacters.locked,
      key: 'locked',
      title: options.i18n.t('menu.cards.sections.locked'),
    },
  ].filter((section) => section.characters.length > 0);

  options.container.innerHTML = `
    <div class="cards-collection">
      ${sections
        .map((section) => `
          <section class="cards-collection__section" data-group="${section.key}">
            <header class="cards-collection__separator">
              <span class="cards-collection__separator-line"></span>
              <span class="cards-collection__separator-label">${section.title}</span>
              <span class="cards-collection__separator-line"></span>
            </header>
            <div class="cards-grid">
              ${section.characters
                .map((character) => {
          const isDraggable =
            character.isActive &&
            character.isUnlocked &&
            !character.inDeck &&
            !options.isSavingDeck &&
            !options.isDeckFull;
          const progressWidth = character.level ? Math.min(character.level, 10) * 10 : 0;
          const levelMarkup =
            character.isUnlocked && character.level
              ? `
                <span class="cards-card__progress-row">
                  <span class="cards-card__progress-track">
                    <span
                      class="cards-card__progress-fill"
                      style="width: ${progressWidth}%"
                    ></span>
                  </span>
                  <span class="cards-card__level">
                    ${options.i18n.t('menu.cards.status.level', {
                      level: String(character.level),
                    })}
                  </span>
                </span>
              `
              : '';

          const isSelected = character.slug === options.selectedCardSlug;

          return `
            <article
              class="cards-card${isSelected ? ' is-selected' : ''}"
              data-rarity="${character.rarity}"
              data-category="${character.category}"
              data-status="${character.status}"
            >
              <div
                class="cards-card__inspect"
                data-cards-inspect="${escapeAttribute(character.slug)}"
                data-cards-select="${escapeAttribute(character.slug)}"
                data-cards-drag-character-id="${isDraggable ? character.id : ''}"
                data-cards-draggable="${isDraggable ? 'true' : 'false'}"
                draggable="${isDraggable ? 'true' : 'false'}"
                aria-label="${options.i18n.t('menu.cards.actions.inspect')} ${escapeAttribute(character.name)}"
              >
                <img
                  class="cards-card__image"
                  src="${character.imageUrl ?? ''}"
                  alt="${escapeAttribute(character.name)}"
                  draggable="false"
                />
                <span class="cards-card__backplate"></span>
                <span class="cards-card__gradient"></span>
                <span class="cards-card__topline">
                  <span class="cards-card__cost">${character.costMana}</span>
                  <span class="cards-card__type-icon" aria-hidden="true"></span>
                </span>
                <span class="cards-card__meta">
                  <span class="cards-card__rarity">${character.rarity}</span>
                  <span class="cards-card__name">${escapeAttribute(character.name)}</span>
                  <span class="cards-card__stats">
                    ${levelMarkup}
                  </span>
                </span>
                ${renderSelectedOverlay(character, options)}
                ${isSelected
                  ? renderCardActionPanel({
                      character,
                      i18n: options.i18n,
                      isDeckFull: options.isDeckFull,
                      isSavingDeck: options.isSavingDeck,
                      isUnlockingCharacterId: options.isUnlockingCharacterId,
                    })
                  : ''}
              </div>
            </article>
          `;
        })
        .join('')}
            </div>
          </section>
        `)
        .join('')}
    </div>
  `;
}

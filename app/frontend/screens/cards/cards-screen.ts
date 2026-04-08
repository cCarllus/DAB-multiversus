import { createElementFromTemplate } from '@frontend/lib/html';
import { resolveApiErrorMessage } from '@frontend/services/api/api-error';
import { filterCatalogCharacters } from '@frontend/services/cards/cards-selectors';
import type { CardsFilter } from '@frontend/services/cards/cards-types';
import type { CardsStore } from '@frontend/stores/cards.store';
import type { WalletStore } from '@frontend/stores/wallet.store';
import type { AppI18n } from '@shared/i18n';

import { renderActiveDeckPanel } from './active-deck-panel';
import { renderCardDetailModal } from './card-detail-modal';
import { CardInteractionController } from './card-interaction-controller';
import { renderCardsCatalogGrid } from './cards-catalog-grid';
import cardsScreenTemplate from './cards-screen.html?raw';
import './cards-screen.css';
import { renderTacticalOverviewPanel } from './tactical-overview-panel';

interface CardsScreenOptions {
  cardsStore: CardsStore;
  i18n: AppI18n;
  walletStore?: WalletStore;
}

type FeedbackTone = 'error' | 'success';

export function createCardsScreen(options: CardsScreenOptions): HTMLElement {
  const rootElement = createElementFromTemplate(cardsScreenTemplate, {
    CARDS_EYEBROW: options.i18n.t('menu.cards.eyebrow'),
    CARDS_SEARCH_PLACEHOLDER: options.i18n.t('menu.cards.searchPlaceholder'),
    CARDS_SUMMARY: options.i18n.t('menu.cards.summary'),
    CARDS_TITLE: options.i18n.t('menu.cards.title'),
    FILTER_AGILITY: options.i18n.t('menu.cards.filters.agility'),
    FILTER_ALL: options.i18n.t('menu.cards.filters.all'),
    FILTER_INTELLIGENCE: options.i18n.t('menu.cards.filters.intelligence'),
    FILTER_STRENGTH: options.i18n.t('menu.cards.filters.strength'),
  });
  const feedbackElement = rootElement.querySelector<HTMLElement>('[data-cards-feedback]');
  const deckPanelElement = rootElement.querySelector<HTMLElement>('[data-cards-deck-panel]');
  const overviewPanelElement = rootElement.querySelector<HTMLElement>('[data-cards-overview-panel]');
  const gridElement = rootElement.querySelector<HTMLElement>('[data-cards-grid]');
  const searchInput = rootElement.querySelector<HTMLInputElement>('[data-cards-search]');
  const filterSelect = rootElement.querySelector<HTMLSelectElement>('[data-cards-filter-select]');

  if (
    !feedbackElement ||
    !deckPanelElement ||
    !overviewPanelElement ||
    !gridElement ||
    !searchInput ||
    !filterSelect
  ) {
    throw new Error('Cards screen could not be initialized.');
  }

  const modalElement = document.createElement('div');
  rootElement.append(modalElement);

  let activeFilter: CardsFilter = 'all';
  let query = '';
  let feedback: { message: string; tone: FeedbackTone } | null = null;
  let draggingCharacterId: string | null = null;
  let dragSourceElement: HTMLElement | null = null;
  let dragGhostElement: HTMLElement | null = null;
  let currentDropTarget: HTMLElement | null = null;
  let selectedCardSlug: string | null = null;

  const setFeedback = (nextFeedback: typeof feedback): void => {
    feedback = nextFeedback;

    if (!feedback) {
      feedbackElement.hidden = true;
      feedbackElement.textContent = '';
      feedbackElement.dataset.tone = '';
      return;
    }

    feedbackElement.hidden = false;
    feedbackElement.textContent = feedback.message;
    feedbackElement.dataset.tone = feedback.tone;
  };

  const render = (): void => {
    const snapshot = options.cardsStore.getSnapshot();
    const filteredCharacters = filterCatalogCharacters(snapshot.catalog, activeFilter, query);
    const isDeckFull = (snapshot.deck?.cards.length ?? 0) >= snapshot.maxDeckSlots;

    searchInput.value = query;
    filterSelect.value = activeFilter;

    renderActiveDeckPanel({
      container: deckPanelElement,
      deck: snapshot.deck,
      i18n: options.i18n,
      isSavingDeck: snapshot.isSavingDeck,
      maxDeckSlots: snapshot.maxDeckSlots,
    });
    renderTacticalOverviewPanel({
      container: overviewPanelElement,
      deck: snapshot.deck,
      i18n: options.i18n,
      maxDeckSlots: snapshot.maxDeckSlots,
    });
    renderCardsCatalogGrid({
      characters: filteredCharacters,
      container: gridElement,
      i18n: options.i18n,
      isDeckFull,
      isSavingDeck: snapshot.isSavingDeck,
      isUnlockingCharacterId: snapshot.unlockingCharacterId,
      selectedCardSlug,
    });
    renderCardDetailModal({
      character: snapshot.selectedCharacter,
      container: modalElement,
      i18n: options.i18n,
      isDeckFull,
      isDetailLoading: snapshot.isDetailLoading,
      isSavingDeck: snapshot.isSavingDeck,
      isUnlockingCharacterId: snapshot.unlockingCharacterId,
    });
  };

  const syncWallet = (): void => {
    void options.walletStore?.load(true).catch(() => undefined);
  };

  const setDropTarget = (nextTarget: HTMLElement | null): void => {
    if (currentDropTarget === nextTarget) {
      return;
    }

    currentDropTarget?.classList.remove('is-drop-target');
    currentDropTarget = nextTarget;
    currentDropTarget?.classList.add('is-drop-target');
  };

  const clearDragState = (): void => {
    draggingCharacterId = null;
    dragSourceElement?.classList.remove('is-drag-source');
    dragSourceElement = null;
    dragGhostElement?.remove();
    dragGhostElement = null;
    setDropTarget(null);
    rootElement.classList.remove('is-card-dragging');
  };

  const handleUnlock = async (characterId: string): Promise<void> => {
    try {
      const result = await options.cardsStore.unlockCharacter(characterId);
      syncWallet();
      setFeedback({
        message: options.i18n.t('menu.cards.feedback.unlockSuccess', {
          name: result.character.name,
        }),
        tone: 'success',
      });
      render();
    } catch (error) {
      setFeedback({
        message: resolveApiErrorMessage(error, options.i18n),
        tone: 'error',
      });
      render();
    }
  };

  const handleAdd = async (characterId: string, targetPosition?: number): Promise<void> => {
    try {
      if (targetPosition === undefined) {
        await options.cardsStore.addCharacterToDeck(characterId);
      } else {
        await options.cardsStore.insertCharacterIntoDeck(characterId, targetPosition);
      }

      setFeedback(null);
      render();
    } catch (error) {
      setFeedback({
        message: resolveApiErrorMessage(error, options.i18n),
        tone: 'error',
      });
      render();
    }
  };

  const openCharacterDetail = (slug: string): void => {
    selectedCardSlug = null;
    void options.cardsStore
      .openCharacterDetail(slug)
      .then(() => {
        setFeedback(null);
        render();
      })
      .catch((error: unknown) => {
        setFeedback({
          message: resolveApiErrorMessage(error, options.i18n),
          tone: 'error',
        });
        render();
      });
  };

  const handleRemove = async (characterId: string): Promise<void> => {
    try {
      await options.cardsStore.removeCharacterFromDeck(characterId);
      setFeedback(null);
      render();
    } catch (error) {
      setFeedback({
        message: resolveApiErrorMessage(error, options.i18n),
        tone: 'error',
      });
      render();
    }
  };

  const interactionController = new CardInteractionController(
    { longPressThreshold: 400, dragMoveThreshold: 8 },
    (slug) => { openCharacterDetail(slug); },
  );

  const cachedSnapshot = options.cardsStore.getSnapshot();
  setFeedback(null);
  render();

  const unsubscribe = options.cardsStore.subscribe(() => {
    if (!rootElement.isConnected) {
      unsubscribe();
      interactionController.dispose();
      return;
    }

    render();
  });

  searchInput.addEventListener('input', () => {
    query = searchInput.value;
    render();
  });

  filterSelect.addEventListener('change', () => {
    activeFilter = filterSelect.value as CardsFilter;
    render();
  });

  // Long press detection via pointer events
  rootElement.addEventListener('pointerdown', (event) => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-cards-inspect]')
        : null;
    const slug = target?.dataset.cardsInspect;

    if (slug) {
      interactionController.handlePointerDown(slug, event.clientX, event.clientY);
    }
  });

  rootElement.addEventListener('pointermove', (event) => {
    interactionController.handlePointerMove(event.clientX, event.clientY);
  });

  rootElement.addEventListener('pointerup', () => {
    interactionController.handlePointerUp();
  });

  // Unified click handler — priority order:
  // 1. close-detail  2. unlock  3. add  4. remove  5. open-detail (panel)  6. card select  7. outside close
  rootElement.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const closeDetail = event.target.closest<HTMLElement>('[data-cards-close-detail]');
    if (closeDetail) {
      options.cardsStore.closeCharacterDetail();
      setFeedback(null);
      render();
      return;
    }

    const unlockTarget = event.target.closest<HTMLElement>('[data-cards-unlock]');
    if (unlockTarget?.dataset.cardsUnlock) {
      void handleUnlock(unlockTarget.dataset.cardsUnlock);
      return;
    }

    const addTarget = event.target.closest<HTMLElement>('[data-cards-add]');
    if (addTarget?.dataset.cardsAdd) {
      void handleAdd(addTarget.dataset.cardsAdd);
      return;
    }

    const removeTarget = event.target.closest<HTMLElement>('[data-cards-remove]');
    if (removeTarget?.dataset.cardsRemove) {
      void handleRemove(removeTarget.dataset.cardsRemove);
      return;
    }

    const openDetailTarget = event.target.closest<HTMLElement>('[data-cards-open-detail]');
    if (openDetailTarget?.dataset.cardsOpenDetail) {
      openCharacterDetail(openDetailTarget.dataset.cardsOpenDetail);
      return;
    }

    const selectTarget = event.target.closest<HTMLElement>('[data-cards-select]');
    const selectSlug = selectTarget?.dataset.cardsSelect;
    if (selectSlug) {
      selectedCardSlug = selectedCardSlug === selectSlug ? null : selectSlug;
      render();
      return;
    }

    // Click outside any card — close the action panel
    if (selectedCardSlug !== null) {
      selectedCardSlug = null;
      render();
    }
  });

  rootElement.addEventListener('dragstart', (event) => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-cards-drag-character-id]')
        : null;
    const characterId = target?.dataset.cardsDragCharacterId;

    if (!characterId) {
      event.preventDefault();
      return;
    }

    interactionController.handleDragStart();
    selectedCardSlug = null;

    draggingCharacterId = characterId;
    dragSourceElement = target;
    rootElement.classList.add('is-card-dragging');

    event.dataTransfer?.setData('text/plain', characterId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';

      const dragCardElement = target.closest<HTMLElement>('.cards-card, .cards-deck-slot');

      if (dragCardElement) {
        const dragCardRect = dragCardElement.getBoundingClientRect();
        const ghostElement = dragCardElement.cloneNode(true) as HTMLElement;

        ghostElement.classList.add('cards-drag-ghost');
        ghostElement.style.width = `${Math.round(dragCardRect.width)}px`;
        ghostElement.style.height = `${Math.round(dragCardRect.height)}px`;
        ghostElement.style.top = '-9999px';
        ghostElement.style.left = '-9999px';
        document.body.append(ghostElement);
        dragGhostElement = ghostElement;

        event.dataTransfer.setDragImage(
          ghostElement,
          Math.round(dragCardRect.width / 2),
          Math.round(dragCardRect.height / 2),
        );
      }
    }

    requestAnimationFrame(() => {
      dragSourceElement?.classList.add('is-drag-source');
    });
  });

  rootElement.addEventListener('dragend', () => {
    clearDragState();
  });

  rootElement.addEventListener('dragover', (event) => {
    if (!draggingCharacterId) {
      return;
    }

    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-cards-drop-position]')
        : null;

    if (!target) {
      setDropTarget(null);
      return;
    }

    event.preventDefault();
    setDropTarget(target);

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  });

  rootElement.addEventListener('drop', (event) => {
    if (!draggingCharacterId) {
      return;
    }

    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-cards-drop-position]')
        : null;
    const characterId = draggingCharacterId;
    const targetPosition = Number.parseInt(target?.dataset.cardsDropPosition ?? '', 10);

    event.preventDefault();
    clearDragState();

    if (!target || Number.isNaN(targetPosition)) {
      return;
    }

    void handleAdd(characterId, targetPosition);
  });

  rootElement.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (selectedCardSlug !== null) {
        selectedCardSlug = null;
        render();
        return;
      }

      options.cardsStore.closeCharacterDetail();
      render();
    }
  });

  void options.cardsStore
    .load(!cachedSnapshot.deck && cachedSnapshot.catalog.length === 0)
    .then(() => {
      setFeedback(null);
      render();
    })
    .catch((error: unknown) => {
      setFeedback({
        message: resolveApiErrorMessage(error, options.i18n),
        tone: 'error',
      });
      render();
    });

  return rootElement;
}

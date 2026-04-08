// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';

import { CardInteractionController } from '../../app/frontend/screens/cards/card-interaction-controller';
import { renderCardActionPanel } from '../../app/frontend/screens/cards/card-action-panel';
import type { CharacterCatalogEntry } from '../../app/frontend/services/cards/cards-types';
import { createTestI18n } from '../helpers/frontend';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function createCharacter(
  overrides: Partial<CharacterCatalogEntry> = {},
): CharacterCatalogEntry {
  return {
    category: 'strength',
    costMana: 4,
    createdAt: '2026-04-01T00:00:00.000Z',
    fullLore: 'A veteran of a hundred sieges.',
    id: 'char-1',
    imageUrl: '/uploads/characters/portrait.svg',
    inDeck: false,
    isActive: true,
    isDefaultUnlocked: false,
    isUnlocked: true,
    level: 1,
    name: 'Iron Sentinel',
    rarity: 'common',
    releaseOrder: 1,
    shortDescription: 'Frontline pressure.',
    shortLore: 'Forged in war.',
    slug: 'iron-sentinel',
    status: 'unlocked',
    unlockPriceShards: 80,
    unlockedAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-02T00:00:00.000Z',
    ...overrides,
  };
}

// ─── CardInteractionController ────────────────────────────────────────────────

describe('CardInteractionController', () => {
  function createController(onLongPress = vi.fn()) {
    const timers: Array<{ id: number; fn: () => void; ms: number }> = [];
    let nextId = 1;

    const schedule = (fn: () => void, ms: number): number => {
      const id = nextId++;
      timers.push({ id, fn, ms });
      return id;
    };

    const unschedule = (id: number): void => {
      const index = timers.findIndex((t) => t.id === id);
      if (index !== -1) {
        timers.splice(index, 1);
      }
    };

    const tick = (ms: number): void => {
      const fired = timers.filter((t) => t.ms <= ms);
      for (const timer of fired) {
        const index = timers.indexOf(timer);
        if (index !== -1) {
          timers.splice(index, 1);
          timer.fn();
        }
      }
    };

    const controller = new CardInteractionController(
      { longPressThreshold: 400, dragMoveThreshold: 8 },
      onLongPress,
      schedule as never,
      unschedule as never,
    );

    return { controller, tick, timers };
  }

  it('fires onLongPress after threshold when pointer is stationary', () => {
    const onLongPress = vi.fn();
    const { controller, tick } = createController(onLongPress);

    controller.handlePointerDown('iron-sentinel', 100, 100);
    tick(400);

    expect(onLongPress).toHaveBeenCalledOnce();
    expect(onLongPress).toHaveBeenCalledWith('iron-sentinel');
  });

  it('does NOT fire onLongPress if pointerUp comes before threshold', () => {
    const onLongPress = vi.fn();
    const { controller, tick } = createController(onLongPress);

    controller.handlePointerDown('iron-sentinel', 100, 100);
    controller.handlePointerUp();
    tick(400);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('cancels long press when pointer moves beyond dragMoveThreshold', () => {
    const onLongPress = vi.fn();
    const { controller, tick } = createController(onLongPress);

    controller.handlePointerDown('iron-sentinel', 100, 100);
    controller.handlePointerMove(109, 100); // dx = 9 > threshold of 8
    tick(400);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('does NOT cancel long press when movement is within dragMoveThreshold', () => {
    const onLongPress = vi.fn();
    const { controller, tick } = createController(onLongPress);

    controller.handlePointerDown('iron-sentinel', 100, 100);
    controller.handlePointerMove(107, 103); // dx = 7, dy = 3 — both within threshold
    tick(400);

    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it('cancels long press on dragStart', () => {
    const onLongPress = vi.fn();
    const { controller, tick } = createController(onLongPress);

    controller.handlePointerDown('iron-sentinel', 100, 100);
    controller.handleDragStart();
    tick(400);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('cancels previous long press timer when a new pointerDown starts', () => {
    const onLongPress = vi.fn();
    const { controller, tick } = createController(onLongPress);

    controller.handlePointerDown('iron-sentinel', 100, 100);
    controller.handlePointerDown('void-weaver', 200, 200); // new press before tick
    tick(400);

    expect(onLongPress).toHaveBeenCalledOnce();
    expect(onLongPress).toHaveBeenCalledWith('void-weaver');
  });

  it('fires long press with the correct slug', () => {
    const onLongPress = vi.fn();
    const { controller, tick } = createController(onLongPress);

    controller.handlePointerDown('shadow-archer', 50, 50);
    tick(400);

    expect(onLongPress).toHaveBeenCalledWith('shadow-archer');
  });

  it('does not fire long press after dispose is called', () => {
    const onLongPress = vi.fn();
    const { controller, tick } = createController(onLongPress);

    controller.handlePointerDown('iron-sentinel', 100, 100);
    controller.dispose();
    tick(400);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('cancels long press when vertical movement exceeds threshold', () => {
    const onLongPress = vi.fn();
    const { controller, tick } = createController(onLongPress);

    controller.handlePointerDown('iron-sentinel', 100, 100);
    controller.handlePointerMove(100, 110); // dy = 10 > threshold of 8
    tick(400);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('does not error when pointermove is called without a prior pointerDown', () => {
    const onLongPress = vi.fn();
    const { controller } = createController(onLongPress);

    expect(() => controller.handlePointerMove(100, 100)).not.toThrow();
    expect(onLongPress).not.toHaveBeenCalled();
  });
});

// ─── renderCardActionPanel ────────────────────────────────────────────────────

describe('renderCardActionPanel', () => {
  const i18n = createTestI18n('en');

  it('shows Details and Add to Deck for an unlocked card not in deck', () => {
    const character = createCharacter({ isUnlocked: true, inDeck: false });
    const html = renderCardActionPanel({
      character,
      i18n,
      isDeckFull: false,
      isSavingDeck: false,
      isUnlockingCharacterId: null,
    });

    expect(html).toContain('data-cards-open-detail="iron-sentinel"');
    expect(html).toContain(`data-cards-add="${character.id}"`);
    expect(html).not.toContain('data-cards-remove');
    expect(html).not.toContain('data-cards-unlock');
  });

  it('shows Details and Remove from Deck for a card that is in the deck', () => {
    const character = createCharacter({ isUnlocked: true, inDeck: true, status: 'in_deck' });
    const html = renderCardActionPanel({
      character,
      i18n,
      isDeckFull: true,
      isSavingDeck: false,
      isUnlockingCharacterId: null,
    });

    expect(html).toContain('data-cards-open-detail="iron-sentinel"');
    expect(html).toContain(`data-cards-remove="${character.id}"`);
    expect(html).not.toContain('data-cards-add');
    expect(html).not.toContain('data-cards-unlock');
  });

  it('shows Details and Unlock for a locked card', () => {
    const character = createCharacter({
      isUnlocked: false,
      inDeck: false,
      status: 'locked',
      level: null,
      unlockedAt: null,
    });
    const html = renderCardActionPanel({
      character,
      i18n,
      isDeckFull: false,
      isSavingDeck: false,
      isUnlockingCharacterId: null,
    });

    expect(html).toContain('data-cards-open-detail="iron-sentinel"');
    expect(html).toContain(`data-cards-unlock="${character.id}"`);
    expect(html).not.toContain('data-cards-add');
    expect(html).not.toContain('data-cards-remove');
  });

  it('shows only Details for an inactive card', () => {
    const character = createCharacter({ isActive: false });
    const html = renderCardActionPanel({
      character,
      i18n,
      isDeckFull: false,
      isSavingDeck: false,
      isUnlockingCharacterId: null,
    });

    expect(html).toContain('data-cards-open-detail="iron-sentinel"');
    expect(html).not.toContain('data-cards-add');
    expect(html).not.toContain('data-cards-remove');
    expect(html).not.toContain('data-cards-unlock');
  });

  it('disables Add to Deck when deck is full', () => {
    const character = createCharacter({ isUnlocked: true, inDeck: false });
    const html = renderCardActionPanel({
      character,
      i18n,
      isDeckFull: true,
      isSavingDeck: false,
      isUnlockingCharacterId: null,
    });

    // The add button should be present but have the disabled attribute
    expect(html).toContain(`data-cards-add="${character.id}"`);
    const addButtonMatch = html.match(/<button[^>]*data-cards-add[^>]*>/);
    expect(addButtonMatch?.[0]).toContain('disabled');
  });

  it('disables Add to Deck when deck is saving', () => {
    const character = createCharacter({ isUnlocked: true, inDeck: false });
    const html = renderCardActionPanel({
      character,
      i18n,
      isDeckFull: false,
      isSavingDeck: true,
      isUnlockingCharacterId: null,
    });

    const addButtonMatch = html.match(/<button[^>]*data-cards-add[^>]*>/);
    expect(addButtonMatch?.[0]).toContain('disabled');
  });

  it('disables Remove from Deck when deck is saving', () => {
    const character = createCharacter({ isUnlocked: true, inDeck: true, status: 'in_deck' });
    const html = renderCardActionPanel({
      character,
      i18n,
      isDeckFull: true,
      isSavingDeck: true,
      isUnlockingCharacterId: null,
    });

    const removeButtonMatch = html.match(/<button[^>]*data-cards-remove[^>]*>/);
    expect(removeButtonMatch?.[0]).toContain('disabled');
  });

  it('disables Unlock button when the character is being unlocked', () => {
    const character = createCharacter({
      isUnlocked: false,
      inDeck: false,
      status: 'locked',
      level: null,
      unlockedAt: null,
    });
    const html = renderCardActionPanel({
      character,
      i18n,
      isDeckFull: false,
      isSavingDeck: false,
      isUnlockingCharacterId: character.id,
    });

    const unlockButtonMatch = html.match(/<button[^>]*data-cards-unlock[^>]*>/);
    expect(unlockButtonMatch?.[0]).toContain('disabled');
  });

  it('does not disable Unlock button when a different character is being unlocked', () => {
    const character = createCharacter({
      isUnlocked: false,
      inDeck: false,
      status: 'locked',
      level: null,
      unlockedAt: null,
    });
    const html = renderCardActionPanel({
      character,
      i18n,
      isDeckFull: false,
      isSavingDeck: false,
      isUnlockingCharacterId: 'other-char-id',
    });

    const unlockButtonMatch = html.match(/<button[^>]*data-cards-unlock[^>]*>/);
    expect(unlockButtonMatch?.[0]).not.toContain('disabled');
  });

  it('Add to Deck is enabled when deck is not full and not saving', () => {
    const character = createCharacter({ isUnlocked: true, inDeck: false });
    const html = renderCardActionPanel({
      character,
      i18n,
      isDeckFull: false,
      isSavingDeck: false,
      isUnlockingCharacterId: null,
    });

    const addButtonMatch = html.match(/<button[^>]*data-cards-add[^>]*>/);
    expect(addButtonMatch?.[0]).not.toContain('disabled');
  });
});

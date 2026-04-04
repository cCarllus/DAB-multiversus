import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createCharactersController } from '../../app/backend/controllers/characters.controller';
import { createDeckController } from '../../app/backend/controllers/deck.controller';
import { createApp } from '../../app/backend/lib/create-app';
import { createCharactersRouter } from '../../app/backend/routes/characters.routes';
import { createDeckRouter } from '../../app/backend/routes/deck.routes';

function createAuthenticatedMiddleware(): express.RequestHandler {
  return (request, _response, next) => {
    request.authContext = {
      email: 'player@example.com',
      nickname: 'player.one',
      sessionId: 'session-1',
      userId: 'user-1',
    };
    next();
  };
}

describe('backend cards http routes', () => {
  it('returns catalog, character detail, unlock responses, and active deck payloads', async () => {
    const charactersService = {
      getCatalog: vi.fn(async () => ({
        characters: [
          {
            category: 'strength',
            costMana: 5,
            createdAt: '2026-04-01T00:00:00.000Z',
            fullLore: 'A legendary warlord.',
            id: '11111111-1111-1111-1111-111111111111',
            imageUrl: '/uploads/characters/strength-portrait.svg',
            inDeck: true,
            isActive: true,
            isDefaultUnlocked: false,
            isUnlocked: true,
            level: 4,
            name: 'Grommash',
            rarity: 'legendary',
            releaseOrder: 1,
            shortDescription: 'Frontline pressure.',
            shortLore: 'Forged in war.',
            slug: 'grommash',
            status: 'in_deck',
            unlockPriceShards: 400,
            unlockedAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-02T00:00:00.000Z',
          },
        ],
        maxDeckSlots: 8,
      })),
      getCharacterBySlug: vi.fn(async () => ({
        character: {
          category: 'intelligence',
          costMana: 4,
          createdAt: '2026-04-01T00:00:00.000Z',
          fullLore: 'She threads reality like cloth.',
          id: '22222222-2222-2222-2222-222222222222',
          imageUrl: '/uploads/characters/intelligence-portrait.svg',
          inDeck: false,
          isActive: true,
          isDefaultUnlocked: false,
          isUnlocked: false,
          level: null,
          name: 'Void Weaver',
          rarity: 'epic',
          releaseOrder: 2,
          shortDescription: 'Spatial control.',
          shortLore: 'A seamstress of void.',
          slug: 'void-weaver',
          status: 'locked',
          unlockPriceShards: 260,
          unlockedAt: null,
          updatedAt: '2026-04-02T00:00:00.000Z',
        },
      })),
      unlockCharacter: vi.fn(async () => ({
        character: {
          category: 'agility',
          costMana: 3,
          createdAt: '2026-04-01T00:00:00.000Z',
          fullLore: 'Fast and precise.',
          id: '33333333-3333-3333-3333-333333333333',
          imageUrl: '/uploads/characters/agility-portrait.svg',
          inDeck: false,
          isActive: true,
          isDefaultUnlocked: false,
          isUnlocked: true,
          level: 1,
          name: 'Swiftblade',
          rarity: 'rare',
          releaseOrder: 3,
          shortDescription: 'Tempo duelist.',
          shortLore: 'Exiled for ending wars too quickly.',
          slug: 'swiftblade',
          status: 'unlocked',
          unlockPriceShards: 140,
          unlockedAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
        transaction: {
          amount: 140,
          createdAt: '2026-04-03T00:00:00.000Z',
          currencyType: 'shards',
          direction: 'debit',
          id: 'wallet-transaction-1',
          metadataJson: {
            characterId: '33333333-3333-3333-3333-333333333333',
          },
          reason: 'character_unlock',
        },
        wallet: {
          createdAt: '2026-04-01T00:00:00.000Z',
          shards: 360,
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
      })),
    };
    const deckService = {
      getActiveDeck: vi.fn(async () => ({
        deck: {
          cards: [],
          createdAt: '2026-04-01T00:00:00.000Z',
          id: 'deck-1',
          isActive: true,
          maxSlots: 8,
          name: 'Primary Loadout',
          updatedAt: '2026-04-03T00:00:00.000Z',
          userId: 'user-1',
        },
      })),
      saveActiveDeck: vi.fn(async (_userId: string, payload: { cards: string[] }) => ({
        deck: {
          cards: payload.cards.map((characterId, index) => ({
            character: {
              category: 'strength',
              costMana: 4,
              createdAt: '2026-04-01T00:00:00.000Z',
              fullLore: 'Frontline pressure.',
              id: characterId,
              imageUrl: '/uploads/characters/strength-portrait.svg',
              inDeck: true,
              isActive: true,
              isDefaultUnlocked: false,
              isUnlocked: true,
              level: 1,
              name: `Character ${index + 1}`,
              rarity: 'common',
              releaseOrder: index + 1,
              shortDescription: 'Test',
              shortLore: 'Test',
              slug: `character-${index + 1}`,
              status: 'in_deck',
              unlockPriceShards: 70,
              unlockedAt: '2026-04-01T00:00:00.000Z',
              updatedAt: '2026-04-03T00:00:00.000Z',
            },
            position: index + 1,
          })),
          createdAt: '2026-04-01T00:00:00.000Z',
          id: 'deck-1',
          isActive: true,
          maxSlots: 8,
          name: 'Primary Loadout',
          updatedAt: '2026-04-03T00:00:00.000Z',
          userId: 'user-1',
        },
      })),
    };
    const authMiddleware = createAuthenticatedMiddleware();
    const app = createApp({
      authRouter: express.Router(),
      charactersRouter: createCharactersRouter({
        authMiddleware,
        charactersController: createCharactersController(charactersService as never),
      }),
      chatRouter: express.Router(),
      deckRouter: createDeckRouter({
        authMiddleware,
        deckController: createDeckController(deckService as never),
      }),
      friendsRouter: express.Router(),
      meRouter: express.Router(),
      presenceRouter: express.Router(),
      profileRouter: express.Router(),
      usersRouter: express.Router(),
    });

    const catalogResponse = await request(app).get('/characters').expect(200);
    expect(catalogResponse.body.characters[0]).toMatchObject({
      id: '11111111-1111-1111-1111-111111111111',
      inDeck: true,
      slug: 'grommash',
    });
    expect(charactersService.getCatalog).toHaveBeenCalledWith('user-1', {
      includeInactive: false,
    });

    const detailResponse = await request(app).get('/characters/void-weaver').expect(200);
    expect(detailResponse.body.character).toMatchObject({
      slug: 'void-weaver',
      status: 'locked',
    });
    expect(charactersService.getCharacterBySlug).toHaveBeenCalledWith('user-1', 'void-weaver', {
      includeInactive: false,
    });

    const unlockResponse = await request(app)
      .post('/characters/33333333-3333-3333-3333-333333333333/unlock')
      .expect(200);
    expect(unlockResponse.body.wallet).toMatchObject({
      shards: 360,
    });

    const deckResponse = await request(app).get('/deck').expect(200);
    expect(deckResponse.body.deck).toMatchObject({
      id: 'deck-1',
      maxSlots: 8,
    });

    const saveResponse = await request(app)
      .post('/deck')
      .send({
        cards: [
          '44444444-4444-4444-4444-444444444444',
          '55555555-5555-5555-5555-555555555555',
        ],
      })
      .expect(200);
    expect(deckService.saveActiveDeck).toHaveBeenCalledWith('user-1', {
      cards: [
        '44444444-4444-4444-4444-444444444444',
        '55555555-5555-5555-5555-555555555555',
      ],
    });
    expect(saveResponse.body.deck.cards).toEqual([
      expect.objectContaining({
        position: 1,
      }),
      expect.objectContaining({
        position: 2,
      }),
    ]);
  });

  it('passes includeInactive through to catalog and detail endpoints', async () => {
    const charactersService = {
      getCatalog: vi.fn(async () => ({ characters: [], maxDeckSlots: 8 })),
      getCharacterBySlug: vi.fn(async () => ({
        character: {
          category: 'strength',
          costMana: 1,
          createdAt: '2026-04-01T00:00:00.000Z',
          fullLore: 'Inactive entry.',
          id: '11111111-1111-1111-1111-111111111111',
          imageUrl: '/uploads/characters/strength-portrait.svg',
          inDeck: false,
          isActive: false,
          isDefaultUnlocked: false,
          isUnlocked: false,
          level: null,
          name: 'Inactive',
          rarity: 'common',
          releaseOrder: 99,
          shortDescription: 'Inactive',
          shortLore: 'Inactive',
          slug: 'inactive',
          status: 'inactive',
          unlockPriceShards: 0,
          unlockedAt: null,
          updatedAt: '2026-04-02T00:00:00.000Z',
        },
      })),
      unlockCharacter: vi.fn(),
    };
    const app = createApp({
      authRouter: express.Router(),
      charactersRouter: createCharactersRouter({
        authMiddleware: createAuthenticatedMiddleware(),
        charactersController: createCharactersController(charactersService as never),
      }),
      chatRouter: express.Router(),
      deckRouter: express.Router(),
      friendsRouter: express.Router(),
      meRouter: express.Router(),
      presenceRouter: express.Router(),
      profileRouter: express.Router(),
      usersRouter: express.Router(),
    });

    await request(app).get('/characters?includeInactive=true').expect(200);
    await request(app).get('/characters/inactive?includeInactive=true').expect(200);

    expect(charactersService.getCatalog).toHaveBeenCalledWith('user-1', {
      includeInactive: true,
    });
    expect(charactersService.getCharacterBySlug).toHaveBeenCalledWith('user-1', 'inactive', {
      includeInactive: true,
    });
  });

  it('validates deck payload size before hitting the service', async () => {
    const deckService = {
      getActiveDeck: vi.fn(),
      saveActiveDeck: vi.fn(),
    };
    const app = createApp({
      authRouter: express.Router(),
      charactersRouter: createCharactersRouter({
        authMiddleware: createAuthenticatedMiddleware(),
        charactersController: createCharactersController({
          getCatalog: vi.fn(),
          getCharacterBySlug: vi.fn(),
          unlockCharacter: vi.fn(),
        } as never),
      }),
      chatRouter: express.Router(),
      deckRouter: createDeckRouter({
        authMiddleware: createAuthenticatedMiddleware(),
        deckController: createDeckController(deckService as never),
      }),
      friendsRouter: express.Router(),
      meRouter: express.Router(),
      presenceRouter: express.Router(),
      profileRouter: express.Router(),
      usersRouter: express.Router(),
    });

    await request(app)
      .post('/deck')
      .send({
        cards: new Array(9)
          .fill(null)
          .map((_, index) => `${index}`.padStart(8, '0') + '-0000-0000-0000-000000000000'),
      })
      .expect(400);

    expect(deckService.saveActiveDeck).not.toHaveBeenCalled();
  });
});

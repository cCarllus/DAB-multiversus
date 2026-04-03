import type { RequestHandler } from 'express';

import { asyncHandler } from '../lib/async-handler';
import { DeckService } from '../services/deck.service';
import { saveDeckRequestSchema } from '../validators/cards.validator';
import { requireAuthUserId } from './controller-auth';

export interface DeckController {
  getActiveDeck: RequestHandler;
  saveActiveDeck: RequestHandler;
}

export function createDeckController(deckService: DeckService): DeckController {
  return {
    getActiveDeck: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const result = await deckService.getActiveDeck(userId);
      response.status(200).json(result);
    }),

    saveActiveDeck: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const payload = saveDeckRequestSchema.parse(request.body);
      const result = await deckService.saveActiveDeck(userId, payload);
      response.status(200).json(result);
    }),
  };
}

import type { RequestHandler } from 'express';

import { asyncHandler } from '../lib/async-handler';
import { CharactersService } from '../services/characters.service';
import {
  characterCatalogQuerySchema,
  characterIdParamsSchema,
  characterSlugParamsSchema,
} from '../validators/cards.validator';
import { requireAuthUserId } from './controller-auth';

export interface CharactersController {
  detail: RequestHandler;
  list: RequestHandler;
  unlock: RequestHandler;
}

export function createCharactersController(
  charactersService: CharactersService,
): CharactersController {
  return {
    list: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const query = characterCatalogQuerySchema.parse(request.query);
      const result = await charactersService.getCatalog(userId, {
        includeInactive: query.includeInactive,
      });
      response.status(200).json(result);
    }),

    detail: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const params = characterSlugParamsSchema.parse(request.params);
      const query = characterCatalogQuerySchema.parse(request.query);
      const result = await charactersService.getCharacterBySlug(userId, params.slug, {
        includeInactive: query.includeInactive,
      });
      response.status(200).json(result);
    }),

    unlock: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const params = characterIdParamsSchema.parse(request.params);
      const result = await charactersService.unlockCharacter(userId, params.characterId);
      response.status(200).json(result);
    }),
  };
}

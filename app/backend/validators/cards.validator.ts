import { z } from 'zod';

import { ACTIVE_DECK_MAX_SLOTS } from '../../shared/contracts/cards.contract';

export const characterSlugParamsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/)
    .transform((slug) => slug.toLowerCase()),
});

export const characterIdParamsSchema = z.object({
  characterId: z.string().uuid(),
});

export const characterCatalogQuerySchema = z.object({
  includeInactive: z
    .enum(['false', 'true'])
    .optional()
    .transform((value) => value === 'true'),
});

export const saveDeckRequestSchema = z.object({
  cards: z.array(z.string().uuid()).max(ACTIVE_DECK_MAX_SLOTS),
});

import { existsSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import characterCatalogSeed from '../content/character-catalog.seed.json';
import { withTransaction, type DatabaseClient } from '../lib/postgres';
import { CharactersRepository } from '../repositories/characters.repository';
import { UserCharactersRepository } from '../repositories/user-characters.repository';
import { UsersRepository } from '../repositories/users.repository';
import {
  CHARACTER_CATEGORIES,
  CHARACTER_RARITIES,
} from '../../shared/contracts/cards.contract';
import type { UpsertCharacterCatalogInput } from '../types/cards.types';

const IMAGE_URL_PATTERN = /^\/assets\/game\/[a-z0-9/_-]+\.(png|jpg|jpeg|webp|svg)$/i;

const catalogSeedEntrySchema = z.object({
  category: z.enum(CHARACTER_CATEGORIES),
  costMana: z.number().int().min(0),
  fullLore: z.string().trim().min(1),
  imageUrl: z
    .string()
    .trim()
    .min(1)
    .regex(IMAGE_URL_PATTERN, 'imageUrl must point to /assets/game/... with a valid image extension.')
    .nullable(),
  isActive: z.boolean(),
  isDefaultUnlocked: z.boolean(),
  name: z.string().trim().min(1),
  rarity: z.enum(CHARACTER_RARITIES),
  releaseOrder: z.number().int().min(0),
  shortDescription: z.string().trim().min(1),
  shortLore: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'slug must contain only lowercase letters, numbers, and hyphens.'),
  unlockPriceShards: z.number().int().min(0),
});

const catalogSeedSchema = z.array(catalogSeedEntrySchema).superRefine((entries, context) => {
  const seenSlugs = new Set<string>();

  for (const [index, entry] of entries.entries()) {
    if (seenSlugs.has(entry.slug)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate slug "${entry.slug}" found in character catalog seed.`,
        path: [index, 'slug'],
      });
      continue;
    }

    seenSlugs.add(entry.slug);
  }
});

export interface CatalogSyncResult {
  defaultOwnershipsEnsured: number;
  deactivated: number;
  hardDeleted: number;
  inserted: number;
  totalSeedEntries: number;
  updated: number;
  warnings: string[];
}

export interface CatalogSyncOptions {
  assetRootDir?: string;
  hardDelete?: boolean;
  logger?: Pick<Console, 'info' | 'warn'>;
  seedEntries?: unknown;
}

interface CatalogSyncServiceOptions {
  seedEntries?: unknown;
  userCharactersRepository?: UserCharactersRepository;
  usersRepository?: UsersRepository;
}

const DEFAULT_CHARACTER_CATALOG_SEED = characterCatalogSeed as UpsertCharacterCatalogInput[];

export class CatalogSyncService {
  private readonly defaultSeedEntries: unknown;
  private readonly userCharactersRepository?: UserCharactersRepository;
  private readonly usersRepository?: UsersRepository;

  constructor(
    private readonly charactersRepository: CharactersRepository,
    options: CatalogSyncServiceOptions = {},
  ) {
    this.defaultSeedEntries = options.seedEntries ?? DEFAULT_CHARACTER_CATALOG_SEED;
    this.userCharactersRepository = options.userCharactersRepository;
    this.usersRepository = options.usersRepository;
  }

  async syncCatalog(options: CatalogSyncOptions = {}): Promise<CatalogSyncResult> {
    const seedEntries = catalogSeedSchema.parse(options.seedEntries ?? this.defaultSeedEntries);
    const warnings = this.collectImageWarnings(seedEntries, options);

    return withTransaction(async (client) => {
      const existingCharacters = await this.charactersRepository.listAll(client, {
        includeInactive: true,
      });
      const existingBySlug = new Map(existingCharacters.map((character) => [character.slug, character]));

      let inserted = 0;
      let updated = 0;

      for (const entry of seedEntries) {
        if (existingBySlug.has(entry.slug)) {
          updated += 1;
        } else {
          inserted += 1;
        }

        await this.charactersRepository.upsertCatalogEntry(entry, client);
      }

      const seedSlugs = seedEntries.map((entry) => entry.slug);
      const hardDeleted = options.hardDelete
        ? await this.charactersRepository.hardDeleteMissingEntries(seedSlugs, client)
        : 0;
      const deactivated = options.hardDelete
        ? 0
        : await this.charactersRepository.markMissingEntriesInactive(seedSlugs, client);
      const defaultOwnershipsEnsured = await this.ensureDefaultUnlockedOwnerships(client);

      options.logger?.info(
        `Catalog sync complete: ${inserted} inserted, ${updated} updated, ${deactivated} deactivated, ${hardDeleted} deleted, ${defaultOwnershipsEnsured} default ownership grants ensured.`,
      );

      for (const warning of warnings) {
        options.logger?.warn(warning);
      }

      return {
        defaultOwnershipsEnsured,
        deactivated,
        hardDeleted,
        inserted,
        totalSeedEntries: seedEntries.length,
        updated,
        warnings,
      };
    });
  }

  async syncCatalogInTransaction(
    client: DatabaseClient,
    options: Omit<CatalogSyncOptions, 'logger'> = {},
  ): Promise<CatalogSyncResult> {
    const seedEntries = catalogSeedSchema.parse(options.seedEntries ?? this.defaultSeedEntries);
    const existingCharacters = await this.charactersRepository.listAll(client, {
      includeInactive: true,
    });
    const existingBySlug = new Map(existingCharacters.map((character) => [character.slug, character]));

    let inserted = 0;
    let updated = 0;

    for (const entry of seedEntries) {
      if (existingBySlug.has(entry.slug)) {
        updated += 1;
      } else {
        inserted += 1;
      }

      await this.charactersRepository.upsertCatalogEntry(entry, client);
    }

    const seedSlugs = seedEntries.map((entry) => entry.slug);
    const hardDeleted = options.hardDelete
      ? await this.charactersRepository.hardDeleteMissingEntries(seedSlugs, client)
      : 0;
    const deactivated = options.hardDelete
      ? 0
      : await this.charactersRepository.markMissingEntriesInactive(seedSlugs, client);
    const defaultOwnershipsEnsured = await this.ensureDefaultUnlockedOwnerships(client);

    return {
      defaultOwnershipsEnsured,
      deactivated,
      hardDeleted,
      inserted,
      totalSeedEntries: seedEntries.length,
      updated,
      warnings: this.collectImageWarnings(seedEntries, options),
    };
  }

  private collectImageWarnings(
    entries: UpsertCharacterCatalogInput[],
    options: Pick<CatalogSyncOptions, 'assetRootDir'>,
  ): string[] {
    const assetRootDir = options.assetRootDir ?? path.resolve(process.cwd());
    const warnings: string[] = [];

    for (const entry of entries) {
      if (!entry.imageUrl) {
        continue;
      }

      const assetPath = path.resolve(assetRootDir, `.${entry.imageUrl}`);

      if (!existsSync(assetPath)) {
        warnings.push(
          `Catalog sync warning: image "${entry.imageUrl}" for slug "${entry.slug}" was not found at ${assetPath}.`,
        );
      }
    }

    return warnings;
  }

  private async ensureDefaultUnlockedOwnerships(client: DatabaseClient): Promise<number> {
    if (!this.usersRepository || !this.userCharactersRepository) {
      return 0;
    }

    const [userIds, defaultCharacters] = await Promise.all([
      this.usersRepository.listIds(client),
      this.charactersRepository.listDefaultUnlocked(client),
    ]);

    if (userIds.length === 0 || defaultCharacters.length === 0) {
      return 0;
    }

    const defaultCharacterIds = defaultCharacters.map((character) => character.id);

    for (const userId of userIds) {
      await this.userCharactersRepository.ensureOwnerships(userId, defaultCharacterIds, client);
    }

    return userIds.length * defaultCharacterIds.length;
  }
}

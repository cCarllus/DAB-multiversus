import type {
  PlayerProgression,
  PlayerProgressionResponse,
} from '../../shared/contracts/progression.contract';
import { withTransaction, type DatabaseClient } from '../lib/postgres';
import { ProgressionRepository } from '../repositories/progression.repository';
import type {
  GrantXpInput,
  ProgressionRecord,
} from '../types/progression.types';
import { NotificationsService } from './notifications.service';

const BASE_XP_PER_LEVEL = 100;
const XP_GROWTH_PER_LEVEL = 25;

function xpRequiredForLevel(level: number): number {
  return BASE_XP_PER_LEVEL + Math.max(0, level - 1) * XP_GROWTH_PER_LEVEL;
}

function resolveLevelState(totalXp: number): {
  level: number;
  xpForNextLevel: number;
  xpIntoCurrentLevel: number;
} {
  let level = 1;
  let remainingXp = totalXp;
  let nextLevelCost = xpRequiredForLevel(level);

  while (remainingXp >= nextLevelCost) {
    remainingXp -= nextLevelCost;
    level += 1;
    nextLevelCost = xpRequiredForLevel(level);
  }

  return {
    level,
    xpForNextLevel: nextLevelCost,
    xpIntoCurrentLevel: remainingXp,
  };
}

export class ProgressionService {
  constructor(
    private readonly progressionRepository: ProgressionRepository,
    private readonly notificationsService?: NotificationsService,
  ) {}

  async getProgression(userId: string): Promise<PlayerProgressionResponse> {
    return withTransaction(async (client) => ({
      progression: this.toPlayerProgression(await this.ensureProgressionRecord(userId, client)),
    }));
  }

  async ensureProgression(userId: string, client: DatabaseClient): Promise<ProgressionRecord> {
    return this.ensureProgressionRecord(userId, client);
  }

  async getCurrentLevel(userId: string): Promise<number> {
    return withTransaction(async (client) => {
      const progression = await this.ensureProgressionRecord(userId, client);
      return progression.level;
    });
  }

  async grantXp(userId: string, input: GrantXpInput): Promise<PlayerProgressionResponse> {
    let leveledUpTo: number | null = null;
    let progressionResponse!: PlayerProgressionResponse;

    await withTransaction(async (client) => {
      const existingProgression = await this.ensureProgressionRecord(userId, client);
      const totalXp = existingProgression.xp + input.amount;
      const nextState = resolveLevelState(totalXp);
      const updatedProgression = await this.progressionRepository.updateProgression(
        userId,
        {
          level: nextState.level,
          xp: totalXp,
        },
        client,
      );

      if (updatedProgression.level > existingProgression.level) {
        leveledUpTo = updatedProgression.level;
      }

      progressionResponse = {
        progression: this.toPlayerProgression(updatedProgression),
      };
    });

    if (leveledUpTo && this.notificationsService) {
      await this.notificationsService.createAndPublish(userId, {
        category: 'progression',
        message: `You reached level ${leveledUpTo}.`,
        metadataJson: {
          level: leveledUpTo,
          source: input.source,
          xpGranted: input.amount,
        },
        title: `Level ${leveledUpTo} unlocked`,
        type: 'success',
      });
    }

    return progressionResponse;
  }

  private async ensureProgressionRecord(
    userId: string,
    client: DatabaseClient,
  ): Promise<ProgressionRecord> {
    const existing = await this.progressionRepository.findByUserId(userId, client, {
      forUpdate: true,
    });

    if (existing) {
      return existing;
    }

    return this.progressionRepository.createDefault(userId, client);
  }

  private toPlayerProgression(record: ProgressionRecord): PlayerProgression {
    const levelState = resolveLevelState(record.xp);

    return {
      level: record.level,
      xp: record.xp,
      xpForNextLevel: levelState.xpForNextLevel,
      xpIntoCurrentLevel: levelState.xpIntoCurrentLevel,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

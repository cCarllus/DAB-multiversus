import type { ProgressionXpSource } from '../../shared/contracts/progression.contract';

export interface ProgressionRecord {
  id: string;
  userId: string;
  level: number;
  xp: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GrantXpInput {
  amount: number;
  source: ProgressionXpSource;
  metadataJson?: Record<string, unknown> | null;
}

export type ProgressionXpSource =
  | 'login_reward'
  | 'match_completed'
  | 'match_won'
  | 'mission_completed'
  | 'social_participation'
  | 'system_reward'
  | 'event_reward';

export interface PlayerProgression {
  level: number;
  xp: number;
  xpForNextLevel: number;
  xpIntoCurrentLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerProgressionResponse {
  progression: PlayerProgression;
}

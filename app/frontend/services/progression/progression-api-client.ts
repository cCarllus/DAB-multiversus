import { BackendApiClient } from '@frontend/services/api/backend-api-client';
import type { PlayerProgressionResponse } from '@shared/contracts/progression.contract';

const PROGRESSION_REQUEST_MESSAGES = {
  failureCode: 'UNKNOWN_PROGRESSION_ERROR',
  failureMessage: 'Progression request failed.',
  networkMessage: 'The launcher could not reach the progression service.',
} as const;

export class ProgressionApiClient extends BackendApiClient {
  async getMyProgression(accessToken: string) {
    const response = await this.request<PlayerProgressionResponse>(
      '/me/progression',
      {
        accessToken,
        method: 'GET',
      },
      PROGRESSION_REQUEST_MESSAGES,
    );

    return response.progression;
  }
}

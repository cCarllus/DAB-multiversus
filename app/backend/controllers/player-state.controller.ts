import type { RequestHandler } from 'express';

import { asyncHandler } from '../lib/async-handler';
import { ProgressionService } from '../services/progression.service';
import { WalletService } from '../services/wallet.service';
import {
  walletTransactionsQuerySchema,
} from '../validators/player-platform.validator';
import { requireAuthUserId } from './controller-auth';

export interface PlayerStateController {
  meProgression: RequestHandler;
  meWallet: RequestHandler;
  meWalletTransactions: RequestHandler;
}

export function createPlayerStateController(
  progressionService: ProgressionService,
  walletService: WalletService,
): PlayerStateController {
  return {
    meProgression: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const result = await progressionService.getProgression(userId);
      response.status(200).json(result);
    }),

    meWallet: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const result = await walletService.getWallet(userId);
      response.status(200).json(result);
    }),

    meWalletTransactions: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const query = walletTransactionsQuerySchema.parse(request.query);
      const result = await walletService.getTransactions(userId, query.limit);
      response.status(200).json(result);
    }),
  };
}

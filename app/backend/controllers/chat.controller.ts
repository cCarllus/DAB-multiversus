import type { RequestHandler } from 'express';

import { asyncHandler } from '../lib/async-handler';
import { ChatService } from '../services/chat.service';
import { chatHistoryQuerySchema } from '../validators/player-platform.validator';

export interface ChatController {
  globalHistory: RequestHandler;
}

export function createChatController(chatService: ChatService): ChatController {
  return {
    globalHistory: asyncHandler(async (request, response) => {
      const query = chatHistoryQuerySchema.parse(request.query);
      const result = await chatService.getGlobalHistory(query.limit);
      response.status(200).json(result);
    }),
  };
}

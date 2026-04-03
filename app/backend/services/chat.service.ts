import type {
  GlobalChatHistoryResponse,
  GlobalChatMessage,
  GlobalChatSender,
} from '../../shared/contracts/chat.contract';
import { GLOBAL_CHAT_CHANNEL } from '../../shared/contracts/chat.contract';
import { AppError } from '../lib/app-error';
import { ChatRepository } from '../repositories/chat.repository';
import { ProgressionRepository } from '../repositories/progression.repository';
import type { ChatMessageRecord } from '../types/chat.types';
import { UsersService } from './users.service';

const DEFAULT_CHAT_HISTORY_LIMIT = 40;
const MAX_CHAT_MESSAGE_LENGTH = 320;

export class ChatService {
  constructor(
    private readonly chatRepository: ChatRepository,
    private readonly progressionRepository: ProgressionRepository,
    private readonly usersService: UsersService,
  ) {}

  async getGlobalHistory(limit = DEFAULT_CHAT_HISTORY_LIMIT): Promise<GlobalChatHistoryResponse> {
    const normalizedLimit = Math.max(1, Math.min(limit, 100));
    const records = await this.chatRepository.listRecentMessages(GLOBAL_CHAT_CHANNEL, normalizedLimit);

    return {
      channel: GLOBAL_CHAT_CHANNEL,
      messages: records.reverse().map((record) => this.toGlobalChatMessage(record)),
    };
  }

  async createGlobalMessage(userId: string, content: string): Promise<GlobalChatMessage> {
    const normalizedContent = content.trim();

    if (!normalizedContent) {
      throw new AppError(400, 'CHAT_MESSAGE_EMPTY', 'Chat messages cannot be empty.');
    }

    if (normalizedContent.length > MAX_CHAT_MESSAGE_LENGTH) {
      throw new AppError(
        400,
        'CHAT_MESSAGE_TOO_LONG',
        `Chat messages cannot exceed ${MAX_CHAT_MESSAGE_LENGTH} characters.`,
      );
    }

    const [user, progression] = await Promise.all([
      this.usersService.requireUserById(userId),
      this.progressionRepository.findByUserId(userId),
    ]);
    const record = await this.chatRepository.createMessage({
      avatarUrlSnapshot: user.profileImageUrl,
      channel: GLOBAL_CHAT_CHANNEL,
      content: normalizedContent,
      levelSnapshot: progression?.level ?? 1,
      nameSnapshot: user.name,
      nicknameSnapshot: user.nickname,
      userId,
    });

    return this.toGlobalChatMessage(record);
  }

  private toGlobalChatMessage(record: ChatMessageRecord): GlobalChatMessage {
    const sender: GlobalChatSender = {
      avatarUrl: record.avatarUrlSnapshot,
      level: record.levelSnapshot,
      name: record.nameSnapshot,
      nickname: record.nicknameSnapshot,
      userId: record.userId,
    };

    return {
      id: record.id,
      channel: record.channel,
      content: record.content,
      createdAt: record.createdAt.toISOString(),
      sender,
    };
  }
}

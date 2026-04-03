import type {
  NotificationUnreadCountResponse,
  NotificationsResponse,
  PlayerNotification,
} from '../../shared/contracts/notifications.contract';
import { AppError } from '../lib/app-error';
import { NotificationsRepository } from '../repositories/notifications.repository';
import type {
  CreateNotificationInput,
  NotificationRecord,
} from '../types/notifications.types';
import { NotificationsRealtimeGateway } from './notifications-realtime.gateway';

export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly realtimeGateway: NotificationsRealtimeGateway,
  ) {}

  async listNotifications(userId: string, limit: number): Promise<NotificationsResponse> {
    const [notifications, total] = await Promise.all([
      this.notificationsRepository.listForUser(userId, limit),
      this.notificationsRepository.countForUser(userId),
    ]);

    return {
      notifications: notifications.map((notification) => this.toPlayerNotification(notification)),
      total,
    };
  }

  async getUnreadCount(userId: string): Promise<NotificationUnreadCountResponse> {
    return {
      unreadCount: await this.notificationsRepository.countUnread(userId),
    };
  }

  async createNotification(
    userId: string,
    input: CreateNotificationInput,
    client?: Parameters<NotificationsRepository['create']>[2],
  ): Promise<PlayerNotification> {
    const notification = await this.notificationsRepository.create(userId, input, client);
    return this.toPlayerNotification(notification);
  }

  async createAndPublish(userId: string, input: CreateNotificationInput): Promise<PlayerNotification> {
    const notification = await this.createNotification(userId, input);
    const unreadCount = await this.notificationsRepository.countUnread(userId);

    this.realtimeGateway.publishDelivered(userId, {
      notification,
      unreadCount,
    });

    return notification;
  }

  async markRead(userId: string, notificationId: string): Promise<PlayerNotification> {
    const notification = await this.notificationsRepository.markRead(userId, notificationId);

    if (!notification) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification could not be found.');
    }

    await this.publishState(userId);

    return this.toPlayerNotification(notification);
  }

  async markAllRead(userId: string): Promise<NotificationUnreadCountResponse> {
    await this.notificationsRepository.markAllRead(userId);
    return this.publishState(userId);
  }

  private async publishState(userId: string): Promise<NotificationUnreadCountResponse> {
    const unreadCount = await this.notificationsRepository.countUnread(userId);
    this.realtimeGateway.publishState(userId, {
      unreadCount,
    });

    return {
      unreadCount,
    };
  }

  private toPlayerNotification(record: NotificationRecord): PlayerNotification {
    return {
      id: record.id,
      type: record.type,
      category: record.category,
      title: record.title,
      message: record.message,
      metadataJson: record.metadataJson,
      isRead: record.isRead,
      createdAt: record.createdAt.toISOString(),
      readAt: record.readAt?.toISOString() ?? null,
    };
  }
}

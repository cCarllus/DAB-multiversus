import type {
  NotificationCategory,
  NotificationType,
} from '../../shared/contracts/notifications.contract';

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  metadataJson: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: Date;
  readAt: Date | null;
}

export interface CreateNotificationInput {
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  metadataJson?: Record<string, unknown> | null;
}

export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'social'
  | 'reward'
  | 'system';

export type NotificationCategory =
  | 'social'
  | 'progression'
  | 'economy'
  | 'launcher'
  | 'account'
  | 'system'
  | 'event';

export interface PlayerNotification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  metadataJson: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationsResponse {
  notifications: PlayerNotification[];
  total: number;
}

export interface NotificationUnreadCountResponse {
  unreadCount: number;
}

export const PLAYER_NOTIFICATIONS_ROOM_NAME = 'player_notifications';
export const PLAYER_NOTIFICATIONS_DELIVERED_MESSAGE = 'notifications:delivered';
export const PLAYER_NOTIFICATIONS_STATE_MESSAGE = 'notifications:state';

export interface NotificationDeliveredPayload {
  notification: PlayerNotification;
  unreadCount: number;
}

export interface NotificationStatePayload {
  unreadCount: number;
}

import type {
  PlayerNotification,
} from '@shared/contracts/notifications.contract';

export type { PlayerNotification };

export interface NotificationsSnapshot {
  isConnected: boolean;
  isLoading: boolean;
  isOpen: boolean;
  notifications: PlayerNotification[];
  unreadCount: number;
}

export type NotificationsStoreEvent =
  | {
      notification: PlayerNotification;
      type: 'received';
    }
  | {
      message: string;
      type: 'error';
    };

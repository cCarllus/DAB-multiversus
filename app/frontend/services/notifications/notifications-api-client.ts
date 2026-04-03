import { BackendApiClient } from '@frontend/services/api/backend-api-client';
import type {
  NotificationUnreadCountResponse,
  NotificationsResponse,
  PlayerNotification,
} from '@shared/contracts/notifications.contract';

const NOTIFICATIONS_REQUEST_MESSAGES = {
  failureCode: 'UNKNOWN_NOTIFICATIONS_ERROR',
  failureMessage: 'Notifications request failed.',
  networkMessage: 'The launcher could not reach the notifications service.',
} as const;

export class NotificationsApiClient extends BackendApiClient {
  async getNotifications(accessToken: string, limit = 40): Promise<NotificationsResponse> {
    const search = new URLSearchParams({
      limit: String(limit),
    });

    return this.request<NotificationsResponse>(
      `/me/notifications?${search.toString()}`,
      {
        accessToken,
        method: 'GET',
      },
      NOTIFICATIONS_REQUEST_MESSAGES,
    );
  }

  async markNotificationRead(accessToken: string, notificationId: string): Promise<PlayerNotification> {
    const response = await this.request<{ notification: PlayerNotification }>(
      `/me/notifications/${encodeURIComponent(notificationId)}/read`,
      {
        accessToken,
        method: 'PATCH',
      },
      NOTIFICATIONS_REQUEST_MESSAGES,
    );

    return response.notification;
  }

  async markAllRead(accessToken: string): Promise<NotificationUnreadCountResponse> {
    return this.request<NotificationUnreadCountResponse>(
      '/me/notifications/read-all',
      {
        accessToken,
        method: 'PATCH',
      },
      NOTIFICATIONS_REQUEST_MESSAGES,
    );
  }

  async getUnreadCount(accessToken: string): Promise<NotificationUnreadCountResponse> {
    return this.request<NotificationUnreadCountResponse>(
      '/me/notifications/unread-count',
      {
        accessToken,
        method: 'GET',
      },
      NOTIFICATIONS_REQUEST_MESSAGES,
    );
  }
}

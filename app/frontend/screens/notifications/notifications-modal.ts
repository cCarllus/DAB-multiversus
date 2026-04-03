import { createSvgIcon } from '@frontend/lib/svg-icon';
import type { PlayerNotification } from '@frontend/services/notifications/notifications-types';
import type { NotificationsStore } from '@frontend/stores/notifications.store';
import type { AppI18n } from '@shared/i18n';

import './notifications-modal.css';

interface CreateNotificationsModalOptions {
  i18n: AppI18n;
  notificationsStore: NotificationsStore;
}

function formatNotificationTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function resolveNotificationIcon(notification: PlayerNotification): string {
  if (notification.type === 'reward' || notification.category === 'economy') {
    return 'icon-hexagon';
  }

  if (notification.type === 'social' || notification.category === 'social') {
    return 'icon-users';
  }

  if (
    notification.type === 'warning' ||
    notification.type === 'error' ||
    notification.category === 'system'
  ) {
    return 'icon-shield';
  }

  return 'icon-bell';
}

export function createNotificationsModal(options: CreateNotificationsModalOptions): HTMLElement {
  const rootElement = document.createElement('aside');
  rootElement.className = 'notifications-modal';
  rootElement.setAttribute('aria-hidden', 'true');

  const card = document.createElement('div');
  card.className = 'notifications-modal__card';

  const header = document.createElement('header');
  header.className = 'notifications-modal__header';

  const headerCopy = document.createElement('div');
  headerCopy.className = 'notifications-modal__copy';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'notifications-modal__eyebrow';
  eyebrow.textContent = options.i18n.t('menu.notifications.eyebrow');

  const title = document.createElement('h2');
  title.className = 'notifications-modal__title';
  title.textContent = options.i18n.t('menu.notifications.title');

  const summary = document.createElement('p');
  summary.className = 'notifications-modal__summary';

  headerCopy.append(eyebrow, title, summary);

  const headerActions = document.createElement('div');
  headerActions.className = 'notifications-modal__actions';

  const markAllReadButton = document.createElement('button');
  markAllReadButton.type = 'button';
  markAllReadButton.className = 'notifications-modal__action';
  markAllReadButton.textContent = options.i18n.t('menu.notifications.markAllRead');
  markAllReadButton.addEventListener('click', () => {
    void options.notificationsStore.markAllRead().catch(() => undefined);
  });

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'notifications-modal__action notifications-modal__action--ghost';
  closeButton.textContent = options.i18n.t('menu.notifications.close');
  closeButton.addEventListener('click', () => {
    options.notificationsStore.closePanel();
  });

  headerActions.append(markAllReadButton, closeButton);
  header.append(headerCopy, headerActions);

  const list = document.createElement('div');
  list.className = 'notifications-modal__list';

  const render = (): void => {
    const snapshot = options.notificationsStore.getSnapshot();
    const locale = options.i18n.getLocale();
    rootElement.classList.toggle('is-open', snapshot.isOpen);
    rootElement.setAttribute('aria-hidden', snapshot.isOpen ? 'false' : 'true');
    summary.textContent = options.i18n.t('menu.notifications.summary', {
      count: String(snapshot.unreadCount),
    });
    markAllReadButton.disabled = snapshot.unreadCount === 0;

    if (snapshot.isLoading && snapshot.notifications.length === 0) {
      const loading = document.createElement('div');
      loading.className = 'notifications-modal__empty';
      loading.textContent = options.i18n.t('menu.notifications.loading');
      list.replaceChildren(loading);
      return;
    }

    if (snapshot.notifications.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'notifications-modal__empty';
      empty.textContent = options.i18n.t('menu.notifications.empty');
      list.replaceChildren(empty);
      return;
    }

    list.replaceChildren(
      ...snapshot.notifications.map((notification) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'notifications-modal__item';
        item.dataset.read = String(notification.isRead);
        item.addEventListener('click', () => {
          if (!notification.isRead) {
            void options.notificationsStore.markRead(notification.id).catch(() => undefined);
          }
        });

        const iconWrap = document.createElement('span');
        iconWrap.className = 'notifications-modal__item-icon';
        iconWrap.dataset.type = notification.type;
        iconWrap.append(
          createSvgIcon(resolveNotificationIcon(notification), {
            className: 'home-icon home-icon--small',
          }),
        );

        const body = document.createElement('span');
        body.className = 'notifications-modal__item-body';

        const topLine = document.createElement('span');
        topLine.className = 'notifications-modal__item-topline';

        const itemTitle = document.createElement('strong');
        itemTitle.className = 'notifications-modal__item-title';
        itemTitle.textContent = notification.title;

        const timestamp = document.createElement('span');
        timestamp.className = 'notifications-modal__item-time';
        timestamp.textContent = formatNotificationTime(notification.createdAt, locale);

        topLine.append(itemTitle, timestamp);

        const message = document.createElement('span');
        message.className = 'notifications-modal__item-message';
        message.textContent = notification.message;

        body.append(topLine, message);
        item.append(iconWrap, body);
        return item;
      }),
    );
  };

  const unsubscribe = options.notificationsStore.subscribe(() => {
    if (!rootElement.isConnected) {
      unsubscribe();
      return;
    }

    render();
  });

  rootElement.addEventListener('click', (event) => {
    if (event.target === rootElement) {
      options.notificationsStore.closePanel();
    }
  });

  card.append(header, list);
  rootElement.append(card);
  render();

  return rootElement;
}

import { createElementFromTemplate } from '@frontend/lib/html';
import type {
  SocialFriendRequestsResponse,
  SocialUserSummary,
} from '@frontend/services/social/social-types';
import type { AppI18n } from '@shared/i18n';

import {
  createSocialAvatar,
  formatShortDate,
} from './social-formatters';

interface SocialRequestsPanelOptions {
  i18n: AppI18n;
  onAccept: (requestId: string) => void;
  onCancel: (requestId: string) => void;
  onHoverLeave: () => void;
  onHoverUser: (user: SocialUserSummary, anchor: HTMLElement) => void;
  onReject: (requestId: string) => void;
  onSelectUser: (nickname: string) => void;
}

interface SocialRequestsPanelState {
  incoming: SocialFriendRequestsResponse;
  isBusy: boolean;
  outgoing: SocialFriendRequestsResponse;
  selectedNickname: string | null;
}

const template = `
  <section class="social-panel social-panel--requests">
    <header class="social-panel__header">
      <div>
        <p class="social-panel__eyebrow"></p>
        <h2 class="social-panel__title"></h2>
      </div>
    </header>

    <div class="social-request-group">
      <div class="social-request-group__heading">
        <span></span>
        <strong data-requests-incoming-count></strong>
      </div>
      <div class="social-request-group__list" data-requests-incoming></div>
      <p class="social-panel__empty" data-requests-incoming-empty hidden></p>
    </div>

    <div class="social-request-group">
      <div class="social-request-group__heading">
        <span></span>
        <strong data-requests-outgoing-count></strong>
      </div>
      <div class="social-request-group__list" data-requests-outgoing></div>
      <p class="social-panel__empty" data-requests-outgoing-empty hidden></p>
    </div>
  </section>
`;

export function createSocialRequestsPanel(options: SocialRequestsPanelOptions) {
  const element = createElementFromTemplate(template);
  const eyebrow = element.querySelector<HTMLElement>('.social-panel__eyebrow');
  const title = element.querySelector<HTMLElement>('.social-panel__title');
  const incomingHeading = element.querySelector<HTMLElement>('[data-requests-incoming-count]');
  const outgoingHeading = element.querySelector<HTMLElement>('[data-requests-outgoing-count]');
  const incomingList = element.querySelector<HTMLElement>('[data-requests-incoming]');
  const outgoingList = element.querySelector<HTMLElement>('[data-requests-outgoing]');
  const incomingEmpty = element.querySelector<HTMLElement>('[data-requests-incoming-empty]');
  const outgoingEmpty = element.querySelector<HTMLElement>('[data-requests-outgoing-empty]');

  if (
    !eyebrow ||
    !title ||
    !incomingHeading ||
    !outgoingHeading ||
    !incomingList ||
    !outgoingList ||
    !incomingEmpty ||
    !outgoingEmpty
  ) {
    throw new Error('Social requests panel could not be initialized.');
  }

  eyebrow.textContent = options.i18n.t('menu.social.requests.eyebrow');
  title.textContent = options.i18n.t('menu.social.requests.title');
  element.querySelectorAll<HTMLElement>('.social-request-group__heading span')[0]!.textContent =
    options.i18n.t('menu.social.requests.incoming');
  element.querySelectorAll<HTMLElement>('.social-request-group__heading span')[1]!.textContent =
    options.i18n.t('menu.social.requests.outgoing');

  const renderRequestItem = (
    user: SocialUserSummary,
    requestId: string,
    createdAt: string,
    mode: 'incoming' | 'outgoing',
    state: SocialRequestsPanelState,
  ): HTMLElement => {
    const locale = options.i18n.getLocale();
    const item = document.createElement('div');
    item.className = 'social-request';
    item.dataset.selected = String(state.selectedNickname === user.nickname);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'social-request__trigger';
    trigger.disabled = state.isBusy;
    trigger.addEventListener('click', () => {
      options.onSelectUser(user.nickname);
    });
    trigger.addEventListener('mouseenter', () => {
      options.onHoverUser(user, trigger);
    });
    trigger.addEventListener('mouseleave', () => {
      options.onHoverLeave();
    });

    const avatar = document.createElement('img');
    avatar.className = 'social-request__avatar';
    avatar.src = createSocialAvatar(user);
    avatar.alt = user.nickname;

    const copy = document.createElement('span');
    copy.className = 'social-request__copy';
    const name = document.createElement('strong');
    name.textContent = user.name;
    const meta = document.createElement('span');
    meta.textContent = `@${user.nickname} · ${formatShortDate(createdAt, locale)}`;
    copy.append(name, meta);
    trigger.append(avatar, copy);

    const actions = document.createElement('div');
    actions.className = 'social-request__actions';

    if (mode === 'incoming') {
      const acceptButton = document.createElement('button');
      acceptButton.type = 'button';
      acceptButton.className = 'social-request__button';
      acceptButton.dataset.variant = 'accept';
      acceptButton.disabled = state.isBusy;
      acceptButton.textContent = options.i18n.t('menu.social.actions.accept');
      acceptButton.addEventListener('click', () => {
        options.onAccept(requestId);
      });

      const rejectButton = document.createElement('button');
      rejectButton.type = 'button';
      rejectButton.className = 'social-request__button';
      rejectButton.dataset.variant = 'reject';
      rejectButton.disabled = state.isBusy;
      rejectButton.textContent = options.i18n.t('menu.social.actions.reject');
      rejectButton.addEventListener('click', () => {
        options.onReject(requestId);
      });

      actions.append(acceptButton, rejectButton);
    } else {
      const pendingLabel = document.createElement('span');
      pendingLabel.className = 'social-request__pending';
      pendingLabel.textContent = options.i18n.t('menu.social.actions.requestSent');

      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'social-request__button';
      cancelButton.dataset.variant = 'reject';
      cancelButton.disabled = state.isBusy;
      cancelButton.textContent = options.i18n.t('menu.social.actions.cancel');
      cancelButton.addEventListener('click', () => {
        options.onCancel(requestId);
      });

      actions.append(pendingLabel, cancelButton);
    }

    item.append(trigger, actions);
    return item;
  };

  return {
    element,
    setState(state: SocialRequestsPanelState) {
      incomingHeading.textContent = String(state.incoming.total);
      outgoingHeading.textContent = String(state.outgoing.total);

      incomingList.replaceChildren(
        ...state.incoming.requests.map((request) =>
          renderRequestItem(request.user, request.id, request.createdAt, 'incoming', state),
        ),
      );
      outgoingList.replaceChildren(
        ...state.outgoing.requests.map((request) =>
          renderRequestItem(request.user, request.id, request.createdAt, 'outgoing', state),
        ),
      );

      incomingEmpty.hidden = state.incoming.total > 0;
      outgoingEmpty.hidden = state.outgoing.total > 0;
      incomingEmpty.textContent = state.isBusy
        ? options.i18n.t('menu.social.requests.loading')
        : options.i18n.t('menu.social.requests.emptyIncoming');
      outgoingEmpty.textContent = state.isBusy
        ? options.i18n.t('menu.social.requests.loading')
        : options.i18n.t('menu.social.requests.emptyOutgoing');
    },
  };
}

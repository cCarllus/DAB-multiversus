import { createElementFromTemplate } from '@frontend/lib/html';
import type { SocialFriendsResponse, SocialUserSummary } from '@frontend/services/social/social-types';
import type { AppI18n } from '@shared/i18n';

import {
  createSocialAvatar,
  resolvePresenceTone,
} from './social-formatters';

interface SocialFriendsPanelOptions {
  i18n: AppI18n;
  onHoverLeave: () => void;
  onHoverUser: (user: SocialUserSummary, anchor: HTMLElement) => void;
  onSelectUser: (nickname: string) => void;
}

interface SocialFriendsPanelState {
  friends: SocialFriendsResponse;
  isBusy: boolean;
  selectedNickname: string | null;
}

const template = `
  <section class="social-panel social-panel--friends">
    <header class="social-panel__header">
      <div>
        <p class="social-panel__eyebrow"></p>
        <h2 class="social-panel__title"></h2>
      </div>
      <span class="social-panel__count" data-friends-count></span>
    </header>
    <div class="social-panel__list" data-friends-list></div>
    <p class="social-panel__empty" data-friends-empty hidden></p>
  </section>
`;

export function createSocialFriendsPanel(options: SocialFriendsPanelOptions) {
  const element = createElementFromTemplate(template);
  const eyebrow = element.querySelector<HTMLElement>('.social-panel__eyebrow');
  const title = element.querySelector<HTMLElement>('.social-panel__title');
  const count = element.querySelector<HTMLElement>('[data-friends-count]');
  const list = element.querySelector<HTMLElement>('[data-friends-list]');
  const empty = element.querySelector<HTMLElement>('[data-friends-empty]');

  if (!eyebrow || !title || !count || !list || !empty) {
    throw new Error('Social friends panel could not be initialized.');
  }

  eyebrow.textContent = options.i18n.t('menu.social.friends.eyebrow');
  title.textContent = options.i18n.t('menu.social.friends.title');

  return {
    element,
    setState(state: SocialFriendsPanelState) {
      count.textContent = String(state.friends.total);

      const items = state.friends.friends.map((friend) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'social-friend';
        item.dataset.selected = String(state.selectedNickname === friend.nickname);
        item.disabled = state.isBusy;
        item.addEventListener('click', () => {
          options.onSelectUser(friend.nickname);
        });
        item.addEventListener('mouseenter', () => {
          options.onHoverUser(friend, item);
        });
        item.addEventListener('mouseleave', () => {
          options.onHoverLeave();
        });

        const avatarWrap = document.createElement('span');
        avatarWrap.className = 'social-friend__avatar-wrap';
        const avatar = document.createElement('img');
        avatar.className = 'social-friend__avatar';
        avatar.src = createSocialAvatar(friend);
        avatar.alt = friend.nickname;
        const dot = document.createElement('span');
        dot.className = `social-friend__dot ${resolvePresenceTone(friend.presence.status)}`;
        avatarWrap.append(avatar, dot);

        const copy = document.createElement('span');
        copy.className = 'social-friend__copy';
        const name = document.createElement('strong');
        name.textContent = friend.name;
        const nickname = document.createElement('span');
        nickname.textContent = `@${friend.nickname}`;
        copy.append(name, nickname);

        item.append(avatarWrap, copy);
        return item;
      });

      list.replaceChildren(...items);
      empty.hidden = state.friends.total > 0;
      empty.textContent = state.isBusy
        ? options.i18n.t('menu.social.friends.loading')
        : options.i18n.t('menu.social.friends.empty');
    },
  };
}

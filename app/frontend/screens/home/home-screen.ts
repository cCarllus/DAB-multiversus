import {
  resolveAuthDisplayName,
  type AuthUser,
} from '@frontend/services/auth/auth-types';
import { createElementFromTemplate } from '@frontend/lib/html';
import {
  createSocialAvatar,
  resolveActivityLabel,
} from '@frontend/screens/social/social-formatters';
import type { SocialStore } from '@frontend/stores/social.store';
import type { AppI18n } from '@shared/i18n';

import homeTemplate from './home-screen.html?raw';
import './home-screen.css';

interface HomeScreenOptions {
  i18n: AppI18n;
  socialStore: SocialStore;
  user: AuthUser;
}

function createAvatarFallbackDataUrl(user: AuthUser): string {
  const label = resolveAuthDisplayName(user).trim();
  const monogram = (label[0] ?? user.nickname[0] ?? user.email[0] ?? '?').toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#213243" />
          <stop offset="100%" stop-color="#0b1218" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="14" fill="url(#bg)" />
      <circle cx="48" cy="48" r="30" fill="rgba(212,175,55,0.14)" />
      <text x="50%" y="55%" text-anchor="middle" fill="#f3ead7" font-size="40" font-family="Georgia, serif">${monogram}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createHomeEmptyState(label: string): HTMLElement {
  return createElementFromTemplate('<div class="home-friends-card__empty">__TEXT__</div>', {
    TEXT: label,
  });
}

export function createHomeScreen(options: HomeScreenOptions): HTMLElement {
  const messages = options.i18n.getMessages();
  const avatarUrl = options.user.profileImageUrl || createAvatarFallbackDataUrl(options.user);
  const rootElement = createElementFromTemplate(homeTemplate, {
    ADD_FRIEND_ARIA_LABEL: messages.menu.home.addFriendAriaLabel,
    APP_TITLE: messages.product.title,
    FEATURED_FIGHTER_LABEL: messages.menu.home.featuredFighter,
    FEATURED_LOADOUT_ARIA_LABEL: messages.menu.home.featuredLoadoutAriaLabel,
    FRIENDS_TITLE: messages.menu.home.friendsTitle,
    HOME_FRIENDS_LOADING: messages.menu.home.friendsLoading,
    HERO_NAME: messages.product.heroName,
    HERO_TITLE: messages.product.heroTitle,
    HOME_HEADLINE: messages.product.homeHeadline,
    HOME_SUMMARY: messages.product.homeSummary,
    LIVE_POPULAR_MATCH: messages.menu.home.livePopularMatch,
    MATCH_DETAILS_LABEL: messages.menu.home.matchDetails,
    PLAYER_ALIAS: resolveAuthDisplayName(options.user),
    PLAYER_AVATAR_URL: avatarUrl,
    PLAYER_STATUS: options.i18n.t('menu.social.presence.inLauncher'),
    PLAYER_STATUS_CLASS: 'home-profile-card__status--launcher',
    PRO_CIRCUIT_LABEL: messages.menu.home.proCircuit,
    SEASON_NAME: messages.product.seasonName,
    SEASON_OBJECTIVE_LABEL: messages.menu.home.seasonObjective,
    SEASON_OBJECTIVE_PROGRESS_LABEL: messages.menu.home.seasonObjectiveProgressLabel,
  });
  const friendsList = rootElement.querySelector<HTMLElement>('[data-home-friends-list]');

  if (!friendsList) {
    throw new Error('Home screen social widgets could not be initialized.');
  }

  const renderHomeSocial = (): void => {
    const snapshot = options.socialStore.getSnapshot();

    if (!snapshot) {
      friendsList.replaceChildren(createHomeEmptyState(messages.menu.home.friendsLoading));
      return;
    }
    const featuredFriends = [...snapshot.friends.friends]
      .sort((left, right) => {
        const leftOffline = left.presence.status === 'offline' ? 1 : 0;
        const rightOffline = right.presence.status === 'offline' ? 1 : 0;

        if (leftOffline !== rightOffline) {
          return leftOffline - rightOffline;
        }

        return left.nickname.localeCompare(right.nickname);
      })
      .slice(0, 6);

    if (featuredFriends.length === 0) {
      friendsList.replaceChildren(createHomeEmptyState(messages.menu.home.friendsEmpty));
    } else {
      friendsList.replaceChildren(
        ...featuredFriends.map((friend) => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className =
            friend.presence.status === 'offline'
                ? 'home-friend home-friend--offline'
                : friend.presence.status === 'in_launcher'
                  ? 'home-friend home-friend--online'
                  : 'home-friend home-friend--active';
          item.dataset.action = 'show-players-page';

          const avatarWrap = document.createElement('div');
          avatarWrap.className = 'home-friend__avatar-wrap';
          const avatar = document.createElement('img');
          avatar.className = 'home-friend__avatar';
          avatar.src = createSocialAvatar(friend);
          avatar.alt = friend.nickname;
          avatarWrap.append(avatar);

          const copy = document.createElement('span');
          copy.className = 'home-friend__copy';
          const name = document.createElement('span');
          name.className = 'home-friend__name';
          name.textContent = friend.name || friend.nickname;
          const statusText = document.createElement('span');
          statusText.className = 'home-friend__status-text';
          if (friend.presence.status === 'in_launcher') {
            statusText.classList.add('home-friend__status-text--blue');
          }
          if (friend.presence.status === 'offline') {
            statusText.classList.add('home-friend__status-text--muted');
          }

          const presence = document.createElement('span');
          presence.className = 'home-friend__presence';
          presence.textContent = resolveActivityLabel(friend, options.i18n);
          statusText.append(presence);
          copy.append(name, statusText);
          item.append(avatarWrap, copy);

          if (friend.presence.status !== 'offline') {
            const invite = document.createElement('span');
            invite.className = 'home-friend__invite';
            invite.innerHTML =
              '<svg class="home-icon home-icon--small"><use href="#icon-plus"></use></svg>';
            item.append(invite);
          }

          return item;
        }),
      );
    }
  };

  renderHomeSocial();

  const unsubscribe = options.socialStore.subscribe(() => {
    if (!rootElement.isConnected) {
      unsubscribe();
      return;
    }

    renderHomeSocial();
  });

  void options.socialStore
    .load(!options.socialStore.getSnapshot())
    .then(() => {
      renderHomeSocial();
    })
    .catch(() => {
      friendsList.replaceChildren(createHomeEmptyState(messages.menu.home.friendsUnavailable));
    });

  return rootElement;
}

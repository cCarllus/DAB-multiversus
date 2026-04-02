import {
  resolveAuthDisplayName,
  type AuthUser,
} from '@frontend/services/auth/auth-types';
import { createElementFromTemplate } from '@frontend/lib/html';
import type { AppI18n } from '@shared/i18n';

import homeTemplate from './home-screen.html?raw';
import './home-screen.css';

interface HomeScreenOptions {
  i18n: AppI18n;
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

export function createHomeScreen(options: HomeScreenOptions): HTMLElement {
  const messages = options.i18n.getMessages();
  const avatarUrl = options.user.profileImageUrl || createAvatarFallbackDataUrl(options.user);

  return createElementFromTemplate(homeTemplate, {
    ADD_FRIEND_ARIA_LABEL: messages.menu.home.addFriendAriaLabel,
    APP_TITLE: messages.product.title,
    FEATURED_FIGHTER_LABEL: messages.menu.home.featuredFighter,
    FEATURED_LOADOUT_ARIA_LABEL: messages.menu.home.featuredLoadoutAriaLabel,
    FRIENDS_FILTER: messages.menu.home.friendsFilter,
    FRIENDS_TITLE: messages.menu.home.friendsTitle,
    FRIEND_STATUS_MAIN_MENU: messages.menu.home.friendStatuses.mainMenu,
    FRIEND_STATUS_OFFLINE: messages.menu.home.friendStatuses.offline,
    FRIEND_STATUS_PLAYING_RANKED: messages.menu.home.friendStatuses.playingRanked,
    HERO_NAME: messages.product.heroName,
    HERO_TITLE: messages.product.heroTitle,
    HOME_HEADLINE: messages.product.homeHeadline,
    HOME_SUMMARY: messages.product.homeSummary,
    LIVE_POPULAR_MATCH: messages.menu.home.livePopularMatch,
    MATCH_DETAILS_LABEL: messages.menu.home.matchDetails,
    PLAYER_ALIAS: resolveAuthDisplayName(options.user),
    PLAYER_AVATAR_URL: avatarUrl,
    PLAYER_STATUS: messages.menu.home.playerPresence.online,
    PLAYER_STATUS_CLASS: 'home-profile-card__status--online',
    PRO_CIRCUIT_LABEL: messages.menu.home.proCircuit,
    SEASON_NAME: messages.product.seasonName,
    SEASON_OBJECTIVE_LABEL: messages.menu.home.seasonObjective,
    SEASON_OBJECTIVE_PROGRESS_LABEL: messages.menu.home.seasonObjectiveProgressLabel,
  });
}

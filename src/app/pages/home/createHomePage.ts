import { resolveAuthDisplayName, type AuthUser } from '@app/auth/auth-types';
import { createElementFromTemplate } from '@app/utils/html';
import type { AppI18n } from '@shared/i18n';

import homeTemplate from './home.html?raw';

interface HomePageOptions {
  i18n: AppI18n;
  user: AuthUser;
}

export function createHomePage(options: HomePageOptions): HTMLElement {
  const messages = options.i18n.getMessages();

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
    PLAYER_STATUS: options.user.email,
    PRO_CIRCUIT_LABEL: messages.menu.home.proCircuit,
    SEASON_NAME: messages.product.seasonName,
    SEASON_OBJECTIVE_LABEL: messages.menu.home.seasonObjective,
    SEASON_OBJECTIVE_PROGRESS_LABEL: messages.menu.home.seasonObjectiveProgressLabel,
  });
}

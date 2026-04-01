import { PRODUCT_CONFIG } from '@shared/config/productConfig';
import { resolveAuthDisplayName, type AuthUser } from '@app/auth/auth-types';
import { createElementFromTemplate } from '@app/utils/html';

import homeTemplate from './home.html?raw';

interface HomePageOptions {
  user: AuthUser;
}

export function createHomePage(options: HomePageOptions): HTMLElement {
  return createElementFromTemplate(homeTemplate, {
    APP_TITLE: PRODUCT_CONFIG.title,
    HERO_NAME: PRODUCT_CONFIG.heroName,
    HERO_TITLE: PRODUCT_CONFIG.heroTitle,
    HOME_HEADLINE: PRODUCT_CONFIG.homeHeadline,
    HOME_SUMMARY: PRODUCT_CONFIG.homeSummary,
    PLAYER_ALIAS: resolveAuthDisplayName(options.user),
    PLAYER_STATUS: options.user.email,
    SEASON_NAME: PRODUCT_CONFIG.seasonName,
  });
}

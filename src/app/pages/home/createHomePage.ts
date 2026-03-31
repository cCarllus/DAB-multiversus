import type { DesktopBridge } from '@shared/types/desktop';
import { PRODUCT_CONFIG } from '@shared/config/productConfig';
import { createElementFromTemplate } from '@app/utils/html';

import homeTemplate from './home.html?raw';
import './home.css';

interface HomePageOptions {
  appVersion: string;
  musicMuted: boolean;
  desktop: DesktopBridge;
}

export function createHomePage(options: HomePageOptions): HTMLElement {
  return createElementFromTemplate(homeTemplate, {
    MUSIC_BUTTON_STATE_CLASS: options.musicMuted
      ? 'home-voice-button--muted'
      : 'home-voice-button--live',
    MUSIC_ICON_ID: options.musicMuted ? 'icon-mic-off' : 'icon-mic',
    MUSIC_STATE_LABEL: options.musicMuted ? 'Ativar a musica do launcher' : 'Mutar a musica do launcher',
    APP_SUBTITLE: PRODUCT_CONFIG.subtitle,
    APP_TITLE: PRODUCT_CONFIG.title,
    APP_VERSION: options.appVersion,
    HERO_NAME: PRODUCT_CONFIG.heroName,
    HERO_TITLE: PRODUCT_CONFIG.heroTitle,
    HOME_HEADLINE: PRODUCT_CONFIG.homeHeadline,
    HOME_SUMMARY: PRODUCT_CONFIG.homeSummary,
    PLAYER_ALIAS: PRODUCT_CONFIG.playerAlias,
    RUNTIME_PLATFORM: options.desktop.platform,
    SEASON_NAME: PRODUCT_CONFIG.seasonName,
    SHELL_LABEL: PRODUCT_CONFIG.shellLabel,
  });
}

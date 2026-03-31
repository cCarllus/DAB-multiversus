import { createElementFromTemplate } from '@app/utils/html';
import { PRODUCT_CONFIG } from '@shared/config/productConfig';
import type { DesktopBridge } from '@shared/types/desktop';

import { resolveAuthDisplayName, type AuthUser } from '@app/auth/auth-types';

import homeTemplate from '../../pages/home/home.html?raw';
import '../../pages/home/home.css';

interface HomeScreenOptions {
  appVersion: string;
  audioMuted: boolean;
  desktop: DesktopBridge;
  user: AuthUser;
}

export function createHomeScreen(options: HomeScreenOptions): HTMLElement {
  return createElementFromTemplate(homeTemplate, {
    AUDIO_BUTTON_STATE_CLASS: options.audioMuted
      ? 'home-voice-button--muted'
      : 'home-voice-button--live',
    AUDIO_ICON_ID: options.audioMuted ? 'icon-mic-off' : 'icon-mic',
    AUDIO_STATE_LABEL: options.audioMuted ? 'Enable interface audio' : 'Mute interface audio',
    APP_SUBTITLE: PRODUCT_CONFIG.subtitle,
    APP_TITLE: PRODUCT_CONFIG.title,
    APP_VERSION: options.appVersion,
    HERO_NAME: PRODUCT_CONFIG.heroName,
    HERO_TITLE: PRODUCT_CONFIG.heroTitle,
    HOME_HEADLINE: PRODUCT_CONFIG.homeHeadline,
    HOME_SUMMARY: PRODUCT_CONFIG.homeSummary,
    PLAYER_ALIAS: resolveAuthDisplayName(options.user),
    PLAYER_STATUS: options.user.email,
    RUNTIME_PLATFORM: options.desktop.platform,
    SEASON_NAME: PRODUCT_CONFIG.seasonName,
    SHELL_LABEL: PRODUCT_CONFIG.shellLabel,
  });
}

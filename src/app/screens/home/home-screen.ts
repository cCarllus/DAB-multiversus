import { createElementFromTemplate } from '@app/utils/html';
import { PRODUCT_CONFIG } from '@shared/config/productConfig';
import type { DesktopBridge } from '@shared/types/desktop';

import { createExitModal } from '@app/ui/createExitModal';
import { resolveAuthDisplayName, type AuthUser } from '@app/auth/auth-types';

import homeTemplate from '../../pages/home/home.html?raw';
import '../../pages/home/home.css';

interface HomeScreenOptions {
  appVersion: string;
  musicMuted: boolean;
  desktop: DesktopBridge;
  exitModal?: {
    errorMessage?: string | null;
    isLoggingOut: boolean;
    status: 'open' | 'closing';
  };
  user: AuthUser;
}

export function createHomeScreen(options: HomeScreenOptions): HTMLElement {
  const rootElement = createElementFromTemplate(homeTemplate, {
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
    PLAYER_ALIAS: resolveAuthDisplayName(options.user),
    PLAYER_STATUS: options.user.email,
    RUNTIME_PLATFORM: options.desktop.platform,
    SEASON_NAME: PRODUCT_CONFIG.seasonName,
    SHELL_LABEL: PRODUCT_CONFIG.shellLabel,
  });

  if (options.exitModal) {
    rootElement.append(
      createExitModal({
        errorMessage: options.exitModal.errorMessage,
        isClosing: options.exitModal.status === 'closing',
        isLoggingOut: options.exitModal.isLoggingOut,
        userLabel: resolveAuthDisplayName(options.user),
      }),
    );
  }

  return rootElement;
}

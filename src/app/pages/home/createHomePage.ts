import dabIconUrl from '@assets/images/dab-icon.png';
import dabSigilUrl from '@assets/images/dab-sigil.svg';
import type { DesktopBridge } from '@shared/types/desktop';
import { PRODUCT_CONFIG } from '@shared/config/productConfig';
import { createElementFromTemplate } from '@app/utils/html';

import homeTemplate from './home.html?raw';
import './home.css';

interface HomePageOptions {
  appVersion: string;
  audioMuted: boolean;
  desktop: DesktopBridge;
}

export function createHomePage(options: HomePageOptions): HTMLElement {
  return createElementFromTemplate(homeTemplate, {
    APP_SUBTITLE: PRODUCT_CONFIG.subtitle,
    APP_TITLE: PRODUCT_CONFIG.title,
    APP_VERSION: options.appVersion,
    AUDIO_LABEL: options.audioMuted ? 'Audio Off' : 'Audio On',
    DAB_ICON_URL: dabIconUrl,
    DAB_SIGIL_URL: dabSigilUrl,
    HOME_HEADLINE: PRODUCT_CONFIG.homeHeadline,
    HOME_SUMMARY: PRODUCT_CONFIG.homeSummary,
    PLAYER_ALIAS: PRODUCT_CONFIG.playerAlias,
    RUNTIME_PLATFORM: options.desktop.platform,
    SHELL_LABEL: PRODUCT_CONFIG.shellLabel,
  });
}

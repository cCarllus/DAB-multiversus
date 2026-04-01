import { createElementFromTemplate } from '@app/utils/html';

import menuFooterBarTemplate from './menu-footer-bar.html?raw';

interface CreateMenuFooterBarOptions {
  musicMuted: boolean;
}

export function createMenuFooterBar(options: CreateMenuFooterBarOptions): HTMLElement {
  return createElementFromTemplate(menuFooterBarTemplate, {
    MUSIC_BUTTON_STATE_CLASS: options.musicMuted
      ? 'home-voice-button--muted'
      : 'home-voice-button--live',
    MUSIC_ICON_ID: options.musicMuted ? 'icon-mic-off' : 'icon-mic',
    MUSIC_STATE_LABEL: options.musicMuted
      ? 'Ativar a musica do launcher'
      : 'Mutar a musica do launcher',
  });
}

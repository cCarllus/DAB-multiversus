import { createElementFromTemplate } from '@frontend/lib/html';
import type { AppI18n } from '@shared/i18n';

import menuFooterBarTemplate from './menu-footer-bar.html?raw';

interface CreateMenuFooterBarOptions {
  i18n: AppI18n;
  musicMuted: boolean;
}

export function createMenuFooterBar(options: CreateMenuFooterBarOptions): HTMLElement {
  const messages = options.i18n.getMessages();

  return createElementFromTemplate(menuFooterBarTemplate, {
    CHAT_PLACEHOLDER: messages.menu.footer.chatPlaceholder,
    MUSIC_BUTTON_STATE_CLASS: options.musicMuted
      ? 'home-voice-button--muted'
      : 'home-voice-button--live',
    MUSIC_ICON_ID: options.musicMuted ? 'icon-mic-off' : 'icon-mic',
    MUSIC_STATE_LABEL: options.musicMuted
      ? messages.menu.footer.musicEnable
      : messages.menu.footer.musicMute,
    PARTY_PREFIX: messages.menu.footer.partyPrefix,
    PLAY_LABEL: messages.menu.footer.play,
  });
}

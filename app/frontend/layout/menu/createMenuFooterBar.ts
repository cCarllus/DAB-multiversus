import { createElementFromTemplate } from '@frontend/lib/html';
import { createGlobalChatPanel } from '@frontend/screens/social/global-chat-panel';
import type { ChatStore } from '@frontend/stores/chat.store';
import type { AppI18n } from '@shared/i18n';

import menuFooterBarTemplate from './menu-footer-bar.html?raw';

interface CreateMenuFooterBarOptions {
  chatStore?: ChatStore;
  currentUserNickname?: string;
  i18n: AppI18n;
  musicMuted: boolean;
}

export function createMenuFooterBar(options: CreateMenuFooterBarOptions): HTMLElement {
  const messages = options.i18n.getMessages();
  const element = createElementFromTemplate(menuFooterBarTemplate, {
    MUSIC_BUTTON_STATE_CLASS: options.musicMuted
      ? 'home-voice-button--muted'
      : 'home-voice-button--live',
    MUSIC_ICON_ID: options.musicMuted ? 'icon-mic-off' : 'icon-mic',
    MUSIC_STATE_LABEL: options.musicMuted
      ? messages.menu.footer.musicEnable
      : messages.menu.footer.musicMute,
    PLAY_LABEL: messages.menu.footer.play,
  });
  const chatMount = element.querySelector<HTMLElement>('[data-menu-global-chat]');

  if (!chatMount) {
    throw new Error('Menu footer chat mount could not be initialized.');
  }

  if (options.chatStore) {
    chatMount.replaceChildren(
      createGlobalChatPanel({
        chatStore: options.chatStore,
        currentUserNickname: options.currentUserNickname,
        i18n: options.i18n,
      }),
    );
  } else {
    chatMount.textContent = messages.menu.home.globalChat.unavailable;
  }

  return element;
}

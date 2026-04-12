import { createSvgIcon } from '@frontend/lib/svg-icon';
import {
  createSocialAvatar,
} from '@frontend/screens/social/social-formatters';
import type { ChatStore } from '@frontend/stores/chat.store';
import type { AppI18n } from '@shared/i18n';

import './global-chat-panel.css';

interface CreateGlobalChatPanelOptions {
  chatStore: ChatStore;
  currentUserNickname?: string;
  i18n: AppI18n;
}

const COLLAPSED_VISIBLE_MESSAGES = 4;
const QUICK_EMOJIS = ['😀', '😎', '😂', '😈', '🔥', '⚔️', '💀', '👑', '🎯', '💎'];

function formatChatTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function insertAtCursor(input: HTMLInputElement, value: string): void {
  const selectionStart = input.selectionStart ?? input.value.length;
  const selectionEnd = input.selectionEnd ?? input.value.length;
  const prefix = input.value.slice(0, selectionStart);
  const suffix = input.value.slice(selectionEnd);
  const nextValue = `${prefix}${value}${suffix}`;
  const nextCursorPosition = selectionStart + value.length;

  input.value = nextValue;
  input.setSelectionRange(nextCursorPosition, nextCursorPosition);
  input.focus();
}

export function createGlobalChatPanel(options: CreateGlobalChatPanelOptions): HTMLElement {
  const messages = options.i18n.getMessages();
  const currentNickname = options.currentUserNickname?.trim().toLowerCase() ?? null;
  const rootElement = document.createElement('section');
  rootElement.className = 'global-chat-panel';

  const feed = document.createElement('div');
  feed.className = 'global-chat-panel__feed';

  const feedback = document.createElement('p');
  feedback.className = 'global-chat-panel__feedback';
  feedback.hidden = true;

  const list = document.createElement('div');
  list.className = 'global-chat-panel__list';
  list.setAttribute('aria-live', 'polite');
  list.setAttribute('role', 'log');
  list.tabIndex = 0;

  feed.append(feedback, list);

  const form = document.createElement('form');
  form.className = 'home-chat global-chat-panel__composer';
  const prefix = document.createElement('span');
  prefix.className = 'home-chat__prefix';
  prefix.textContent = messages.menu.footer.globalPrefix;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'home-chat__input global-chat-panel__input';
  input.maxLength = 320;
  input.placeholder = messages.menu.footer.chatPlaceholder;
  input.setAttribute('aria-label', messages.menu.footer.chatPlaceholder);

  const actions = document.createElement('div');
  actions.className = 'home-chat__actions';

  const emojiButton = document.createElement('button');
  emojiButton.type = 'button';
  emojiButton.className = 'home-chat__emoji-button';
  emojiButton.setAttribute('aria-label', messages.menu.footer.emojiAriaLabel);
  emojiButton.setAttribute('title', messages.menu.footer.emojiAriaLabel);
  emojiButton.setAttribute('aria-expanded', 'false');
  emojiButton.append(
    createSvgIcon('icon-smile', {
      className: 'home-icon home-icon--medium',
    }),
  );
  actions.append(emojiButton);

  const emojiPicker = document.createElement('div');
  emojiPicker.className = 'home-chat__emoji-picker';
  emojiPicker.hidden = true;
  emojiPicker.style.display = 'none';
  emojiPicker.append(
    ...QUICK_EMOJIS.map((emoji) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'home-chat__emoji-option';
      button.textContent = emoji;
      button.setAttribute('aria-label', emoji);
      return button;
    }),
  );

  form.append(prefix, input, actions, emojiPicker);
  rootElement.append(feed, form);

  let isExpanded = false;
  let isEmojiOpen = false;
  let lastRenderedMessageId: string | null = null;
  let localFeedback: string | null = null;
  const documentEvents = new AbortController();

  const setExpanded = (value: boolean): void => {
    isExpanded = value;
    rootElement.dataset.chatMode = value ? 'expanded' : 'compact';
    render();
  };

  const setEmojiOpen = (value: boolean): void => {
    isEmojiOpen = value;
    emojiPicker.hidden = !value;
    emojiPicker.style.display = value ? 'grid' : 'none';
    emojiPicker.dataset.open = value ? 'true' : 'false';
    emojiButton.setAttribute('aria-expanded', value ? 'true' : 'false');
  };

  const render = (): void => {
    const snapshot = options.chatStore.getSnapshot();
    const locale = options.i18n.getLocale();
    const visibleMessages = isExpanded
      ? snapshot.messages
      : snapshot.messages.slice(Math.max(0, snapshot.messages.length - COLLAPSED_VISIBLE_MESSAGES));

    rootElement.dataset.connectionState = snapshot.isConnected ? 'connected' : 'disconnected';
    rootElement.dataset.chatMode = isExpanded ? 'expanded' : 'compact';

    const nextFeedback = localFeedback ?? snapshot.lastError;
    const showFeedback = isExpanded && Boolean(nextFeedback);

    feedback.hidden = !showFeedback;
    feedback.textContent = showFeedback ? (nextFeedback as string) : '';

    if (snapshot.isLoading && snapshot.messages.length === 0) {
      const loading = document.createElement('div');
      loading.className = 'global-chat-panel__empty';
      loading.textContent = messages.menu.footer.loading;
      list.replaceChildren(loading);
      return;
    }

    if (visibleMessages.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'global-chat-panel__empty';
      empty.textContent = messages.menu.footer.empty;
      list.replaceChildren(empty);
      return;
    }

    const collapsedOpacities =
      visibleMessages.length <= 1
        ? [1]
        : visibleMessages.map((_, index) => {
            const ratio = (index + 1) / visibleMessages.length;
            return 0.22 + ratio * 0.78;
          });

    list.replaceChildren(
      ...visibleMessages.map((message, index) => {
        const isCurrentUser =
          currentNickname !== null && message.sender.nickname.trim().toLowerCase() === currentNickname;
        const item = document.createElement('article');
        item.className = isCurrentUser
          ? 'global-chat-panel__message global-chat-panel__message--self'
          : 'global-chat-panel__message global-chat-panel__message--other';

        if (!isExpanded) {
          item.style.opacity = String(collapsedOpacities[index]!);
        } else {
          item.style.opacity = '1';
        }

        const avatar = document.createElement('img');
        avatar.className = 'global-chat-panel__avatar';
        avatar.src =
          message.sender.avatarUrl ||
          createSocialAvatar({
            createdAt: message.createdAt,
            level: message.sender.level,
            name: message.sender.name,
            nickname: message.sender.nickname,
            presence: {
              currentActivity: null,
              lastSeenAt: message.createdAt,
              status: 'offline',
            },
            profileImageUrl: message.sender.avatarUrl,
            relationship: {
              friendshipId: null,
              requestId: null,
              state: 'none',
            },
          });
        avatar.alt = message.sender.nickname;

        const bubble = document.createElement('div');
        bubble.className = 'global-chat-panel__bubble';

        const topLine = document.createElement('div');
        topLine.className = 'global-chat-panel__message-topline';

        const sender = document.createElement('strong');
        sender.className = 'global-chat-panel__sender';
        sender.textContent = message.sender.name || message.sender.nickname;

        const meta = document.createElement('span');
        meta.className = 'global-chat-panel__meta';
        meta.textContent = `@${message.sender.nickname} • LV ${message.sender.level} • ${formatChatTime(message.createdAt, locale)}`;
        topLine.append(sender, meta);

        const content = document.createElement('p');
        content.className = 'global-chat-panel__content';
        content.textContent = message.content;

        bubble.append(topLine, content);
        item.append(avatar, bubble);
        return item;
      }),
    );

    if (isExpanded) {
      const newestMessageId = visibleMessages[visibleMessages.length - 1]?.id;

      if (newestMessageId && newestMessageId !== lastRenderedMessageId) {
        list.scrollTop = list.scrollHeight;
        lastRenderedMessageId = newestMessageId;
      }
    }
  };

  const unsubscribe = options.chatStore.subscribe(() => {
    if (!rootElement.isConnected) {
      unsubscribe();
      documentEvents.abort();
      return;
    }

    const snapshot = options.chatStore.getSnapshot();

    if (localFeedback && snapshot.isConnected && !snapshot.lastError) {
      localFeedback = null;
    }

    render();
  });

  input.addEventListener('focus', () => {
    setExpanded(true);
  });

  input.addEventListener('click', () => {
    setExpanded(true);
  });

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!(event.target instanceof Node) || rootElement.contains(event.target)) {
        return;
      }

      setEmojiOpen(false);
      setExpanded(false);
    },
    {
      signal: documentEvents.signal,
    },
  );

  emojiButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  emojiButton.addEventListener('click', () => {
    setEmojiOpen(!isEmojiOpen);

    if (isEmojiOpen) {
      emojiPicker.querySelector<HTMLButtonElement>('button')?.focus();
    }
  });

  emojiPicker.addEventListener('click', (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('.home-chat__emoji-option')
        : null;

    if (!button) {
      return;
    }

    insertAtCursor(input, button.textContent ?? '');
    setEmojiOpen(false);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const nextMessage = input.value.trim();

    if (!nextMessage) {
      return;
    }

    localFeedback = null;
    input.disabled = true;
    emojiButton.disabled = true;

    void options.chatStore
      .sendMessage(nextMessage)
      .then(() => {
        input.value = '';
      })
      .catch((error: unknown) => {
        localFeedback =
          error instanceof Error ? error.message : messages.menu.home.globalChat.unavailable;
      })
      .finally(() => {
        input.disabled = false;
        emojiButton.disabled = false;
        render();
        input.focus();
      });
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (isEmojiOpen) {
        setEmojiOpen(false);
        event.preventDefault();
        return;
      }

      setExpanded(false);
      input.blur();
      event.preventDefault();
    }
  });

  setExpanded(false);
  void options.chatStore.load().catch(() => undefined);

  return rootElement;
}

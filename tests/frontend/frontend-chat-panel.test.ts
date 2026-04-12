// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMenuFooterBar } from '../../app/frontend/layout/menu/createMenuFooterBar';
import { createGlobalChatPanel } from '../../app/frontend/screens/social/global-chat-panel';
import type { ChatSnapshot, GlobalChatMessage } from '../../app/frontend/services/chat/chat-types';
import { createTestI18n, flushPromises } from '../helpers/frontend';

async function importWithHtmlStub<T>(modulePath: string, html: HTMLElement): Promise<T> {
  vi.resetModules();
  vi.doMock('@frontend/lib/html', () => ({
    createElementFromTemplate: vi.fn(() => html),
  }));

  return import(modulePath) as Promise<T>;
}

function createMessage(
  id: string,
  overrides: Partial<GlobalChatMessage> = {},
): GlobalChatMessage {
  return {
    channel: 'global',
    content: `message-${id}`,
    createdAt: `2024-01-01T00:0${id}:00.000Z`,
    id,
    sender: {
      avatarUrl: null,
      level: 1,
      name: `Player ${id}`,
      nickname: `player.${id}`,
      userId: `user-${id}`,
      ...(overrides.sender ?? {}),
    },
    ...overrides,
  };
}

function createChatStoreMock(initialSnapshot?: Partial<ChatSnapshot>) {
  let snapshot: ChatSnapshot = {
    connectedUsers: 1,
    isConnected: true,
    isLoading: false,
    lastError: null,
    messages: [],
    ...initialSnapshot,
  };
  const listeners = new Set<() => void>();
  const load = vi.fn(async () => snapshot);
  const sendMessage = vi.fn(async () => undefined);

  return {
    getSnapshot: vi.fn(() => snapshot),
    load,
    sendMessage,
    getListenerCount() {
      return listeners.size;
    },
    setSnapshot(nextSnapshot: Partial<ChatSnapshot>) {
      snapshot = {
        ...snapshot,
        ...nextSnapshot,
      };

      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    }),
  };
}

describe('frontend global chat panel', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('renders compact by default, limits messages, and marks current user messages', async () => {
    const chatStore = createChatStoreMock({
      messages: [
        createMessage('1'),
        createMessage('2'),
        createMessage('3', {
          sender: {
            avatarUrl: 'https://example.com/avatar.png',
            level: 7,
            name: 'Player One',
            nickname: 'player.one',
            userId: 'user-self',
          },
        }),
        createMessage('4'),
        createMessage('5'),
      ],
    });

    const panel = createGlobalChatPanel({
      chatStore: chatStore as never,
      currentUserNickname: 'player.one',
      i18n: createTestI18n('en'),
    });

    document.body.append(panel);
    await flushPromises();

    expect(panel.dataset.chatMode).toBe('compact');
    expect(panel.querySelector('.global-chat-panel__status')).toBeNull();
    expect(panel.querySelectorAll('.global-chat-panel__message')).toHaveLength(4);
    expect(panel.querySelector('.global-chat-panel__message--self')).not.toBeNull();
    expect(panel.querySelector('.global-chat-panel__message--other')).not.toBeNull();
    expect(
      panel.querySelector<HTMLImageElement>('.global-chat-panel__message--self .global-chat-panel__avatar')?.src,
    ).toContain('https://example.com/avatar.png');
    expect(
      panel.querySelector<HTMLImageElement>('.global-chat-panel__message--other .global-chat-panel__avatar')?.src,
    ).toContain('data:image/svg+xml');
  });

  it('renders the empty state when no chat messages are available', async () => {
    const chatStore = createChatStoreMock({
      isConnected: false,
      messages: [],
    });
    const panel = createGlobalChatPanel({
      chatStore: chatStore as never,
      i18n: createTestI18n('en'),
    });

    document.body.append(panel);
    await flushPromises();

    expect(panel.querySelector('.global-chat-panel__empty')?.textContent).toContain(
      'No global messages yet',
    );
  });

  it('renders the loading state while chat history is still loading', async () => {
    const chatStore = createChatStoreMock({
      isLoading: true,
      messages: [],
    });
    const panel = createGlobalChatPanel({
      chatStore: chatStore as never,
      i18n: createTestI18n('en'),
    });

    document.body.append(panel);
    await flushPromises();

    expect(panel.querySelector('.global-chat-panel__empty')?.textContent).toContain(
      'Loading recent messages',
    );
  });

  it('keeps working when the initial history load fails and the expanded log is empty', async () => {
    const chatStore = createChatStoreMock({
      messages: [],
    });
    chatStore.load.mockImplementationOnce(async () => {
      throw new Error('history unavailable');
    });

    const panel = createGlobalChatPanel({
      chatStore: chatStore as never,
      i18n: createTestI18n('en'),
    });

    document.body.append(panel);
    await flushPromises();

    const input = panel.querySelector<HTMLInputElement>('.global-chat-panel__input')!;
    input.dispatchEvent(new Event('focus'));

    expect(panel.dataset.chatMode).toBe('expanded');
    expect(panel.querySelectorAll('.global-chat-panel__message')).toHaveLength(0);
  });

  it('expands on input focus, toggles emojis, inserts emoji, and collapses on outside click', async () => {
    const chatStore = createChatStoreMock({
      messages: [createMessage('1')],
    });
    const panel = createGlobalChatPanel({
      chatStore: chatStore as never,
      currentUserNickname: 'player.one',
      i18n: createTestI18n('en'),
    });

    document.body.append(panel);

    const input = panel.querySelector<HTMLInputElement>('.global-chat-panel__input')!;
    const emojiButton = panel.querySelector<HTMLButtonElement>('.home-chat__emoji-button')!;
    const emojiPicker = panel.querySelector<HTMLElement>('.home-chat__emoji-picker')!;

    expect(emojiPicker.hidden).toBe(true);
    expect(emojiPicker.style.display).toBe('none');

    input.click();
    expect(panel.dataset.chatMode).toBe('expanded');

    const emojiPointerDownEvent = new Event('pointerdown', { bubbles: true, cancelable: true });
    emojiButton.dispatchEvent(emojiPointerDownEvent);
    expect(emojiPointerDownEvent.defaultPrevented).toBe(true);

    input.dispatchEvent(new Event('focus'));
    input.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(panel.dataset.chatMode).toBe('expanded');

    emojiButton.click();
    expect(emojiPicker.hidden).toBe(false);
    expect(emojiPicker.style.display).toBe('grid');
    expect(emojiButton.getAttribute('aria-expanded')).toBe('true');

    emojiPicker.dispatchEvent(new Event('click', { bubbles: true }));
    expect(emojiPicker.hidden).toBe(false);

    emojiButton.click();
    expect(emojiPicker.hidden).toBe(true);
    expect(emojiButton.getAttribute('aria-expanded')).toBe('false');

    emojiButton.click();
    input.value = 'hi ';
    input.setSelectionRange(3, 3);
    emojiPicker.querySelector<HTMLButtonElement>('.home-chat__emoji-option')?.click();
    expect(input.value).toContain('😀');
    expect(emojiPicker.hidden).toBe(true);

    emojiButton.click();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(emojiPicker.hidden).toBe(true);
    expect(panel.dataset.chatMode).toBe('expanded');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel.dataset.chatMode).toBe('compact');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(panel.dataset.chatMode).toBe('compact');

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(panel.dataset.chatMode).toBe('compact');
  });

  it('covers the emoji picker fallback paths', async () => {
    const chatStore = createChatStoreMock({
      messages: [createMessage('1'), createMessage('2')],
    });
    const panel = createGlobalChatPanel({
      chatStore: chatStore as never,
      i18n: createTestI18n('en'),
    });

    document.body.append(panel);
    await flushPromises();

    const input = panel.querySelector<HTMLInputElement>('.global-chat-panel__input')!;
    const emojiButton = panel.querySelector<HTMLButtonElement>('.home-chat__emoji-button')!;
    const emojiPicker = panel.querySelector<HTMLElement>('.home-chat__emoji-picker')!;

    emojiButton.click();

    const orphanTextNode = document.createTextNode('ignored');
    emojiPicker.append(orphanTextNode);
    orphanTextNode.dispatchEvent(new Event('click', { bubbles: true }));
    expect(emojiPicker.hidden).toBe(false);

    const fallbackSelectionEmoji = emojiPicker.querySelectorAll<HTMLButtonElement>('.home-chat__emoji-option')[1]!;
    Object.defineProperty(input, 'selectionStart', {
      configurable: true,
      get: () => null,
    });
    Object.defineProperty(input, 'selectionEnd', {
      configurable: true,
      get: () => null,
    });

    input.value = 'abc';
    fallbackSelectionEmoji.dispatchEvent(new Event('click', { bubbles: true }));
    expect(input.value).toBe('abc😎');

    emojiButton.click();

    const emojiOption = emojiPicker.querySelector<HTMLButtonElement>('.home-chat__emoji-option')!;
    Object.defineProperty(emojiOption, 'textContent', {
      configurable: true,
      get: () => null,
    });

    input.value = 'abc';
    emojiOption.dispatchEvent(new Event('click', { bubbles: true }));
    expect(input.value).toBe('abc');
    expect(emojiPicker.hidden).toBe(true);
  });

  it('submits trimmed messages and shows send errors while expanded', async () => {
    const chatStore = createChatStoreMock({
      messages: [createMessage('1')],
    });
    chatStore.sendMessage
      .mockImplementationOnce(async () => undefined)
      .mockImplementationOnce(async () => {
        throw new Error('chat failed');
      })
      .mockImplementationOnce(async () => {
        throw 'bad failure';
      });

    const panel = createGlobalChatPanel({
      chatStore: chatStore as never,
      currentUserNickname: 'player.one',
      i18n: createTestI18n('en'),
    });

    document.body.append(panel);

    const input = panel.querySelector<HTMLInputElement>('.global-chat-panel__input')!;
    const form = panel.querySelector<HTMLFormElement>('form')!;
    const feedback = panel.querySelector<HTMLElement>('.global-chat-panel__feedback')!;

    input.dispatchEvent(new Event('focus'));
    input.value = '   ';
    form.dispatchEvent(new Event('submit'));
    await flushPromises();

    expect(chatStore.sendMessage).not.toHaveBeenCalled();

    input.value = '  hello world  ';
    form.dispatchEvent(new Event('submit'));
    await flushPromises();

    expect(chatStore.sendMessage).toHaveBeenNthCalledWith(1, 'hello world');
    expect(input.value).toBe('');

    input.value = ' fail ';
    form.dispatchEvent(new Event('submit'));
    await flushPromises();

    expect(chatStore.sendMessage).toHaveBeenNthCalledWith(2, 'fail');
    expect(feedback.hidden).toBe(false);
    expect(feedback.textContent).toContain('chat failed');

    input.value = ' fallback ';
    form.dispatchEvent(new Event('submit'));
    await flushPromises();

    expect(chatStore.sendMessage).toHaveBeenNthCalledWith(3, 'fallback');
    expect(feedback.textContent).toContain('Global chat is unavailable right now');
  });

  it('clears stale local send feedback after the chat store reconnects cleanly', async () => {
    const chatStore = createChatStoreMock({
      isConnected: false,
      messages: [createMessage('1')],
    });
    chatStore.sendMessage.mockImplementationOnce(async () => {
      throw new Error('chat failed');
    });

    const panel = createGlobalChatPanel({
      chatStore: chatStore as never,
      i18n: createTestI18n('en'),
    });

    document.body.append(panel);

    const input = panel.querySelector<HTMLInputElement>('.global-chat-panel__input')!;
    const form = panel.querySelector<HTMLFormElement>('form')!;
    const feedback = panel.querySelector<HTMLElement>('.global-chat-panel__feedback')!;

    input.dispatchEvent(new Event('focus'));
    input.value = 'fail';
    form.dispatchEvent(new Event('submit'));
    await flushPromises();

    expect(feedback.hidden).toBe(false);
    expect(feedback.textContent).toContain('chat failed');

    chatStore.setSnapshot({
      isConnected: true,
      lastError: null,
    });

    expect(feedback.hidden).toBe(true);
    expect(feedback.textContent).toBe('');
  });

  it('mounts the chat panel into the footer and forwards the current nickname', async () => {
    const chatStore = createChatStoreMock({
      messages: [
        createMessage('1', {
          sender: {
            avatarUrl: null,
            level: 12,
            name: 'Player One',
            nickname: 'player.one',
            userId: 'user-self',
          },
        }),
      ],
    });

    const footer = createMenuFooterBar({
      chatStore: chatStore as never,
      currentUserNickname: 'player.one',
      i18n: createTestI18n('en'),
      musicMuted: false,
    });

    document.body.append(footer);
    await flushPromises();

    expect(footer.querySelector('.global-chat-panel')).not.toBeNull();
    expect(footer.querySelector('.global-chat-panel__message--self')).not.toBeNull();
  });

  it('unsubscribes from chat updates when the panel is detached', async () => {
    const chatStore = createChatStoreMock({
      messages: [createMessage('1')],
    });
    const panel = createGlobalChatPanel({
      chatStore: chatStore as never,
      i18n: createTestI18n('en'),
    });

    document.body.append(panel);
    await flushPromises();
    expect(chatStore.getListenerCount()).toBe(1);

    panel.remove();
    chatStore.setSnapshot({
      connectedUsers: 3,
    });

    expect(chatStore.getListenerCount()).toBe(0);
  });

  it('rerenders while connected when the chat store publishes new messages', async () => {
    const chatStore = createChatStoreMock({
      messages: [
        createMessage('1', {
          sender: {
            avatarUrl: null,
            level: 4,
            name: '',
            nickname: 'no.name',
            userId: 'user-1',
          },
        }),
      ],
    });
    const panel = createGlobalChatPanel({
      chatStore: chatStore as never,
      i18n: createTestI18n('en'),
    });

    document.body.append(panel);
    await flushPromises();

    expect(panel.querySelector('.global-chat-panel__sender')?.textContent).toBe('no.name');

    chatStore.setSnapshot({
      messages: [
        createMessage('1'),
        createMessage('2'),
      ],
    });

    expect(panel.querySelectorAll('.global-chat-panel__message')).toHaveLength(2);
  });

  it('throws when the footer template is missing the chat mount', async () => {
    const brokenFooter = document.createElement('footer');
    const { createMenuFooterBar: createBrokenFooter } = await importWithHtmlStub<{
      createMenuFooterBar: typeof createMenuFooterBar;
    }>('../../app/frontend/layout/menu/createMenuFooterBar', brokenFooter);

    expect(() =>
      createBrokenFooter({
        i18n: createTestI18n('en'),
        musicMuted: false,
      }),
    ).toThrow('Menu footer chat mount could not be initialized.');
  });
});

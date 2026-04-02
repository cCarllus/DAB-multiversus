import { createElementFromTemplate } from '@frontend/lib/html';
import type {
  SocialDirectoryPresenceFilter,
  SocialUserSummary,
} from '@frontend/services/social/social-types';
import type { AppI18n } from '@shared/i18n';

import {
  createSocialAvatar,
  formatMemberSince,
  resolveAccentColor,
  resolvePresenceLabel,
  resolvePresenceTone,
  resolveQuickAction,
  resolveUserLevel,
} from './social-formatters';

export type SocialBoardSection = 'friends' | 'pending' | 'players';

export interface SocialBoardItem {
  createdAt?: string;
  requestDirection?: 'incoming' | 'outgoing';
  requestId?: string;
  user: SocialUserSummary;
}

interface SocialUserListOptions {
  i18n: AppI18n;
  onHoverLeave: () => void;
  onHoverUser: (user: SocialUserSummary, anchor: HTMLElement) => void;
  onLoadMore: () => void;
  onPresenceChange: (value: SocialDirectoryPresenceFilter) => void;
  onSearchChange: (value: string) => void;
  onSelectUser: (nickname: string) => void;
  onUserAction: (item: SocialBoardItem) => void;
}

interface SocialUserListState {
  activeSection: SocialBoardSection;
  hasMore: boolean;
  isBusy: boolean;
  items: SocialBoardItem[];
  presence: SocialDirectoryPresenceFilter;
  query: string;
  selectedNickname: string | null;
  total: number;
}

const template = `
  <section class="social-board">
    <header class="social-board__header">
      <div>
        <p class="social-board__eyebrow"></p>
        <h2 class="social-board__title"></h2>
      </div>
      <p class="social-board__summary"></p>
    </header>

    <div class="social-board__toolbar">
      <label class="social-board__search">
        <svg class="home-icon home-icon--small">
          <use href="#icon-search"></use>
        </svg>
        <input type="search" class="social-board__search-input" data-social-search />
      </label>

      <label class="social-board__filter">
        <span class="social-board__filter-label" data-social-presence-label></span>
        <select class="social-board__select" data-social-presence>
          <option value="all"></option>
          <option value="online"></option>
          <option value="offline"></option>
        </select>
      </label>
    </div>

    <div class="social-board__headings">
      <span>__PLAYER_LABEL__</span>
      <span>__STATUS_LABEL__</span>
        <span>__LEVEL_LABEL__</span>
        <span>__MEMBER_SINCE_LABEL__</span>
        <span>__ACTION_LABEL__</span>
    </div>

    <div class="social-board__rows" data-social-rows></div>
    <div class="social-board__empty" data-social-empty hidden></div>

    <footer class="social-board__footer">
      <span class="social-board__footer-count" data-social-count></span>
      <button type="button" class="social-board__more" data-social-more></button>
    </footer>
  </section>
`;

function resolveBoardCopy(section: SocialBoardSection, i18n: AppI18n) {
  if (section === 'friends') {
    return {
      count: (total: number) => i18n.t('menu.social.friends.count', { count: String(total) }),
      empty: i18n.t('menu.social.friends.empty'),
      loading: i18n.t('menu.social.friends.loading'),
      summary: i18n.t('menu.social.friends.summary'),
      title: i18n.t('menu.social.friends.title'),
      eyebrow: i18n.t('menu.social.friends.eyebrow'),
    };
  }

  if (section === 'pending') {
    return {
      count: (total: number) => i18n.t('menu.social.requests.count', { count: String(total) }),
      empty: i18n.t('menu.social.requests.empty'),
      loading: i18n.t('menu.social.requests.loading'),
      summary: i18n.t('menu.social.requests.summary'),
      title: i18n.t('menu.social.requests.title'),
      eyebrow: i18n.t('menu.social.requests.eyebrow'),
    };
  }

  return {
    count: (total: number) => i18n.t('menu.social.directory.count', { count: String(total) }),
    empty: i18n.t('menu.social.directory.empty'),
    loading: i18n.t('menu.social.directory.loading'),
    summary: i18n.t('menu.social.directory.summary'),
    title: i18n.t('menu.social.directory.title'),
    eyebrow: i18n.t('menu.social.directory.eyebrow'),
  };
}

export function createSocialUserList(options: SocialUserListOptions) {
  const element = createElementFromTemplate(template, {
    ACTION_LABEL: options.i18n.t('menu.social.directory.columns.action'),
    LEVEL_LABEL: options.i18n.t('menu.social.directory.columns.level'),
    MEMBER_SINCE_LABEL: options.i18n.t('menu.social.directory.columns.memberSince'),
    PLAYER_LABEL: options.i18n.t('menu.social.directory.columns.player'),
    STATUS_LABEL: options.i18n.t('menu.social.directory.columns.status'),
  });
  const title = element.querySelector<HTMLElement>('.social-board__title');
  const eyebrow = element.querySelector<HTMLElement>('.social-board__eyebrow');
  const summary = element.querySelector<HTMLElement>('.social-board__summary');
  const searchInput = element.querySelector<HTMLInputElement>('[data-social-search]');
  const presenceLabel = element.querySelector<HTMLElement>('[data-social-presence-label]');
  const presenceSelect = element.querySelector<HTMLSelectElement>('[data-social-presence]');
  const rows = element.querySelector<HTMLElement>('[data-social-rows]');
  const empty = element.querySelector<HTMLElement>('[data-social-empty]');
  const count = element.querySelector<HTMLElement>('[data-social-count]');
  const loadMore = element.querySelector<HTMLButtonElement>('[data-social-more]');

  if (
    !title ||
    !eyebrow ||
    !summary ||
    !searchInput ||
    !presenceLabel ||
    !presenceSelect ||
    !rows ||
    !empty ||
    !count ||
    !loadMore
  ) {
    throw new Error('Social user list could not be initialized.');
  }

  searchInput.placeholder = options.i18n.t('menu.social.directory.searchPlaceholder');
  presenceLabel.textContent = options.i18n.t('menu.social.directory.presenceFilter');
  presenceSelect.options[0].text = options.i18n.t('menu.social.directory.presenceOptions.all');
  presenceSelect.options[1].text = options.i18n.t('menu.social.directory.presenceOptions.online');
  presenceSelect.options[2].text = options.i18n.t('menu.social.directory.presenceOptions.offline');
  loadMore.setAttribute('aria-label', options.i18n.t('menu.social.directory.loadMore'));
  loadMore.innerHTML = `
    <svg class="home-icon home-icon--small" aria-hidden="true" focusable="false">
      <use href="#icon-refresh"></use>
    </svg>
  `;

  searchInput.addEventListener('input', () => {
    options.onSearchChange(searchInput.value);
  });
  presenceSelect.addEventListener('change', () => {
    options.onPresenceChange(presenceSelect.value as SocialDirectoryPresenceFilter);
  });
  loadMore.addEventListener('click', () => {
    options.onLoadMore();
  });

  const renderRow = (
    item: SocialBoardItem,
    state: SocialUserListState,
    locale: string,
  ): HTMLElement => {
    const action = resolveQuickAction(item.user, options.i18n, state.activeSection);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'social-board__row';
    row.dataset.selected = String(state.selectedNickname === item.user.nickname);
    row.addEventListener('click', () => {
      options.onSelectUser(item.user.nickname);
    });
    row.addEventListener('mouseenter', () => {
      options.onHoverUser(item.user, row);
    });
    row.addEventListener('mouseleave', () => {
      options.onHoverLeave();
    });

    const accent = document.createElement('span');
    accent.className = 'social-board__accent';
    accent.style.background = resolveAccentColor(item.user.nickname);

    const identity = document.createElement('span');
    identity.className = 'social-board__identity';
    const avatar = document.createElement('img');
    avatar.className = 'social-board__avatar';
    avatar.src = createSocialAvatar(item.user);
    avatar.alt = item.user.nickname;
    const copy = document.createElement('span');
    copy.className = 'social-board__copy';
    const name = document.createElement('strong');
    name.className = 'social-board__name';
    name.textContent = item.user.name;
    const nickname = document.createElement('span');
    nickname.className = 'social-board__nickname';
    nickname.textContent = `@${item.user.nickname}`;
    copy.append(name, nickname);
    identity.append(avatar, copy);

    const status = document.createElement('span');
    status.className = `social-board__status ${resolvePresenceTone(item.user.presence.status)}`;
    status.textContent = resolvePresenceLabel(item.user.presence.status, options.i18n);

    const level = document.createElement('span');
    level.className = 'social-board__level';
    level.textContent = String(resolveUserLevel(item.user));

    const memberSince = document.createElement('span');
    memberSince.className = 'social-board__date';
    memberSince.textContent = formatMemberSince(item.user.createdAt, locale);

    const actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className = 'social-board__action';
    actionButton.dataset.variant = action.action;
    actionButton.disabled = state.isBusy || action.disabled;
    actionButton.textContent = action.label;
    actionButton.addEventListener('click', (event) => {
      event.stopPropagation();
      options.onUserAction(item);
    });

    row.append(accent, identity, status, level, memberSince, actionButton);
    return row;
  };

  return {
    element,
    setState(state: SocialUserListState) {
      const locale = options.i18n.getLocale();
      const copy = resolveBoardCopy(state.activeSection, options.i18n);

      eyebrow.textContent = copy.eyebrow;
      title.textContent = copy.title;
      summary.textContent = copy.summary;
      searchInput.value = state.query;
      presenceSelect.value = state.presence;
      count.textContent = copy.count(state.total);
      loadMore.hidden = state.activeSection !== 'players' || !state.hasMore;
      loadMore.disabled = state.isBusy;
      rows.replaceChildren(...state.items.map((item) => renderRow(item, state, locale)));
      empty.hidden = state.items.length > 0;
      empty.textContent = state.isBusy ? copy.loading : copy.empty;
      rows.dataset.busy = String(state.isBusy);
    },
  };
}

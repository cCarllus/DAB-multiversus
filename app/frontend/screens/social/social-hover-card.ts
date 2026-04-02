import { createElementFromTemplate } from '@frontend/lib/html';
import type { SocialUserSummary } from '@frontend/services/social/social-types';
import type { AppI18n } from '@shared/i18n';

import {
  createSocialAvatar,
  formatMemberSince,
  resolvePresenceLabel,
  resolvePresenceTone,
  resolveQuickAction,
  resolveUserLevel,
} from './social-formatters';

interface SocialHoverCardOptions {
  i18n: AppI18n;
  onPrimaryAction: (user: SocialUserSummary) => void;
  onViewProfile: (nickname: string) => void;
}

const template = `
  <div class="social-hover-card" hidden>
    <div class="social-hover-card__header">
      <img class="social-hover-card__avatar" data-hover-avatar />
      <div class="social-hover-card__copy">
        <strong data-hover-name></strong>
        <span data-hover-nickname></span>
      </div>
    </div>
    <span class="social-hover-card__status" data-hover-status></span>
    <p class="social-hover-card__activity" data-hover-activity></p>
    <p class="social-hover-card__member-since" data-hover-member-since></p>
    <div class="social-hover-card__actions">
      <button type="button" class="social-hover-card__button" data-hover-primary></button>
      <button type="button" class="social-hover-card__button" data-hover-view></button>
    </div>
  </div>
`;

export function createSocialHoverCard(options: SocialHoverCardOptions) {
  const element = createElementFromTemplate(template);
  const avatar = element.querySelector<HTMLImageElement>('[data-hover-avatar]');
  const nickname = element.querySelector<HTMLElement>('[data-hover-nickname]');
  const name = element.querySelector<HTMLElement>('[data-hover-name]');
  const status = element.querySelector<HTMLElement>('[data-hover-status]');
  const activity = element.querySelector<HTMLElement>('[data-hover-activity]');
  const memberSince = element.querySelector<HTMLElement>('[data-hover-member-since]');
  const primary = element.querySelector<HTMLButtonElement>('[data-hover-primary]');
  const view = element.querySelector<HTMLButtonElement>('[data-hover-view]');

  if (!avatar || !nickname || !name || !status || !activity || !memberSince || !primary || !view) {
    throw new Error('Social hover card could not be initialized.');
  }

  let activeUser: SocialUserSummary | null = null;
  let hideTimer: number | null = null;
  let showTimer: number | null = null;

  const clearHideTimer = (): void => {
    if (hideTimer === null) {
      return;
    }

    window.clearTimeout(hideTimer);
    hideTimer = null;
  };

  const clearShowTimer = (): void => {
    if (showTimer === null) {
      return;
    }

    window.clearTimeout(showTimer);
    showTimer = null;
  };

  const hide = (): void => {
    clearShowTimer();
    clearHideTimer();
    activeUser = null;
    element.hidden = true;
  };

  const scheduleHide = (): void => {
    clearShowTimer();
    clearHideTimer();
    hideTimer = window.setTimeout(() => {
      hide();
    }, 120);
  };

  element.addEventListener('mouseenter', () => {
    clearShowTimer();
    clearHideTimer();
  });
  element.addEventListener('mouseleave', scheduleHide);
  primary.addEventListener('click', () => {
    if (!activeUser) {
      return;
    }

    options.onPrimaryAction(activeUser);
  });
  view.addEventListener('click', () => {
    if (!activeUser) {
      return;
    }

    options.onViewProfile(activeUser.nickname);
  });

  return {
    element,
    hide,
    scheduleHide,
    show(user: SocialUserSummary, anchor: HTMLElement, isBusy: boolean) {
      clearShowTimer();
      clearHideTimer();
      showTimer = window.setTimeout(() => {
        activeUser = user;
        const action = resolveQuickAction(user, options.i18n);
        const shouldHidePrimary = action.action === 'view';
        avatar.src = createSocialAvatar(user);
        avatar.alt = user.nickname;
        name.textContent = user.name;
        nickname.textContent = `@${user.nickname}`;
        status.className = `social-hover-card__status ${resolvePresenceTone(user.presence.status)}`;
        status.textContent = resolvePresenceLabel(user.presence.status, options.i18n);
        activity.textContent = `LVL ${resolveUserLevel(user)}`;
        memberSince.textContent = options.i18n.t('menu.social.hover.memberSince', {
          date: formatMemberSince(user.createdAt, options.i18n.getLocale()),
        });
        primary.hidden = shouldHidePrimary;
        primary.disabled = shouldHidePrimary || isBusy || action.disabled;
        primary.dataset.variant = action.action;
        primary.textContent = action.label;
        view.dataset.variant = 'view';
        view.disabled = isBusy;
        view.textContent = options.i18n.t('menu.social.actions.viewProfile');
        element.hidden = false;

        const rect = anchor.getBoundingClientRect();
        const width = 264;
        const height = 196;
        const top = Math.min(window.innerHeight - height - 12, rect.top + rect.height + 8);
        const left = Math.min(window.innerWidth - width - 12, rect.left + 18);

        element.style.top = `${Math.max(12, top)}px`;
        element.style.left = `${Math.max(12, left)}px`;
      }, 260);
    },
  };
}

import { createElementFromTemplate } from '@frontend/lib/html';
import type { SocialUserSummary } from '@frontend/services/social/social-types';
import type { AppI18n } from '@shared/i18n';

import {
  createSocialAvatar,
  formatMemberSince,
  resolveActivityLabel,
  resolvePresenceLabel,
  resolvePresenceTone,
  resolveProfileAction,
} from './social-formatters';

interface PublicProfilePanelOptions {
  i18n: AppI18n;
  onAction: (user: SocialUserSummary) => void;
}

interface PublicProfilePanelState {
  isBusy: boolean;
  profile: SocialUserSummary | null;
}

const template = `
  <section class="social-profile-panel">
    <div class="social-profile-panel__empty" data-profile-empty></div>
    <div class="social-profile-panel__content" data-profile-content hidden>
      <div class="social-profile-panel__hero">
        <img class="social-profile-panel__avatar" data-profile-avatar />
        <div class="social-profile-panel__identity">
          <p class="social-profile-panel__eyebrow"></p>
          <h2 class="social-profile-panel__nickname" data-profile-nickname></h2>
          <p class="social-profile-panel__name" data-profile-name></p>
          <span class="social-profile-panel__status" data-profile-status></span>
        </div>
      </div>

      <div class="social-profile-panel__meta">
        <div>
          <span class="social-profile-panel__meta-label"></span>
          <strong data-profile-member-since></strong>
        </div>
        <div>
          <span class="social-profile-panel__meta-label"></span>
          <strong data-profile-activity></strong>
        </div>
      </div>

      <button type="button" class="social-profile-panel__primary" data-profile-action></button>

      <section class="social-profile-panel__section">
        <p class="social-profile-panel__section-eyebrow"></p>
        <h3 class="social-profile-panel__section-title"></h3>
        <p class="social-profile-panel__section-copy"></p>
      </section>

      <div class="social-profile-panel__future">
        <article class="social-profile-panel__future-card">
          <span data-profile-future-rank-label></span>
          <strong data-profile-future-rank-value></strong>
        </article>
        <article class="social-profile-panel__future-card">
          <span data-profile-future-main-label></span>
          <strong data-profile-future-main-value></strong>
        </article>
        <article class="social-profile-panel__future-card">
          <span data-profile-future-track-label></span>
          <strong data-profile-future-track-value></strong>
        </article>
      </div>
    </div>
  </section>
`;

export function createPublicProfilePanel(options: PublicProfilePanelOptions) {
  const element = createElementFromTemplate(template);
  const empty = element.querySelector<HTMLElement>('[data-profile-empty]');
  const content = element.querySelector<HTMLElement>('[data-profile-content]');
  const avatar = element.querySelector<HTMLImageElement>('[data-profile-avatar]');
  const nickname = element.querySelector<HTMLElement>('[data-profile-nickname]');
  const name = element.querySelector<HTMLElement>('[data-profile-name]');
  const status = element.querySelector<HTMLElement>('[data-profile-status]');
  const memberSince = element.querySelector<HTMLElement>('[data-profile-member-since]');
  const activity = element.querySelector<HTMLElement>('[data-profile-activity]');
  const action = element.querySelector<HTMLButtonElement>('[data-profile-action]');

  if (
    !empty ||
    !content ||
    !avatar ||
    !nickname ||
    !name ||
    !status ||
    !memberSince ||
    !activity ||
    !action
  ) {
    throw new Error('Public profile panel could not be initialized.');
  }

  element.querySelectorAll<HTMLElement>('.social-profile-panel__meta-label')[0]!.textContent =
    options.i18n.t('menu.social.profile.memberSince');
  element.querySelectorAll<HTMLElement>('.social-profile-panel__meta-label')[1]!.textContent =
    options.i18n.t('menu.social.profile.currentActivity');
  element.querySelector<HTMLElement>('.social-profile-panel__eyebrow')!.textContent =
    options.i18n.t('menu.social.profile.eyebrow');
  element.querySelector<HTMLElement>('.social-profile-panel__section-eyebrow')!.textContent =
    options.i18n.t('menu.social.profile.sectionEyebrow');
  element.querySelector<HTMLElement>('.social-profile-panel__section-title')!.textContent =
    options.i18n.t('menu.social.profile.sectionTitle');
  element.querySelector<HTMLElement>('.social-profile-panel__section-copy')!.textContent =
    options.i18n.t('menu.social.profile.sectionSummary');
  element.querySelector<HTMLElement>('[data-profile-future-rank-label]')!.textContent =
    options.i18n.t('menu.social.profile.future.rankLabel');
  element.querySelector<HTMLElement>('[data-profile-future-rank-value]')!.textContent =
    options.i18n.t('menu.social.profile.future.rankValue');
  element.querySelector<HTMLElement>('[data-profile-future-main-label]')!.textContent =
    options.i18n.t('menu.social.profile.future.mainLabel');
  element.querySelector<HTMLElement>('[data-profile-future-main-value]')!.textContent =
    options.i18n.t('menu.social.profile.future.mainValue');
  element.querySelector<HTMLElement>('[data-profile-future-track-label]')!.textContent =
    options.i18n.t('menu.social.profile.future.trackLabel');
  element.querySelector<HTMLElement>('[data-profile-future-track-value]')!.textContent =
    options.i18n.t('menu.social.profile.future.trackValue');

  let activeProfile: SocialUserSummary | null = null;

  action.addEventListener('click', () => {
    if (!activeProfile) {
      return;
    }

    options.onAction(activeProfile);
  });

  return {
    element,
    setState(state: PublicProfilePanelState) {
      activeProfile = state.profile;
      empty.hidden = Boolean(state.profile);
      content.hidden = !state.profile;

      if (!state.profile) {
        empty.textContent = state.isBusy
          ? options.i18n.t('menu.social.profile.loading')
          : options.i18n.t('menu.social.profile.empty');
        return;
      }

      const profileAction = resolveProfileAction(state.profile, options.i18n);
      avatar.src = createSocialAvatar(state.profile);
      avatar.alt = state.profile.nickname;
      nickname.textContent = `@${state.profile.nickname}`;
      name.textContent = state.profile.name;
      status.className = `social-profile-panel__status ${resolvePresenceTone(
        state.profile.presence.status,
      )}`;
      status.textContent = resolvePresenceLabel(state.profile.presence.status, options.i18n);
      memberSince.textContent = formatMemberSince(
        state.profile.createdAt,
        options.i18n.getLocale(),
      );
      activity.textContent = resolveActivityLabel(state.profile, options.i18n);
      action.disabled = state.isBusy || profileAction.disabled;
      action.dataset.variant = profileAction.action;
      action.textContent = profileAction.label;
    },
  };
}


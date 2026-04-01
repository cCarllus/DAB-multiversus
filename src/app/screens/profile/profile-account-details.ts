import { createElementFromTemplate } from '@app/utils/html';
import type { AppI18n } from '@shared/i18n';
import type { AuthUser } from '@app/services/auth/auth-types';

export interface ProfileAccountDetailsSection {
  element: HTMLElement;
  setState: (input: {
    languageLabel: string;
    memberSince: string;
    profile: AuthUser;
  }) => void;
}

export function createProfileAccountDetails(
  i18n: AppI18n,
): ProfileAccountDetailsSection {
  const messages = i18n.getMessages().menu.profile;
  const element = createElementFromTemplate(`
    <section class="profile-panel profile-panel--details">
      <div class="profile-panel__head">
        <div>
          <p class="profile-panel__eyebrow">${messages.accountEyebrow}</p>
          <h2 class="profile-panel__title">${messages.accountTitle}</h2>
        </div>
      </div>

      <dl class="profile-details-list">
        <div class="profile-details-list__row">
          <dt>${messages.accountFields.displayName}</dt>
          <dd data-detail-name></dd>
        </div>
        <div class="profile-details-list__row">
          <dt>${messages.accountFields.userId}</dt>
          <dd data-detail-user-id></dd>
        </div>
        <div class="profile-details-list__row">
          <dt>${messages.accountFields.memberSince}</dt>
          <dd data-detail-member-since></dd>
        </div>
        <div class="profile-details-list__row">
          <dt>${messages.accountFields.language}</dt>
          <dd data-detail-language></dd>
        </div>
      </dl>
    </section>
  `);
  const nameValue = element.querySelector<HTMLElement>('[data-detail-name]');
  const userIdValue = element.querySelector<HTMLElement>('[data-detail-user-id]');
  const memberSinceValue = element.querySelector<HTMLElement>('[data-detail-member-since]');
  const languageValue = element.querySelector<HTMLElement>('[data-detail-language]');

  if (!nameValue || !userIdValue || !memberSinceValue || !languageValue) {
    throw new Error('Profile account details section could not be initialized.');
  }

  return {
    element,
    setState(input) {
      nameValue.textContent = input.profile.name;
      userIdValue.textContent = `@${input.profile.nickname}`;
      memberSinceValue.textContent = input.memberSince;
      languageValue.textContent = input.languageLabel;
    },
  };
}

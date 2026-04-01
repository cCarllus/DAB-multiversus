import { createElementFromTemplate } from '@app/utils/html';
import type { AppI18n } from '@shared/i18n';

export interface ProfileOverviewSection {
  element: HTMLElement;
  setState: (input: {
    currentDeviceLabel: string;
    languageLabel: string;
    launcherStatus: string;
    trustedDeviceStatus: string;
  }) => void;
}

export function createProfileOverview(i18n: AppI18n): ProfileOverviewSection {
  const messages = i18n.getMessages().menu.profile;
  const element = createElementFromTemplate(`
    <section class="profile-panel profile-panel--overview" aria-label="${messages.overviewAriaLabel}">
      <div class="profile-panel__head">
        <div>
          <p class="profile-panel__eyebrow">${messages.overviewEyebrow}</p>
          <h2 class="profile-panel__title">${messages.overviewTitle}</h2>
        </div>
        <p class="profile-panel__summary">${messages.overviewSummary}</p>
      </div>

      <div class="profile-overview-grid">
        <article class="profile-overview-card">
          <span class="profile-overview-card__label">${messages.overviewCards.launcherStatus.label}</span>
          <strong class="profile-overview-card__value" data-overview-launcher-status></strong>
          <span class="profile-overview-card__meta">${messages.overviewCards.launcherStatus.meta}</span>
        </article>

        <article class="profile-overview-card">
          <span class="profile-overview-card__label">${messages.overviewCards.trustedDevice.label}</span>
          <strong class="profile-overview-card__value" data-overview-trusted-device></strong>
          <span class="profile-overview-card__meta">${messages.overviewCards.trustedDevice.meta}</span>
        </article>

        <article class="profile-overview-card">
          <span class="profile-overview-card__label">${messages.overviewCards.currentDevice.label}</span>
          <strong class="profile-overview-card__value" data-overview-current-device></strong>
          <span class="profile-overview-card__meta">${messages.overviewCards.currentDevice.meta}</span>
        </article>

        <article class="profile-overview-card">
          <span class="profile-overview-card__label">${messages.overviewCards.language.label}</span>
          <strong class="profile-overview-card__value" data-overview-language></strong>
          <span class="profile-overview-card__meta">${messages.overviewCards.language.meta}</span>
        </article>
      </div>

      <div class="profile-overview-callout">
        <span class="profile-overview-callout__eyebrow">${messages.future.eyebrow}</span>
        <p class="profile-overview-callout__text">${messages.future.summary}</p>
      </div>
    </section>
  `);
  const launcherStatus = element.querySelector<HTMLElement>('[data-overview-launcher-status]');
  const trustedDevice = element.querySelector<HTMLElement>('[data-overview-trusted-device]');
  const currentDevice = element.querySelector<HTMLElement>('[data-overview-current-device]');
  const language = element.querySelector<HTMLElement>('[data-overview-language]');

  if (!launcherStatus || !trustedDevice || !currentDevice || !language) {
    throw new Error('Profile overview section could not be initialized.');
  }

  return {
    element,
    setState(input) {
      launcherStatus.textContent = input.launcherStatus;
      trustedDevice.textContent = input.trustedDeviceStatus;
      currentDevice.textContent = input.currentDeviceLabel;
      language.textContent = input.languageLabel;
    },
  };
}

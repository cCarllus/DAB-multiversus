import { createElementFromTemplate } from '@app/utils/html';
import type { AppI18n } from '@shared/i18n';

export interface DeviceListItem {
  label: string;
  meta: string;
  state: string;
}

export interface ProfileDeviceStatusSection {
  element: HTMLElement;
  setState: (input: {
    currentDeviceMeta: string;
    currentDeviceStatus: string;
    lastActiveMeta: string;
    lastActiveStatus: string;
    recentDevices: DeviceListItem[];
    trustedDeviceStatus: string;
  }) => void;
}

function renderDeviceList(items: DeviceListItem[]): string {
  return items
    .map(
      (item) => `
        <li class="profile-device-list__item">
          <div>
            <strong class="profile-device-list__label">${item.label}</strong>
            <span class="profile-device-list__meta">${item.meta}</span>
          </div>
          <span class="profile-device-list__state">${item.state}</span>
        </li>
      `,
    )
    .join('');
}

export function createProfileDeviceStatus(
  i18n: AppI18n,
): ProfileDeviceStatusSection {
  const messages = i18n.getMessages().menu.profile;
  const element = createElementFromTemplate(`
    <section class="profile-panel profile-panel--devices">
      <div class="profile-panel__head">
        <div>
          <p class="profile-panel__eyebrow">${messages.devicesEyebrow}</p>
          <h2 class="profile-panel__title">${messages.devicesTitle}</h2>
        </div>
        <p class="profile-panel__summary">${messages.devicesSummary}</p>
      </div>

      <div class="profile-device-status">
        <article class="profile-device-status__card">
          <span class="profile-device-status__label">${messages.deviceCards.trustedDevice.label}</span>
          <strong class="profile-device-status__value" data-device-trusted></strong>
          <span class="profile-device-status__meta">${messages.deviceCards.trustedDevice.meta}</span>
        </article>

        <article class="profile-device-status__card">
          <span class="profile-device-status__label">${messages.deviceCards.currentDevice.label}</span>
          <strong class="profile-device-status__value" data-device-current></strong>
          <span class="profile-device-status__meta" data-device-current-meta></span>
        </article>

        <article class="profile-device-status__card">
          <span class="profile-device-status__label">${messages.deviceCards.lastActive.label}</span>
          <strong class="profile-device-status__value" data-device-last-active></strong>
          <span class="profile-device-status__meta" data-device-last-active-meta></span>
        </article>
      </div>

      <ul class="profile-device-list" data-device-list></ul>
    </section>
  `);
  const trustedDevice = element.querySelector<HTMLElement>('[data-device-trusted]');
  const currentDevice = element.querySelector<HTMLElement>('[data-device-current]');
  const currentDeviceMeta = element.querySelector<HTMLElement>('[data-device-current-meta]');
  const lastActive = element.querySelector<HTMLElement>('[data-device-last-active]');
  const lastActiveMeta = element.querySelector<HTMLElement>('[data-device-last-active-meta]');
  const deviceList = element.querySelector<HTMLElement>('[data-device-list]');

  if (
    !trustedDevice ||
    !currentDevice ||
    !currentDeviceMeta ||
    !lastActive ||
    !lastActiveMeta ||
    !deviceList
  ) {
    throw new Error('Profile device status section could not be initialized.');
  }

  return {
    element,
    setState(input) {
      trustedDevice.textContent = input.trustedDeviceStatus;
      currentDevice.textContent = input.currentDeviceStatus;
      currentDeviceMeta.textContent = input.currentDeviceMeta;
      lastActive.textContent = input.lastActiveStatus;
      lastActiveMeta.textContent = input.lastActiveMeta;
      deviceList.innerHTML = renderDeviceList(input.recentDevices);
    },
  };
}

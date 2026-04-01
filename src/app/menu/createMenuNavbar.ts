import { createElementFromTemplate } from '@app/utils/html';

import menuNavbarTemplate from './menu-navbar.html?raw';

interface CreateMenuNavbarOptions {
  brandImage: string;
}

export function createMenuNavbar(options: CreateMenuNavbarOptions): HTMLElement {
  return createElementFromTemplate(menuNavbarTemplate, {
    TOPBAR_BRAND_IMAGE: options.brandImage,
  });
}

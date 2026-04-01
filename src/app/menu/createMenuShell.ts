import { createElementFromTemplate } from '@app/utils/html';

import { createMenuFooterBar } from './createMenuFooterBar';
import { createMenuNavbar } from './createMenuNavbar';

import menuShellTemplate from './menu-shell.html?raw';
import '@app/pages/home/home.css';

interface CreateMenuShellOptions {
  brandImage: string;
  content: HTMLElement;
  musicMuted: boolean;
}

export function createMenuShell(options: CreateMenuShellOptions): HTMLElement {
  const rootElement = createElementFromTemplate(menuShellTemplate);
  const frame = rootElement.querySelector<HTMLElement>('[data-menu-frame]');

  if (!frame) {
    throw new Error('Menu shell frame could not be initialized.');
  }

  frame.append(
    createMenuNavbar({
      brandImage: options.brandImage,
    }),
    options.content,
    createMenuFooterBar({
      musicMuted: options.musicMuted,
    }),
  );

  return rootElement;
}

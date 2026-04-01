import { bootstrapApplication } from '@app/bootstrap/bootstrapApplication';
import { createI18n, getInitialLocale } from '@shared/i18n';

import './styles/global.css';

const appRoot = document.querySelector<HTMLElement>('#app');

if (!appRoot) {
  throw new Error('Application root element "#app" was not found.');
}

try {
  bootstrapApplication(appRoot);
} catch (error: unknown) {
  const i18n = createI18n(getInitialLocale());
  const messages = i18n.getMessages();

  console.error('Failed to bootstrap Dead As Battle Multiversus.', error);
  appRoot.innerHTML = `
    <section class="fatal-screen">
      <p class="fatal-screen__eyebrow">${messages.fatal.eyebrow}</p>
      <h1>${messages.fatal.title}</h1>
      <p>${messages.fatal.description}</p>
    </section>
  `;
}

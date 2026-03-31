import { bootstrapApplication } from '@app/bootstrap/bootstrapApplication';

import './styles/global.css';

const appRoot = document.querySelector<HTMLElement>('#app');

if (!appRoot) {
  throw new Error('Application root element "#app" was not found.');
}

try {
  bootstrapApplication(appRoot);
} catch (error: unknown) {
  console.error('Failed to bootstrap Dead As Battle Multiversus.', error);
  appRoot.innerHTML = `
    <section class="fatal-screen">
      <p class="fatal-screen__eyebrow">BOOT FAILURE</p>
      <h1>Dead As Battle could not initialize.</h1>
      <p>Open the developer console for the crash details and review the bootstrap pipeline.</p>
    </section>
  `;
}

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [tailwindcss()],
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@frontend': path.resolve(projectRoot, 'app/frontend'),
      '@game': path.resolve(projectRoot, 'app/game'),
      '@shared': path.resolve(projectRoot, 'app/shared'),
      '@desktop': path.resolve(projectRoot, 'app/desktop'),
      '@assets': path.resolve(projectRoot, 'app/frontend/assets'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    target: 'es2022',
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0'),
  },
});

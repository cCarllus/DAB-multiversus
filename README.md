# Dead As Battle Multiversus

Desktop-first foundation for a Babylon.js + Electron version of Dead As Battle. The repository is organized as one product tree, with desktop shell, launcher frontend, Babylon runtime, backend API, and shared contracts living under the same top-level application structure.

## Stack

- Vite
- TypeScript
- Babylon.js
- Electron
- ESLint
- Prettier
- Express
- PostgreSQL
- Docker

## Scripts

- `npm run dev`: start Vite, compile Electron in watch mode, and launch the desktop shell
- `npm run dev:backend`: start the backend API with `tsx`
- `npm run build`: build renderer and Electron bundles
- `npm run build:backend`: compile the backend bundle
- `npm run dist`: package the desktop app with `electron-builder`
- `npm run lint`: run ESLint
- `npm run typecheck`: run TypeScript checks for frontend, game, Electron, backend, and config files
- `npm run format`: format the repo with Prettier

## Architecture

```text
app/
  desktop/   -> Electron main and preload processes
  frontend/  -> launcher screens, layout, services, stores, UI assets
  game/      -> Babylon runtime, scenes, camera, world, systems
  backend/   -> controllers, routes, services, repositories, validators
  shared/    -> shared contracts, constants, i18n, portable types
config/      -> env, Vite, Electron build resources, ESLint
db/          -> migrations, seeds, schema, raw queries
storage/     -> uploads, cache, logs
tests/       -> frontend, backend, integration
```

## Current Foundation

- Branded home screen designed as a desktop game front-end
- DOM-first menu/navigation layer over a Babylon atmosphere canvas
- App-level audio service with procedural hover, click, and transition cues
- Secure Electron shell with isolated preload bridge
- Future-ready separation between app shell and game runtime

## Next Steps

1. Replace the remaining launcher-specific placeholder data with real product services.
2. Promote runtime schema bootstrap into explicit `db/migrations` and `db/schema` assets.
3. Wire the `Play` flow into the Babylon runtime handoff under `app/game/`.
4. Expand settings, social, and profile flows under `app/frontend/screens/`.

# Dead As Battle Multiversus

Desktop-first foundation for a Babylon.js + Electron version of Dead As Battle. This repository starts with the product shell: home screen, navigation, audio foundation, Electron bootstrap, and a Babylon-powered atmosphere scene.

## Stack

- Vite
- TypeScript
- Babylon.js
- Electron
- ESLint
- Prettier

## Scripts

- `npm run dev`: start Vite, compile Electron in watch mode, and launch the desktop shell
- `npm run build`: build renderer and Electron bundles
- `npm run dist`: package the desktop app with `electron-builder`
- `npm run lint`: run ESLint
- `npm run typecheck`: run TypeScript checks for renderer, Electron, and config files
- `npm run format`: format the repo with Prettier

## Architecture

```text
src/
  app/       -> product shell, screens, navigation, audio, DOM layout
  game/      -> Babylon runtime, scene bootstrap, world, systems, camera
  shared/    -> shared types, storage keys, product config
  electron/  -> Electron main and preload processes
  assets/    -> images, audio, fonts, models
```

## Current Foundation

- Branded home screen designed as a desktop game front-end
- DOM-first menu/navigation layer over a Babylon atmosphere canvas
- App-level audio service with procedural hover, click, and transition cues
- Secure Electron shell with isolated preload bridge
- Future-ready separation between app shell and game runtime

## Next Steps

1. Replace procedural audio with shipped menu assets in `src/assets/audio`.
2. Add real models and GLB-based world assembly in `src/assets/models`.
3. Wire the `Play` route into a dedicated gameplay handoff and scene loader.
4. Expand settings, player profile, and hero data sources.

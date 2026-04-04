====================================================
HARD RULE
====================================================

If a change violates the project structure or architecture rules:
→ DO NOT IMPLEMENT IT

Instead:
→ refactor or adjust the approach

====================================================
PROJECT STRUCTURE ENFORCEMENT (MANDATORY)
====================================================

The project follows a STRICT folder architecture.

This structure is NOT optional.
AI agents MUST respect it at all times.

----------------------------------------------------
ROOT STRUCTURE
----------------------------------------------------

DAB-Multiversus/

app/
  desktop/      → Electron (main + preload)
  frontend/     → Launcher UI
  game/         → Babylon.js game logic
  backend/      → Node.js API
  shared/       → shared types/contracts

assets/         → official project assets (versioned in Git)
  shared/       → branding, icons, fonts used by multiple layers
  frontend/     → launcher-only images, audio, video
  game/         → character art, card images, HUD, game audio
  desktop/      → Electron build resources, app icons

config/         → project configuration
db/             → database schema/migrations
storage/        → local runtime files only (git-ignored)
tests/          → automated tests
scripts/        → automation scripts

----------------------------------------------------
STRICT PLACEMENT RULES
----------------------------------------------------

1. FRONTEND (UI / LAUNCHER)
→ MUST live in: app/frontend/

Includes:
- screens
- components
- layout
- styles
- UI interactions

DO NOT:
- place backend logic here
- place DB logic here

----------------------------------------------------

2. BACKEND (API / BUSINESS LOGIC)
→ MUST live in: app/backend/

Includes:
- controllers
- services
- repositories
- validators
- middleware

DO NOT:
- include UI logic
- include DOM manipulation
- include Babylon/game logic

----------------------------------------------------

3. GAME (BABYLON.JS)
→ MUST live in: app/game/

Includes:
- scenes
- systems
- camera
- world
- gameplay logic

DO NOT:
- mix with frontend UI
- mix with backend logic

----------------------------------------------------

4. DATABASE
→ MUST live in: db/

Includes:
- migrations
- schema
- seeds
- queries

RULES:
- ALL schema changes must go through migrations
- NEVER modify DB structure manually in runtime code

----------------------------------------------------

5. STORAGE
→ MUST live in: storage/
→ Local runtime only — NEVER committed to Git

Includes:
- uploads/avatars (user-uploaded avatars)
- cache
- logs

DO NOT:
- store binary data inside database
- store official project assets here (they will be git-ignored)

NOTE: storage/uploads/characters/ is intentionally empty.
Character portraits live in assets/game/characters/ (versioned).

----------------------------------------------------

6. SHARED
→ MUST live in: app/shared/

Includes:
- types
- constants
- contracts
- shared utilities

RULE:
- must be framework-agnostic
- must NOT depend on frontend/backend directly

----------------------------------------------------

7. CONFIG
→ MUST live in: config/

Includes:
- environment configs
- vite config
- electron config
- eslint config

DO NOT:
- mix runtime logic here

----------------------------------------------------

8. TESTS
→ MUST live in: tests/

Structure:
- frontend/
- backend/
- integration/

RULE:
- tests must mirror the real structure

----------------------------------------------------
STRICT ENFORCEMENT RULE
----------------------------------------------------

When creating or modifying code:

ALWAYS ask:

- Does this belong to frontend, backend, game, or shared?
- Is it in the correct folder?

If NOT:
→ MOVE IT

Never leave code in the wrong place "temporarily".

====================================================
9. ASSETS (OFFICIAL / VERSIONED)
====================================================

→ MUST live in: assets/
→ ALWAYS committed to Git

Structure:
  assets/shared/    → branding, icons, fonts used by 2+ layers
  assets/frontend/  → launcher-only images, audio, video
  assets/game/      → character portraits, card art, HUD, game audio
  assets/desktop/   → Electron build resources, app icons

RULES:
- Fixed official content MUST live in assets/ (versioned in Git)
- User uploads MUST go to storage/ (dev) or Cloudinary (production)
- NEVER put official assets in storage/ — they will be git-ignored
- NEVER put user uploads in assets/
- Character/card images → assets/game/characters/
- Shared branding, logo, fonts → assets/shared/
- Future Cloudinary uploads → NOT assets/, NOT storage/

Vite alias: @assets → root assets/ directory
Backend: official assets served at /assets (Express static)
Avatars: user uploads served at /uploads (Express static, from storage/)

DO NOT:
- create assets/backend/ (no backend-only assets exist)
- mix upload logic with official asset logic
- leave official game art in git-ignored folders

====================================================
FILE CREATION RULE
====================================================

When creating new files:

- place them in the correct domain folder
- name them clearly
- ensure single responsibility

Avoid:
- random files in root
- duplicated modules in different folders
- "temporary" helper files

====================================================
DATABASE CHANGE RULE
====================================================

When modifying database:

1. ALWAYS create a migration
2. NEVER directly alter schema in code
3. NEVER rely on runtime schema hacks

Migrations must be:
- versioned
- reversible (when possible)
- clear and minimal

====================================================
FRONTEND VS BACKEND STRICT BOUNDARY
====================================================

Frontend:
- consumes API
- renders UI

Backend:
- handles logic
- talks to DB

NEVER:
- frontend accessing DB directly
- backend rendering UI

====================================================
FINAL STRUCTURE GOAL
====================================================

The project structure must feel:

- predictable
- consistent
- scalable
- easy to navigate

A developer should always know:
"where something belongs" without guessing.
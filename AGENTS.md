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

config/         → project configuration
db/             → database schema/migrations
storage/        → uploads/files
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

Includes:
- uploads (images, avatars, assets)
- cache
- logs

DO NOT:
- store binary data inside database

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
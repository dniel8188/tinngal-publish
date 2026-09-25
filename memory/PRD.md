# PRD — Arsa Wedding Gallery (repo: dniel8188/fix-jadi)

## Original Problem Statement
Clone & run the existing Emergent full-stack app `dniel8188/fix-jadi` (branch `main`) inside this Emergent environment.
Stack: FastAPI (Python) + React 19 / Vite / TypeScript + MongoDB.
User choices: run in this environment (not local), local MongoDB, activate AI via Universal Key if needed, deploy later.

## Architecture
- **Backend** (`/app/backend`, FastAPI, port 8001 via supervisor `uvicorn server:app`)
  - Routers: `clients` (guest gallery), `admin` (PIN auth + CRUD + Drive sync + upload), `settings`, `uploads`.
  - Auth: single shared **PIN** (`ADMIN_PIN`), httpOnly cookie session (HMAC of `SESSION_SECRET`).
  - Google Drive photo sync via `GOOGLE_DRIVE_API_KEY` (poller every `DRIVE_POLL_SECONDS`).
  - Image uploads stored in MongoDB (Pillow-compressed JPEG), served at `/api/uploads/{id}`.
- **Frontend** (`/app/frontend`, React 19 + Vite 8 + TS, port 3000 via supervisor `yarn start`)
  - Calls relative `/api/*`, Vite proxies to `:8001` (single-origin in prod).
  - Pages: Home (hero + gallery folders), Gallery (photo grid + lightbox), Admin.
- **DB**: MongoDB local. `DB_NAME=fixjadi`. Collections: clients, photos, uploads, settings, status_checks.

## Env (backend/.env)
MONGO_URL, DB_NAME=fixjadi, CORS_ORIGINS=*, SESSION_SECRET, ADMIN_PIN=246810, DRIVE_POLL_SECONDS=60, APP_TZ=Asia/Jakarta, GOOGLE_DRIVE_API_KEY="" (empty — live Drive sync disabled; demo seed used instead)

## Status (2026-06 setup session)
- Repo migrated into /app (platform .git/.emergent preserved).
- Backend deps installed (incl. emergentintegrations via extra index — present but unused in code).
- Frontend deps installed (yarn), Vite running on 3000.
- DB seeded: 6 clients / 162 photos.
- ✅ Verified: backend 15/15 pytest pass; frontend Home/Gallery/Admin flows pass; admin login PIN 246810 works.

## Backlog / Next
- P1: Add real Google Drive API key to enable live folder sync.
- P2: Guard the Drive poller to no-op when GOOGLE_DRIVE_API_KEY is empty (avoid benign warnings).
- P2: Delete stale root-level backend_test.py (superseded by backend/tests/backend_test.py).
- P2: Deployment prep when user is ready.

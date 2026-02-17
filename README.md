# School ERP (Phase 1 Local)

Professional, teacher-centric ERP for internal academic workflows. This repository contains a production-grade foundation with clean separation between UI, API, and data access, designed for local-only deployment in Phase 1 and cloud/ML readiness in later phases.

## Stack
- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Storage: SQLite (local file)

## Goals
- Minimal clicks and fast data entry for teachers
- Strong auditability with no silent overwrites
- Clean, replaceable data access layer
- Analytics-first dashboard

## Structure
- docs: Architecture, schema, API design, UI map, analytics
- client: Frontend app
- server: Backend API and SQLite data layer

## Local Setup (Phase 1)
- Install Node.js 18+.
- In `server`, run `npm install` then `npm run dev`.
- In `client`, run `npm install` then `npm run dev`.
- Default server port: 4000.
- Default client port: 5173.

## Admin Bootstrap (No Dummy Data)
- Run `npm run db:init` in `server`.
- Create the first admin user:
  - `ADMIN_EMAIL=admin@school.local ADMIN_PASSWORD=ChangeMe123 npm run db:seed-admin`

## Import Real Data (CSV)
- `npm run db:import -- classes <path>`
- `npm run db:import -- subjects <path>`
- `npm run db:import -- students <path>`
- `npm run db:import -- exams <path>`
- `npm run db:import -- marks <path>`
- `npm run db:import -- leave-types <path>`

Templates are in `docs/import-templates`.

## Notes
- Auth is stubbed for Phase 1 local usage. Replace with secure auth provider in Phase 2.
- Data access is abstracted through repositories to allow future DB migration.
- Analytics are implemented as query-based summaries with clear extension points.

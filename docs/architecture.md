# Architecture

## High-Level Overview
- Client UI (React) for teachers and admin teachers only.
- API server (Express) with module boundaries per domain.
- SQLite database with strict schema and audit logging.
- Export service for PDF/CSV (Phase 1: local file output).

## Core Principles
- Domain-driven module structure with repository-service-controller layers.
- RBAC enforced at route and service levels.
- No silent overwrites. All edits go through audit log.
- Replaceable data access layer for future cloud migration.

## System Diagram (Text)
- UI -> API Gateway (Express) -> Services -> Repositories -> SQLite
- UI -> Local storage cache (drafts, autosave)
- API -> Export service -> Filesystem

## Modules
- Auth and Profiles
- Attendance
- Exams and Marks
- Analytics
- Leave
- Dashboard and Analytics
- Audit and Activity

## Data Flow
- Teacher logs in -> receives scope (classes, subjects, role).
- Teacher enters attendance -> saved as draft -> submitted -> audit entry created.
- Marks entry -> validation -> derived totals and grades -> analytics refreshed.
- Dashboard aggregates per teacher scope and admin scope.

## Security
- RBAC checks for every write endpoint.
- Per-teacher scope enforcement on all reads.
- Input validation at route boundary.
- Audit logs for edits with old and new values.

## Phase 1 Deployment
- Single local machine or school LAN.
- SQLite stored in local path `server/data/erp.sqlite`.
- No external network dependencies.

## Phase 2 Readiness
- Repository interfaces allow switching to Postgres or cloud DB.
- Config-driven environment settings.
- Service boundaries compatible with future microservices.
- Analytics layer structured for batch/ML pipelines.

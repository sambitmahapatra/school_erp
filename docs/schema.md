# Database Schema (Phase 1)

SQLite schema is defined in `server/src/db/schema.sql` and built for local, offline-first usage. The schema emphasizes auditability, clear separation of concerns, and future migration readiness.

## Entity Overview
- Users, roles, permissions
- Auth sessions (token-based)
- Teacher profiles
- Academic structure (years, terms, classes, subjects, students)
- Assignments and scope
- Attendance sessions and entries with audit
- Exams, components, and marks
- Teacher notes and flags
- Leave management
- Alerts and activity log

## Notes
- All timestamps stored as ISO-8601 strings.
- Attendance and marks are recorded per session or exam component for full traceability.
- Audit tables capture previous values and change rationale.

## Schema (Excerpt)
See `server/src/db/schema.sql` for the full definition.

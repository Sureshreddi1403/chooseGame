# Multi-Sport Application Architecture — Enterprise Use Case Scope Matrix

## Architectural Intent Blueprint

This document captures the baseline techno-functional matrix mapping for the MultiSport court allocation and matchmaking platform. It separates MVP requirements (P0) from enterprise governance controls (P1/P2) and lists practical implementation guidance for each area.

Priority Grouping
- P0 - Critical: Minimum Viable Product (Core Architecture & Handshakes) — 12 use cases
- P1 - High: Phase 2 Pipeline (User Experience & Verification Scaling) — 7 use cases
- P2 - Medium: Phase 3 Enterprise Controls (SOX Controls, Lockouts, & Retention Lifecycle) — 2 use cases
- Total enterprise scope: 21

## P0 — Core Architecture (MVP) (12 use cases)
Focus: user auth, venue discovery, booking flow, basic RLS, geolocation, map integration, public APIs, basic observability.

Key components and actions:
- Frontend: Angular SPA with routes `auth`, `home`, `venues`, `games`.
- Backend: Node.js + Express API exposing `/api/*` endpoints and using Supabase client for DB operations.
- Auth: Supabase Auth for identity; server-side profile sync on register/login.
- Database: PostgreSQL (Supabase) with core tables: `profiles`, `venues`, `games`, `bookings`, `sports`, `trainers`.
- RLS: Basic row-level policies so authenticated users can read public venue data; write access limited to service role for privileged operations.
- Map/Location: Browser geolocation + Google Maps JS (API key set in `frontend/src/environments/environment.ts`).

Deliverables:
- Implement venue list + nearby filter (10 km radius) — done in `home-page`.
- Backend `/api/venues` to return venue coordinates — already present, now also supporting optional location-based radius filtering.
- New `/api/play-requests` endpoint for scheduling game interest requests and notifying nearby players.
- Supabase migrations: baseline schema in `supabase/migrations/001_initial_schema.sql` plus profile and play request extensions in `supabase/migrations/003_add_profile_fields_and_play_requests.sql`.

## P1 — Verification & UX Scaling (7 use cases)
Focus: stronger verification, account recovery UX, payment flow readiness, search scaling.

Recommendations:
- Add email verification steps enforced by backend before creating sensitive profile attributes.
- Add server-side rate-limiting on auth endpoints.
- Add search index or materialized view for geospatial queries (PostGIS/pg_trgm) as dataset grows.
- Add pagination and lazy-loading on venue lists.

## P2 — Enterprise Controls (2 use cases)
Focus: SOX readiness and data retention/locking.

Recommendations:
- Implement audit log table and immutable append-only writes for transactional changes to bookings (user_id, action, changed_at, diff).
- Add retention lifecycle jobs (archive and purge) and legal hold mechanisms.

## Implementation Checklist (recommended repo changes)
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` and environment variables are set for backend local dev (`backend/.env`).
- [ ] Harden `src/routes/auth.ts` to validate and normalize incoming payloads; ensure typing compatibility with Supabase SDK responses.
- [ ] Add RLS policies in `supabase/migrations` for `profiles`, `bookings`, `venues` and include example policy SQL.
- [ ] Add PostGIS (or pg_trgm) index migration for fast radius searches if needed.
- [ ] Add server-side endpoint for radius search (accepts lat/lng & radius) — returns sorted by distance.
- [ ] Frontend: expose `environment.googleMapsApiKey` and document where to place the key.
- [ ] Frontend: improve `home-page` to show categories, sport chips, and quick booking CTA.
- [ ] Add observability: Prometheus metrics or simple request logging and error tracking (Sentry).

## UX & Spec Mapping
Follow the Application Screen Spec Sheet (AuthPage) for form variable names and validation rules. The `auth` page implementation in `frontend/src/app/pages/auth-page` already follows these variable names and validation rules as the implemented spec.

## Next Steps
1. Review this document and confirm priorities for P0 vs P1 features you want implemented first.
2. I can open PR-style changes for any of the checklist items (for example: add radius-search endpoint, add RLS SQL, or wire Google Maps fully).

---

Created: Auto-generated architecture summary. For detailed policy SQL or audit schema examples, ask and I will add them to `supabase/migrations/`.

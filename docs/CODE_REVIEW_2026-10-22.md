# KadroRadar — Source review and safe next step (2026-10-22)

## Scope
Reviewed uploaded `apps.zip`, including every non-dependency source/config file: NestJS API, Prisma schema/migration, importer and tests, Expo mobile screens, React admin shell, shared packages, Docker Compose, README, and project instructions. `node_modules` artifacts are not source; uploaded local `.env` files are intentionally excluded from this deliverable.

## Confirmed through user's local terminal
- Docker PostgreSQL is running; initial migration applied; 8 tables exist.
- 504 rows from 2024/1 bachelor ÖSYM result PDF are present in `HistoricalPlacement`.
- Approval counts: 0 approved, 504 unapproved.
- NestJS endpoint `/api/v1/historical/placements` responds 200 with an empty public list, consistent with the approval gate.

## Source audit findings
1. **Critical:** original `/historical/placements/:id` returned an unapproved row by ID. Fixed: only approved rows now visible, with 404 for nonpublic IDs.
2. Original list exposed only city/title filtering, with unvalidated broad query params. Improved: bounded pagination, year/round/education/institution/city/title/score filters; safe selected fields and source metadata.
3. `psycopg.connect()` did not read Prisma `DATABASE_URL`; it depended on PG* environment variables. Fixed: PostgreSQL URL is passed explicitly and Prisma `schema=public` option stripped for psycopg; PG* fallback remains.
4. Import parser tests checked only 2 reference rows and count integrity. Added connection-string unit tests. **Still requires manual PDF sampling and DB integration test before publishing.**
5. Importer stages rows but re-import still produces extra `ImportBatch`/`ImportRow` sets, although historical placements have an ON CONFLICT guard. Full idempotency is outstanding.
6. Admin UI is static: no auth, RBAC, audit log, source review, approval/rejection operations. Never publish unapproved data directly by SQL.
7. Mobile app is an initial 1-page listing: no pagination, request cancellation, loading/empty distinctions, deep links, or verified on-device behavior. API address `10.0.2.2` only works in Android emulator, not physical device.
8. User/CandidateProfile tables exist but no login/auth/profile endpoints. Announcements endpoint is intentionally empty. No matching engine or live source integration.
9. Root `pnpm dev:api` references `start:dev` but current API `package.json` has `dev`, not `start:dev`. Run `pnpm --filter @kadro/api dev` or repair root script.
10. **Sensitive information:** uploaded archive included local `.env` settings. This deliverable excludes the local `.env`; avoid posting production tokens/passwords.

## Changes in this revision
- `apps/api/src/module.ts`: public read security fix, filtered paginated queries, whitelisted projected fields.
- `services/ingest/import_historical.py`: Prisma DATABASE_URL support.
- `services/ingest/tests/test_parser.py`: connection-string unit tests.

## Tests run here
`python -m unittest discover -s services/ingest/tests -v` => 5/5 pass. No Docker daemon or installed workspace node_modules available in this container; NestJS build/runtime and database migration were **not** reverified for the patched code. User should run `pnpm --filter @kadro/api build` and `pnpm --filter @kadro/api dev` locally.

## Safe next development milestone
Build **authenticated admin import-batch review and approval** with server-side roles, audit events, verified source checks, explicit confirmation, and API integration tests. Only then publish reviewed rows. No existing DB data or migration should be reset. The actual ÖSYM position qualification tables must be matched before eligibility claims.

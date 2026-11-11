# Migration 16 production execution operator

## Scope and current decision

This change prepares an operator; it does not execute production migration. No production connection, write, backup, deployment, push, EAS build or email was performed by this task.

The user reports BEFORE PASS (15 applied, 8,611 historical placements, one active SYSTEM_ADMIN) and VERIFIED backup `bd4bbd1c-7210-4255-81eb-ed2c787558cf` with independent PostgreSQL 16 restore. This report does not claim to have inspected that private production receipt or its current freshness. The operator checks it at execution time.

GO for isolated technical validation. Production execution remains conditional: explicit operator approval, a fresh matching VERIFIED BEFORE backup, an unchanged source snapshot, exact target and all guards must pass. Otherwise NO-GO. This is not authorization to deploy the backend or enable account recovery, registration or source automation.

## Exact operator steps

1. Review this local code and the approved migration. Use the project root and locked Prisma 6.19.3 dependencies. Keep the trusted backup directory and its `database.dump` / `receipt.json` together under `.local/migration16-backups/<operationId>/`. Do not copy them into Git or chat.
2. Arrange a quiet maintenance window. Any change to any of the 19 pre-migration tables after the backup causes rejection. A backup older than 24 hours, future-dated, incomplete, failed or mismatched is rejected. Obtain a new independently verified backup using the existing backup procedure when necessary; this deploy tool never creates one.
3. Optionally perform the non-writing inspection:

```powershell
Set-Location C:\projects\KadroRadar
.\infra\migration16-deploy.ps1 -Action inspect -BackupOperationId bd4bbd1c-7210-4255-81eb-ed2c787558cf
```

4. Only after the separate production approval, run:

```powershell
.\infra\migration16-deploy.ps1 -Action apply -BackupOperationId bd4bbd1c-7210-4255-81eb-ed2c787558cf
```

Enter the exact Render external hostname and database name. Enter the External Database URL only into the hidden terminal prompt. Port is 5432. Never paste credentials into arguments, reports or chat. The tool prints a confirmation containing the exact target, backup ID, migration name and SQL SHA; type that exact confirmation to allow the migration. An inspection does not carry approval into a later run.

5. Require `SUCCEEDED`, applied=16, historicalPlacements=8611, the unchanged active administrator count, and CLI target proof fields. Preserve the private result and original backup. A fresh run on an already valid 16-migration database returns read-only `NO_OP`; it does not rerun SQL.

## Guard chain and Prisma target evidence

The approved migration is only `20261031000100_account_recovery`, normalized LF SHA-256 `e706db2cb2241c09919c0a3c96abdc862227956b84c932b71bc2b36318a53ead`. Original SQL is unchanged. The local manifest must contain exactly the approved 16 migrations; the database must contain exactly the first 15, finished with matching checksums and no rollback. Strict before/after catalog profiles reject unexpected schema states.

The production CLI path requires Windows, an exact `dpg-*.render.com` hostname/database/5432 match, explicit credentials and verified TLS. There is no localhost or `.env` fallback. Unexpected URL routing/options and datasource redirects are rejected. SSL verification is not weakened. The isolated helper accepts only a disposable loopback database with a test-specific name.

Preparation validates the backup dump size/hash, receipt contract, restore verification, manifest/catalog checksums, target fingerprint and complete source count/hash snapshot. It binds them into a private 10-minute plan. After confirmation these checks run again. One exclusive session advisory lock prevents concurrent runs of this operator. The attempt marker is write-once: a started plan cannot be retried.

Prisma CLI uses a private staged schema and the exact 16 checked migration files; only the staged datasource environment variable name changes. The installed CLI/client must both be 6.19.3. No seed/import/reset/db-push/resolve command is invoked. Ambient direct/shadow URLs and engine overrides are removed from the child environment.

Before releasing the migration gate, the observer holds a SHARE lock on User and verifies the marked Prisma backend is waiting for the approved migration's User foreign-key lock in the same database, same role and TLS session. If this cannot be observed within the bounded window, the owned child process is stopped and the tool fails. This mechanism was demonstrated against isolated PG16; no real Render migration session was observed in this task. PostgreSQL `application_name` is supported by [Prisma v6 PostgreSQL documentation](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql).

After CLI exit=0, the read-only AFTER checks require 16 valid migrations, 8,611 placements, the unchanged administrator count, identical count/hash values for all 18 old application tables and the first 15 migration metadata rows. Four new recovery tables must be empty. Session unlock/disconnect failure also prevents success.

## Failure handling and limits

Only safe phase/code/boolean metadata is emitted. Child stdout/stderr and raw database errors are discarded, never printed or persisted. Credentials exist transiently in the operator/child process environment and are restored/removed by the PowerShell wrapper; do not run with terminal transcription or under an untrusted local account. Private plans/results and staging stay under `.local/migration16-deploy/<operationId>/` with restricted directory permissions.

Codes distinguish backup expiry/target/source changes, confirmation/plan expiry, checksum/staging failure, target proof failure, CLI timeout/failure and post-migration data regression. No automatic retry or destructive rollback occurs. `migrationMayHaveApplied=true` means stop and inspect using the existing read-only AFTER preflight; it is not evidence of success. Do not delete Prisma failure history, force a rerun or restore over production as an automatic response. An interruption or post-check failure requires operator investigation and a separate recovery decision.

Receipt v1 is a local trust artifact, not a signed attestation: known synthetic/isolated flags and non-Render targets are rejected in production, and the dump hash, target, schema and all source rows must match. A deliberately forged local receipt with equivalent fields is not cryptographically distinguishable from an authentic v1 receipt. Retain trusted local custody; do not accept receipts from untrusted parties. This tool does not claim remote attestation.

The bounded CLI run uses lock/statement timeouts and no retries. The short User gate can temporarily block concurrent user writes; use the maintenance window. Failure may leave Prisma migration bookkeeping or a committed migration requiring review, even though the SQL transaction protects application data. PostgreSQL cancellation and client process termination cannot be treated as proof of rollback.

## Isolated tests and release scope

Run `node infra/test-migration16-deploy.cjs`. It creates only a randomly named disposable local PostgreSQL 16 container, generates 8,611 explicitly synthetic placement rows, users, session and audit fixtures, creates a genuine custom-format dump and independently restores it before testing. It never uses the user's real backup or production credentials.

Covered: 15→16 actual Prisma execution and observed DDL gate; source and historical hash/count preservation; administrator preservation; unverified/stale/target-mismatched/synthetic receipts; wrong target and disallowed URL options; checksum and extra migration rejection; exact confirmation and plan expiry; concurrent source changes; replay rejection and already-applied NO_OP; early CLI failure; target proof timeout; failed SQL; execution timeout; original SQL and backup preservation. Windows PowerShell 5.1 and PowerShell 7 wrapper tests mock Node and prompts to verify prepare→approval→apply ordering, hidden input and environment restoration without connecting to any database.

New files: `infra/migration16-deploy.cjs`, `infra/migration16-deploy.ps1`, `infra/test-migration16-deploy.cjs` and this report. The release manifest and CI include the new isolated test. Existing 23 protected operator files remain outside this change. No new schema migration, feature flag change, commit, push or deployment is part of this task. Local test evidence is under `.local/m16-deploy-tests/`; it must not be committed.

Recorded local result on 2026-11-02: migration16-deploy **21/21 PASS**, including both Windows shells. Release manifest **PASS** (140 candidate files, 23 separate operator files, no uncovered changes). Secret scan **PASS** (866 scanned objects/files, zero findings; heuristic scanning is not a proof of absence). This is local evidence; remote GitHub CI was not triggered.

Shared connection/preflight regression: **28/28 PASS**, including actual isolated PG16 authentication/database/TLS failures, strict certificate rejection, 15/16 migration states and both PowerShell versions. All **23 protected operator file hashes match** their baseline. Unexpected top-level apply errors report write status as unknown and migration as possibly applied, rather than asserting that no write occurred.

# KADRORADAR — CODEX MASTER BUILD PROMPT

**Version:** 1.0 | **Date:** 2026-10-22 | **Language:** Turkish UI / English source identifiers

> **ROLE & OPERATING INSTRUCTIONS FOR CODEX**
>
> You are a senior full-stack engineer, mobile engineer, data engineer, and product designer implementing a production-oriented Android-first public-sector recruitment companion named **KadroRadar**. This document is an **implementation instruction**, not a brainstorming brief. Inspect the repo first; if empty, scaffold the project. Implement working features and automated tests; do not merely outline a plan, generate fake backend APIs, or claim integrations work if they do not. Work in small verifiable phases, with code, migrations, tests, documentation and runnable commands. When blocked by an unavailable source/API, build a fully working administrator import pipeline and clearly mark live integration as pending rather than inventing listings. Never invent official announcements, historical data, qualification codes, or candidate eligibility outcomes.

## 0. Mission and scope

Develop a mobile app that supports **KPSS placement, recruitment announcements, applications and preferences AFTER the exam**. This is NOT an exam preparation/question-bank app. The value proposition is:
1. Match real public-sector openings to an applicant's actual eligibility requirements.
2. Provide reliable historical official minimum/maximum placement-score comparisons, without misleading placement probabilities.
3. Notify the applicant about relevant verified official announcements, deadlines and updates.
4. Let applicants bookmark, compare, prepare a preference shortlist, and track their own application steps.

Focus the MVP on **KPSS central placements and administrative/official announcement records**. Central placement (**ÖSYM placement preference process**) is not the same workflow as separate institutional recruitment (**Kariyer Kapısı / agency recruitment / examinations/interviews**). Keep data types and matching rules separate.

**Non-government disclaimer:** KadroRadar is independent and **not an official ÖSYM/Kariyer Kapısı/government app**. Do not imitate official insignia or imply affiliation. Always provide source links and last-verification timestamps. Never request e-Devlet/ÖSYM passwords, T.C. identity number, result-document check codes, applicant photographs or scanned score reports in onboarding.

## 1. User-supplied reference material (in same folder / ZIP)

- `reference/minmaxlisans29072024.pdf`: 13-page official-style *KPSS-2024/1 en küçük ve en büyük puanlar (Lisans)* table. This dataset shows **Kurum Kodu**, **Kurum Adı** (including locality), **Kadro Unvanı**, **Kontenjan Sayısı**, **Yerleşen Aday Sayısı**, **Boş Kalan Kontenjan Sayısı**, **En Küçük Puan**, **En Büyük Puan**. Observe comma decimals and Turkish diacritics. A score table does NOT state a candidate's degree qualifications; do not infer requirements from job titles. Import records in a traceable, idempotent fashion. Sample verifiable records from first page: `301016450` Abdullah Gül Üniversitesi / Kayseri / Merkez / Bilgisayar İşletmeni / quota 1 / placed 1 / vacant 0 / min=max `83,42293`; `301016457` psychologist / min=max `88,39749`. These are historical outcomes, NOT open listings.
- Source page: https://www.osym.gov.tr/kpss20241-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler . Page links to 2024/1 numerical summary and distinct bachelor's / associate / secondary score datasets. Preserve `2024/1` and education level as metadata.
- Two visual references were supplied in chat: (a) Kariyer Kapısı active announcements listing with institution/type/province/text filters, cards, end dates and an apply action; (b) an ÖSYM score result page demonstrating KPSS P1/P2/P3 and rankings. **The latter contains private identifying information: DO NOT store, distribute, render, reproduce, OCR, log or seed personal identifiers from that screenshot.** Use it only to understand generic structure. A previous conversation's fictional 83.50 score is a separate demo profile; it must not be mistaken for the numeric KPSS P3 score visible in the example screenshot.
- Future UI artwork/screenshots the owner sends shall override aesthetic defaults only; preserve these behavioral/security requirements. Implement a theme/token system so the screens can be restyled without changing business logic.

## 2. Source-driven product constraints

- Live announcements: ÖSYM official announcements/placement guides, Kariyer Kapısı public job postings, Resmî Gazete, official institution pages. Do not assume public APIs exist. Respect site terms, robots/access controls and rate limits; prefer authorized public feeds/exports or admin import. No login automation, CAPTCHA bypass, unauthorized scraping, or disclosure of personal application data.
- Historical outcomes: official ÖSYM publications; maintain origin URL, PDF SHA-256, retrieval time, record page, round, education level and import status. Pair outcome table to **separate official position/qualification table for the exact same round and education level** before declaring degree eligibility.
- No model may claim future placement odds from a few prior minimum scores. Display historical comparisons and comparability confidence, with explanatory labels (not misleading percentages).
- An announcement may require exams/interviews or different KPSS years/types. Eligibility conditions are based on the actual guide, not the generic title.
- Store score with decimal precision `Decimal(7,5)` for historic scores, and preserve original textual score as evidence where appropriate; use decimal math, never floating-point for stored scores.
- For zero filled placements, minimum/maximum scores are **null**, not zero, and must not be compared as a valid historical cutoff.

## 3. Primary user and onboarding

Demo candidate (for DEVELOPMENT ONLY): `educationLevel=BACHELOR`, `degreeCategory=AGRICULTURE`, `degreeProgram=UNKNOWN until confirmed`, `KPSSScore=83.50`, `scoreType=P3 (provisional)`, `examYear=UNKNOWN until confirmed`, `B class driver license=NOT_HELD`, `computer qualification=NOT_HELD`, preferred cities unset. Do not implicitly interpret 'Ziraat' as meeting any particular Ziraat Mühendisliği subprogram requirement. All unknown requirements yield `REVIEW_REQUIRED`.

Onboarding collect minimally: education level, exact diploma program (searchable catalog with code and version), year of graduation/expected graduation if required, KPSS exam year/type/score, driving license classes, special certificates (optional), preferred cities/unvanlar, notification opt-in. Applicant can edit any field and see matches recalculated. Do NOT require unnecessary sensitive attributes. Additional sensitive/regulated criteria should only be collected when strictly necessary with justification, explicit choice and data minimization.

## 4. MVP feature set — implement ALL

### 4.1 Auth and candidate profile
- Email/password login and guest/demo experience; use secure password hashing and short-lived JWT/access + rotated refresh tokens in protected device storage. Provide account deletion, logout and consent settings.
- Profile form with detailed section: exam scores (allow multiple years/types), education, diploma program/catalog code, credentials, preferences.
- Distinguish `UNKNOWN`, `NOT_HELD`, `HELD_UNVERIFIED`, `VERIFIED` for credentials; do not equate no uploaded evidence with not held.

### 4.2 Announcements
- Tabs: `Sana Uygun`, `Tüm İlanlar`, `Kaydedilenler`, `Başvurularım`.
- Filters: kurum, alım türü (`CENTRAL_PLACEMENT`, `INSTITUTIONAL_RECRUITMENT`), province, unvan, score type, score threshold, deadline, status; query search and ordering.
- Listing cards: official title, institution, recruitment type, location, number of positions if verified, publication/deadline, status, source, eligibility classification, bookmark button.
- Detail: exact requirement list with source citation/page, document links, deadline in `Europe/Istanbul`, apply link to official external site, saved/application tracking. NEVER perform an official application on the user's behalf in MVP.
- No hard-coded purported live announcements. Display helpful empty states when sources are not yet populated. Any illustrative examples MUST be labeled `DEMO / KURGUSAL`.

### 4.3 Rules-based explainable matching engine
- Condition states: `PASS`, `FAIL`, `UNKNOWN`, `CONDITIONAL`; final states: `ELIGIBLE`, `INELIGIBLE`, `REVIEW_REQUIRED`, `CONDITIONALLY_ELIGIBLE`.
- `FAIL` on any required AND group => `INELIGIBLE`; otherwise `UNKNOWN` => `REVIEW_REQUIRED`; then explicitly permitted conditional => `CONDITIONALLY_ELIGIBLE`; otherwise eligible. Support `AND`, `OR`, `NOT`, scoped groups and dates. `OR` group with any true => true; only all false => false; otherwise unknown. Explicit exceptions/alternatives are not independent mandatory rows.
- Evaluate KPSS score *type*, *year validity*, *minimum*, education level, exact diploma/qualification codes, licenses, certificates, age/date terms only if officially applicable, language and experience when necessary. Unknown conditions never become `PASS`.
- Rules carry `sourceDocumentId`, reference section/page/clause, `reviewStatus`, `effectiveFrom`, `mustHoldByDate`. No verified source => at most `REVIEW_REQUIRED`, even if heuristic matching passes.
- A candidate's `83.50` must not be interpreted as eligible for any general `MÜHENDİS` row until actual qualifications are linked.
- Return an array of per-requirement explainers in Turkish: title, expected, actual, status, evidence and action. Include engine version and evaluation timestamp, and recompute if profile or guide revisions change.

### 4.4 Historical placement analytics
- Upload or import original official historical score PDFs (starting with supplied 2024/1 bachelor PDF). Extraction pipeline with parsed table staging, preview, validation, human approval, committed import, and audit trail.
- Record for each position: round, education, institution/name/location, institution/position code, title, quota, placed, vacancy, minimum/maximum scores, source page/document.
- Search results and trends. Compare personal score to each confirmed historic min and display signed score difference. NEVER say 'you would have been appointed' as different years/exams/qualifications aren't identical.
- Degree-match and longitudinal comparison require mapping exact position/qualification codes through official guides. When absent, show `Nitelik bilgisi doğrulanmadı: yalnızca tarihsel puan karşılaştırması`.
- Produce period and province filters, cohort quota counts, trend graphics only for semantically comparable records. Distinguish identical vs similar vs unverified matches. Suppress forecasting until validated.

### 4.5 Notifications
- User opt-in for push reminders: verified new matching announcement, corrected announcement, imminent deadline, new guide/round, published results. Use server scheduler and Firebase Cloud Messaging with dedupe (`eventId:userId`) and throttling. Timezone Europe/Istanbul. Never imply monitoring is live if source ingestion is batch/manual.
- In-app notification inbox, seen/unseen, preferences and disable controls. Include link to originating record.

### 4.6 Application / preference tracking
- Bookmark and add to self-managed tracking board: `SAVED`, `PLANNED`, `APPLIED_BY_USER`, `AWAITING_RESULT`, `COMPLETED`, `CANCELLED`; do not auto-claim actual submission.
- For central placement, ordered preference shortlist with limits read from *that round's official guide*, qualification checks and warnings. Keep actual submission on official ÖSYM platform. Support CSV export and an easy-to-copy list.

### 4.7 Admin dashboard and source governance
- Separate protected admin web app: import source PDF/CSV, inspection, parsed-record preview, corrections with audit, review/approval, announcement management, source link verification, duplicate handling, failed job retry, push notification preview, analytics of source freshness.
- Imported data with confidence warnings shall stay `DRAFT` until approved. Only verified sources appear as verified to consumers.

## 5. Suggested UI/UX

Mobile-first: premium, trustworthy public-service-adjacent style without mimicking government official branding. Default palette: deep navy `#121D46`, cobalt `#356FE5`, pale background `#F5F7FB`, white surfaces, semantic green/amber/red with accessible contrast. Turkish typography with proper İ/ı, Ş/ş, Ç/ç, Ğ/ğ. Support light/dark, scalable font, skeleton/empty/error states.

Navigation: Home (`Özet`), Announcements (`İlanlar`), Historical Insights (`Atama Analizi`), Saved (`Listem`), Profile (`Profilim`). Bottom bar. Home: 83.50 score chip and unverified data indicator; personalized matches count if actual data exists; newest verified listings; deadlines; mini history chart; onboarding completion banner. Screen designs must be components, no images pretending to be app screens. UI variants can be updated later when owner shares desired UI.

Announcement detail examples show explicit status breakdown: `B sınıfı ehliyet gerekli — sende yok` => FAIL only if requirement officially confirmed. When candidate degree subprogram unknown => REVIEW_REQUIRED. No fake confidence percentages.

## 6. Data schema: Prisma/PostgreSQL

Use normalized schema with migrations and typed enums:
- `User`: id, email (unique), passwordHash, role, createdAt, deletedAt, consentVersion.
- `CandidateProfile`: userId, educationLevel, exactDegreeProgramId nullable, graduationYear nullable, preferredRegions JSON or join table, updatedAt.
- `DegreeProgram`: code unique scoped to catalogVersion, officialName, level, sourceDocumentId.
- `ExamResult`: candidateId, examFamily, year, scoreType, decimalScore, source/verificationStatus, createdAt.
- `Credential`: candidateId, type, subtype, status, issuedAt, expiresAt, evidenceReference (avoid storing sensitive uploads by default).
- `Institution`: name, canonicalSlug, source identity.
- `Announcement`: institutionId, title, type, publishedAt, applicationStartAt, applicationEndAt, status, officialUrl, sourceDocId, verifiedAt, sourceRevision, dataOrigin.
- `Position`: announcementId, externalPositionCode, title, city, district, employmentType, seats, kpssScoreType, kpssMinScore, requiredExamYears, publishedStatus.
- `RequirementGroup`: positionId, parentGroupId, logicalOperator AND/OR/NOT, sortOrder.
- `Requirement`: groupId, requirementType, operator, expected JSON, effectiveDate, mustHoldByDate, qualificationCodeId nullable, sourceDocumentId, sourcePage, reviewStatus.
- `QualificationCode`: code, catalogVersion, text, scope, sourceDocumentId.
- `PlacementRound`: source name, year, sequenceNo, educationLevel, guideDocId, dates, status.
- `HistoricalPlacement`: roundId, institutionId or institutionRawName, positionCode, title, city, officeType, quota, placedCount, vacantCount, minScore nullable, maxScore nullable, sourceDocumentId, sourcePage, confidence, approvedAt. Unique `(roundId, positionCode)` when codes are unique to that round and education level. Preserve raw record for audit.
- `HistoricalPositionQualification`: historicalPlacementId + qualificationCodeId with official guide source reference. DO NOT populate from inference.
- `SourceDocument`: originalUrl, originalFilename, mimeType, sha256, publishedAt, fetchedAt, sourceOrganization, license/accessNotes, parsingVersion, state, metadata.
- `ImportBatch`, `ImportRow`, `ReviewAudit`: parser version, row content, validation issues, approval and change log.
- `Bookmark`, `CandidateApplication`, `PreferenceList`, `PreferenceEntry`, `Notification`, `DeviceToken`, `MatchingEvaluation`, `AdminAuditLog`.

Indexes: `(type,status,applicationEndAt)`, `(city,title)`, `(roundId, positionCode)`, full-text search for Turkish announcement text, unique source fingerprints to deduplicate. Add soft deletion for users, retention controls, timestamps. Numeric decimal conversion correct for Turkish locale. Never create matches via matching only `title=MÜHENDİS`.

## 7. Historical PDF ingestion pipeline — must be runnable

Implement CLI and admin flow, e.g.:

```bash
pnpm data:import:historical --file ./reference/minmaxlisans29072024.pdf --year 2024 --round 1 --education BACHELOR --dry-run
pnpm data:import:historical --file ./reference/minmaxlisans29072024.pdf --year 2024 --round 1 --education BACHELOR --commit
```

Technical implementation may use Python `pdfplumber`/`pymupdf`, with deterministic layout parsing. Must handle the repeated header per page, wrapping institution name, spaced columns, Turkish decimal comma and 13-page multipage source. For each row validate:
- position code exists and follows expected format;
- `quota >= placed >= 0`, `vacant = quota - placed`, else flag manual review;
- when `placed > 0`, `0 < minScore <= maxScore <= 100` (if unusual publication values exist, quarantine rather than silently reject or correct);
- count parsed rows, rejection totals, and page/line references;
- exact duplicate imports are idempotent; edits trigger version/approval flow.

**Acceptance tests (source-grounded):** First-page record with code `301016450` must have title `BİLGİSAYAR İŞLETMENİ`, quota 1, min/max `83.42293`. Verify code `301016457` with psychologist `88.39749`. Output should show number of successfully imported records and unresolved rows; do not falsely claim the PDF was completely imported unless the checks pass. Keep PDF source metadata. Store approved historical scores but mark its candidate eligibility `UNKNOWN` until matching qualification guide is supplied.

If direct PDF extraction cannot be made reliable, implement manual-review import with a reproducible CSV staging export; DO NOT fake successful import.

## 8. APIs (REST `/api/v1`, OpenAPI documentation)

- `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `DELETE /users/me`
- `GET/PUT /me/profile`, `POST/GET/PATCH /me/exam-results`, `POST/GET/DELETE /me/credentials`
- `GET /announcements?query=&type=&city=&status=&eligibility=&page=&limit=`
- `GET /announcements/:id`, `GET /positions/:id`, `GET /positions/:id/eligibility` (auth/profile required; per-rule reasons)
- `GET /historical/rounds`, `GET /historical/placements?year=&round=&education=&city=&title=&institution=&page=`, `GET /historical/placements/:id`, `GET /historical/comparison?positionId=` (safe comparability notes)
- `GET/POST/DELETE /me/bookmarks`, `GET/POST/PATCH /me/applications`
- `GET/POST/PATCH /me/preference-lists`, `POST /me/preference-lists/:id/entries`, ordered reorder/delete
- `GET/PATCH /me/notifications`, `PUT /me/notification-settings`, `POST /me/device-tokens`
- Protected admin: `POST /admin/imports`, `GET /admin/imports/:id`, `POST /admin/imports/:id/approve`, `POST /admin/announcements`, `PATCH /admin/announcements/:id`, `POST /admin/sources/:id/recheck`.

Validate inputs (Zod/class-validator), authenticate and authorize role-scoped routes, standard error DTOs, pagination, sorting allowlists, rate limiting, audit for edits, and integration test coverage. Use server timestamps and locale-correct rendering.

## 9. Monorepo / infrastructure

Recommend `pnpm` workspace:
```
apps/mobile       Expo React Native / TypeScript / Expo Router
apps/api          NestJS + TypeScript + Prisma + PostgreSQL
apps/admin        React + Vite + TypeScript
packages/shared   Zod schemas, enums and API DTOs
packages/ui       shared design tokens (as appropriate)
services/ingest   Python PDF/CSV parser + fixtures/tests
reference/        source example historical PDF (if supplied)
docs/             architecture, source registry, user stories, legal review
infra/            docker-compose Postgres / optional Redis
```

For MVP, use database-backed scheduled jobs or BullMQ/Redis if justified; avoid unnecessary microservices. Android Play release should produce an `.aab` via Expo EAS or a reproducible Android pipeline, use up-to-date target SDK requirements verified at release, crash reporting optional behind privacy controls. Env templates only; no committed secrets. GitHub Actions CI: lint, TS check, backend tests, parser tests, build smoke.

## 10. Privacy, compliance and observability

- KVKK privacy-by-design, clear consent/retention/deletion flow, and Google Play Data Safety disclosures; legal review before launch. Avoid official branding infringement.
- Source refresh traceability; access-control and secure storage; PII not in logs or analytics; protected admin. Per-user matching outputs never public.
- Record source fetch timestamps, parsing errors, admin approvals; alerts for stale sources. If external source unavailable, degrade transparently (`Son doğrulama: ...`) and do not claim `Yeni ilan bulunmadı` as an exhaustive fact.
- User-uploaded screenshot of exam results has an ID number and personal photograph. DO NOT put it in repo, tests, screenshots, output docs or logs. Avoid printing or indexing its raw contents.

## 11. Non-goals / anti-patterns

Do not build question-solving/learning module; do not fake current recruitment news; do not scrape behind e-Devlet/Kariyer Kapısı login; do not request passwords; do not promise appointment; do not use random placement-probability figures; do not infer job qualifications from job title; do not claim official-source freshness unless verified; do not skip migrations/tests; do not mix historical placement outcome records with currently open recruitment records.

## 12. Phased delivery and definition of done

**Phase A (scaffold, working app shell):** Workspace, Docker Postgres, API boot, DB migration, mobile navigation, profile forms, admin basic auth. Show actual app UI with appropriate empty states. README has tested commands. Tests pass.

**Phase B (historical data MVP):** PDF parser, fixture tests from 2024/1 source, CLI dry-run, admin preview/review/commit, historical query endpoint, mobile list + chart + source link. Pass integrity and idempotence checks; clearly label unknown qualification mapping.

**Phase C (announcements and rules):** Real announcement data schema, admin-managed verified announcements, detailed logical requirements matching, per-condition explanations, filtering, favorites. Include fully labeled mock demo cases ONLY for tests/storybook. Real app should not seed fake live listings.

**Phase D (personal guidance):** Notifications with opt-in, application board, preference list, announcement change alerts, polish, accessibility, test coverage.

**Phase E (launch readiness):** Threat and privacy review, source terms review, end-to-end Android testing, crash-free core flow, target SDK check, privacy URLs, release `.aab`, published setup instructions. Launch/store submission may require owner's credentials; do not claim submitted if not.

**Mandatory acceptance scenarios:**
1. Fresh install -> guest browse verified historical 2024/1 records -> open one -> official source linked -> no bogus qualification approval.
2. Demo 83.50 profile missing exact degree/KPSS year -> unknown education and year status; not falsely `ELIGIBLE`.
3. Verified fictional rule requiring B license + demo no license -> `INELIGIBLE`; clear explanation.
4. Verified fictional generic bachelor's role with valid exam result and no additional conditions -> `ELIGIBLE` (after year and type confirmation).
5. Same position with unverified source -> `REVIEW_REQUIRED` even if other checks pass.
6. Requirement group `(license B OR alternative accepted certification)` respects OR semantics; unknowns don't auto-fail/pass.
7. Historical vacant posts have null minimum; excluded from cutoff comparisons.
8. PDF imported twice does not duplicate records.
9. Notification sends only after opt-in; dedupes and respects disabled settings.
10. Unauthorized request to admin endpoint is forbidden; invalid inputs return meaningful errors.

## 13. What you (Codex) should do now

1. **Inspect repository and reference files**; document what exists. If this Markdown file is the only input, scaffold whole monorepo.
2. Set up reproducible environment with `README.md`, `docs/architecture.md`, `.env.example`, Compose database, Prisma migrations and CI.
3. Implement **Phase A and B end-to-end first**, including 2024/1 historical PDF source import and real mobile historical analytics UI. Do not stop at an architectural proposal.
4. Continue with Phase C and D where context/time permits; do not implement dummy remote integrations in place of actual data. Leave honest TODOs with clear extension points.
5. Execute lint/typecheck/tests/build and show results in final report. Note any unavailable source or Play credentials explicitly.
6. Maintain progress in `docs/implementation-status.md` with checklist: done, tested, blocked, next concrete tasks.
7. When visual reference UI is provided later, apply it via theme/components without altering correctness/privacy guarantees.

**Deliverable:** An actual locally runnable, professional KadroRadar application plus admin backend and a verified 2024/1 historical analytics import pipeline—not just UI screenshots or a design document.

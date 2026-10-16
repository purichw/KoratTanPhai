# Forecast Operations: New Rounds, Readiness And Recovery

Status: released on 2026-10-16 from `feat/cms-forecast-lifecycle-20261015` at
`2d2d7cb0f7922090801643e1e4d5648a4546393c`, with explicit owner authorization.
Both migrations and the compatible app/API are live. Existing rows and the
published dataset are unchanged. Full CI and authenticated read-only candidate
and production checks passed. Publication/recovery write tests use isolated
PGlite databases, never synthetic live forecasts.

## Operator Journey

- Data management keeps the existing Admin shell and forecast controls. A new
  origin can start as an empty 289 x 6 draft, or arrive through the existing
  normalized rev3 Excel/CSV importer. Existing-origin correction still works.
- An empty slot is `insufficient_data`, not risk 0 and not out of study scope.
  It deliberately fails publication validation until the operator supplies a
  reviewed result. Scope, calendar targets and 0/1/2/null semantics use the
  existing integration contract. This does not enable arbitrary model-result
  publication or change the parked Actual/Archive routes.
- Validation and publication remain separate actions. The publication dialog
  compares the draft with the current live round, including new versus changed
  cells and stale-base conflicts. The database rechecks revision, base dataset,
  complete geographic coverage and every horizon in one transaction.
- Readiness is computed from runs and cells, not from uploaded filenames. It
  distinguishes completeness, predicted/out-of-scope counts, forecast target
  coverage and the timestamp of publication. It never claims a source issuance
  date, model accuracy, actual drought event, or an invented freshness SLA.
- Publication history can copy one prior round into a **new draft against the
  current dataset**. Reviewing and publishing that draft preserves all other
  origins. Existing publications are never overwritten or moved backwards.

## Import Work

Raw review now has a server-owned checkpoint before canonical draft creation.
The checkpoint includes all sheets, column mapping, exclusions, edits and their
reasons, review holds, selected origin and the prepared payload. Opening work
rechecks the current catalogue/crosswalk and validation; a saved validation
verdict is never trusted. Formula/error holds remain unresolved until corrected.

Autosave is debounced and serialized. The operator can explicitly save, or save
and close. Failed saves retain edits and offer retry; an unacknowledged or stale
save never displays success. Concurrent editors use revision compare-and-swap.
An uncertain response retries the same snapshot identity. Canonical conversion
is atomic and idempotent so a retry cannot create duplicate drafts.

The original uploaded bytes are retained separately and are downloadable from
the work list. Unlike reviewed exports, this download is the exact original file,
including formulas, and should be treated as untrusted source material. The web
importer does not execute formulas. Existing reviewed Excel/CSV downloads remain
available for external repairs.

Only the work owner can list/read/change that checkpoint or original. Operator
membership is checked on every call. This does not merge visitor/Admin sessions
or change the shared operator access policy for canonical drafts.

### Storage And Limits

`ktp_cms_import_work`, `ktp_cms_import_objects` and `ktp_cms_import_parts` are RLS
protected with no direct anon/authenticated/service-role table privileges. The
service-only RPC rechecks membership and ownership. Objects use 256 KiB chunks
inside the existing small JSON endpoint, SHA-256 verification and an atomic
checkpoint pointer. No public bucket or browser-local persistence is involved.

- Original: existing 20 MiB import limit; checkpoint: 40 MiB serialized state.
- At most 100 unfinished work items per account; 100 MiB staged storage per work.
- Only the latest complete checkpoint is retained after a successful replacement.
  Original files and linked canonical drafts remain. Incomplete uploads are not
  promoted to a saved checkpoint. They may require operational cleanup later;
  there is no silent time-based deletion of the operator's original files.
- These are bounded CMS documents, not a general-purpose file archive. Before
  sustained high-volume use, measure DB storage/backup cost and adopt a private
  object store behind the same owner/checkpoint contract if warranted.

## Lineage And Public Compatibility

New publications rebuild origin/horizon catalogues and all temporal metadata
from actual runs. The T+1 overview and T+1..6 archive stay consistent. Non-selected
rounds retain their values and lineage. Original cells keep workbook-row lineage;
CMS changes use `review_draft_id` and the immutable publication review. No fake
original row is assigned to a newly authored value.

Dataset-level original workbook metadata remains the base dataset identity for
existing consumers. Optional `meta.originSources` provides round-specific source
filename/sheet/hash; manual CMS values have no invented file hash. Export data,
Excel notes and map reports use the selected round's provenance. Revision and
same-dataset comparison continue using dataset identity, not source filenames.

## API Additions

All additions use authenticated, same-origin POSTs to `/api/admin-data`:

- `forecast-new`, `forecast-template`, `forecast-readiness`, `forecast-compare`,
  `forecast-history`, `forecast-restore`.
- `work-list`, `work-get`, `work-create`, `work-upload`, `work-read-part`,
  `work-save`, `work-convert`.

Forecast values still use the existing `archive` draft envelope and shared
model-input validators. The historical internal kind name is not the parked
Actual Archive feature and does not create a second forecast data schema.

## Deployment Sequence

After explicit release authorization: run the normal CMS/auth/data release gate,
take the prescribed backup, rehearse both migrations against the release base,
apply `20261015010000_cms_forecast_lifecycle.sql` and then
`20261015020000_cms_import_work.sql`, and deploy the compatible app/API together.
Verify the currently published dataset is unchanged before/after migration. Do
not upload synthetic forecast rounds into production for smoke tests.

Rollback is an application rollback with new private tables retained. Do not
drop original files or published datasets to undo an interface deployment.
Once a new origin is published, older code must still honor the publication
reader contract; verify this before promotion. Follow `RELEASE_RUNBOOK.md`.

## Evidence

`tests/admin-data/lifecycle.test.mjs` covers new origins, unready rejection,
unchanged prior rounds, public projection metadata, recovery drafts, exact-byte
resume, stale revisions and account isolation. Existing publication tests cover
value edits, immutable old versions, recovery and stale publication rejection.
`e2e/admin-lifecycle.spec.ts` exercises real import, save/reopen, original download,
explicit publication, recovery and failed-save retry with the same API/SQL in an
isolated browser fixture, at desktop/mobile sizes. Its public-reader fixture uses
the same database after publication: the new origin is selected on `/drought`,
all 289 map shapes render, and the page has no horizontal overflow or page errors.

### Local Verification, 2026-10-15

- 15 targeted Vitest files / 134 tests passed: importer repair/reviewed exports,
  autosave races/retry/conflicts, comparison status-versus-zero labels,
  source provenance, forecast export/query and existing auth contracts.
- 11 Node contract/handler/database/lifecycle tests passed, including membership
  revocation, cross-account denial, forged hash rejection, duplicate conversion
  retry and stale conversion payload rejection.
- Full-archive publication/recovery rehearsal passed with 220,218 cells across
  127 origins. The measured publication took 13,877 ms in local PGlite; this is
  not a Supabase or production latency guarantee.
- Protected CMS/database build, exposure guard and bundle budgets passed. CMS
  remains lazy-loaded; the database build emits no static forecast archive.
- Eight built-browser cases passed across Chromium desktop 1440 x 960 and
  mobile 390 x 844: two auth-isolation and two lifecycle scenarios per viewport.
  After the last presentation-only fix, the full import-to-publication/recovery
  journey passed again on both viewports against the rebuilt protected bundle.
- Original-file download was compared byte-for-byte; raw-review save/reload and
  failed-save retry were exercised. Empty new rounds cannot publish. Recovery
  creates a draft and does not change the publication pointer.
- Current local evidence is in `artifacts/cms-lifecycle/`: readiness, new-round,
  resume-list, publication-review, recovery and visitor-new-round captures.
  Captures use isolated synthetic October 2026 results and test sessions, not
  live forecasts. Desktop is DPR 1; mobile uses the Pixel 5 Chromium profile.
  Readiness/resume/public captures are full-page; dialogs are viewport captures.
  Visual review checked centered KPI groups, modal bounds/action spacing, mobile
  work-list actions without horizontal scrolling, and retained visitor layout.
- Final protected `dist/index.html` SHA-256:
  `b40647c213dbc8887a0681d42e9e97f34655530b70a99f4cea162d21a564992f`.
  Source is the uncommitted candidate on base `9075f27`; this is not a release SHA.

Historical scope verdict on 2026-10-15: **VERIFIED locally**, **PARTIAL for production readiness**.
Real Supabase/PostgREST migration rehearsal, production backup and before/after
dataset checks, real-account smoke and deployment remain separate release gates.
No live database changes, production publication, push, deploy or iOS changes
were performed. No whole-site accessibility or Safari certification is claimed.
The following release evidence supersedes that local-only status.

### Release Preparation, 2026-10-16

- Full Vitest: 55 files / 489 tests passed with two local workers; the initial
  all-core run competed with browser/snapshot work and hit the existing 5-second
  exhaustive coverage test budget. No timeout or assertion was weakened.
- All 14 CMS Node contract/database tests and 16 CI decision tests passed.
- CMS browser coverage passed after updating the previous unsaved-close and
  publication-metric expectations to the new durable-work/readiness contract.
  Failed checkpoints still require an explicit discard decision.
- Read-only production snapshot captured 442,918 rows in 71 parts. The extended
  `forecast-lifecycle` recovery profile restores CMS audit identity values as
  well as original forecast rows. Local rehearsal applied only the two new
  migrations and proved every original field and publication identity unchanged.
- Private recovery evidence is under `artifacts/lifecycle-release-20261016/`;
  it must not be committed or uploaded with the web deployment.
- The existing read-only Admin smoke supports `SMOKE_CMS_LIFECYCLE=1` to verify
  readiness, new-round/history dialogs and the saved-work list without writes.
  `CMS_VERIFY_LIFECYCLE=1` adds denial checks for the new private storage and RPCs.
  Candidate/production migration, CI and promotion results must be recorded
  separately after completion.
- Live migration completed in a single guarded transaction, including migration
  ledger entries. The guard required the captured migration list and published
  revision before applying. Post-migration comparison confirmed all 442,918
  original rows unchanged; five reference resources and 18 private-access denial
  checks passed through real authenticated PostgREST.
- Candidate `0028ebb` passed read-only Visitor and Admin lifecycle smoke, but
  Quality Gate `38868088194` failed two built-browser loading cases: their
  allowlisted fixture did not answer the new `work-list` read. Other jobs passed.
  The fixture now gates that read explicitly and checks loading before/after
  response. Smoke selectors use the shared select's visible accessible name and
  measure warm return only after the new work-list route's initial read settles.
  No product code, assertion budget or authentication boundary was relaxed.

### Production Verification, 2026-10-16

- Final source `2d2d7cb` passed all seven jobs in full
  [Quality Gate 38869935304](https://github.com/purichw/KoratTanPhai/actions/runs/38869935304),
  attempt 1. The protected candidate used explicit Supabase/CMS build flags.
- Verified candidate `dpl_DHKiNas9gA1jwBQhXrrWuMf9kcmP` was promoted to
  `https://korattanphai.vercel.app` only after CI and real-account read-only
  candidate checks passed. The main alias was still the expected `8b05a25`
  immediately before promotion and matched exact `2d2d7cb` afterward.
- Candidate and production each passed 39 Visitor checks: province/district/
  subdistrict routes, 289 map geometries, graph units/counts, irrigation,
  missing/out-of-scope semantics, 1,734 province and 36 district Excel values,
  native chart/pivot presence and no static fallback. The CMS marker reports
  `{"backend":"cms","fallback":false}`; process health is HTTP 200/no-store.
- Hosted [Deployment Smoke 38871707192](https://github.com/purichw/KoratTanPhai/actions/runs/38871707192)
  passed with exact `2d2d7cb` harness source and real authentication against the
  promoted production alias.
- Admin desktop/mobile checks passed readiness, new-round/history dialogs,
  saved-work lists, templates, grouped areas/map/export, independent sessions,
  manual refresh and warm navigation. The harness blocks mutations and reported
  zero application-data writes. Live new import tables remain empty and the
  published revision is unchanged from the backup. Isolated lifecycle tests,
  not a live publication experiment, prove write/recovery behavior.
- Inspected the deployed desktop readiness viewport and mobile new-round dialog:
  existing branded shell/components, centered metric groups and bounded dialog
  controls remain intact. Captures and reports are under
  `artifacts/lifecycle-release-20261016/production-admin/` and
  `production-visitor/`; candidate equivalents use `candidate-2-*`.
- Recovery app: `dpl_F39b2Mi6SE1owJWJJ52xBQwBPFKG` (`8b05a25`). Preserve new
  private storage and original uploads during any application rollback. Private
  snapshot/permission receipts remain ignored and must not be deployed.
- Scope verdict: **VERIFIED for this release**. No synthetic production writes,
  physical-device/native-app tests or whole-site accessibility certification.

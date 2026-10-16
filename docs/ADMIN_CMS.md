# Admin Data Workspace

Status: the owner-authorized production cutover completed on 2026-09-28
(Asia/Bangkok), runtime `2a84a0e`. Database, candidate and post-promotion checks
passed with the original data unchanged. This is the scoped CMS foundation,
not complete no-code ownership of every data family; see remaining gates below.
See `docs/CMS_CUTOVER_20260928.md` for the checkpoint and final outcome.

## Forecast Lifecycle Candidate (2026-10-15)

The current implementation branch adds new forecast origins, computed readiness,
server-owned import checkpoints/original downloads, comparison before publish,
and recovery into a new reviewed draft. See
[CMS_FORECAST_LIFECYCLE.md](CMS_FORECAST_LIFECYCLE.md) for contracts, limits,
migration order and evidence. **Not deployed; neither new migration has been
applied to production.** Earlier sections below describe their dated releases;
their new-origin/raw-autosave/restore exclusions are superseded only in this
candidate. Model-result publication and geometry changes remain gated.

## Repairable File Import (2026-10-08)

Released in runtime `3742db7` after full Quality Gate `37776954891` and
authenticated read-only candidate checks. Production promotion and verification
are recorded in [HANDOFF.md](HANDOFF.md). The notes below describe the feature
and its initial local evidence, not a database migration.

- `AdminImport` retains readable XLSX/XLS/CSV rows in a review step before
  conversion. `ImportSheetReview` shows source sheet/physical row/column, error
  and warning counts, recovery guidance, search, issue-only/all/excluded filters,
  paginated rows, a bounded row editor and CSV downloads. It reuses the existing
  selects, dialogs, empty state, brand styles and formula-safe CSV serializer.
- Duplicate/blank headers receive distinct positional labels instead of losing
  cells. Mapping requires explicit acknowledgement of those headers. Unsafe
  property names remain rejected. Formula, Excel-error and date cells are retained
  as text plus blocking issues; cached formula results are never accepted or
  executed. An operator must explicitly replace each affected mapped cell.
- Rev3 inspection collects invalid years/months, unsupported origins, unknown
  source IDs, invalid risks/placeholders, duplicate groups and missing areas.
  Exact duplicate forecasts are warnings; conflicting values block conversion.
  Operators can edit values or exclude/restore rows with a reason. Missing-area
  insertion uses the authenticated crosswalk, is disabled until source/identity
  issues are fixed, and inserts `ยังไม่กรอก` risks, never zero or out-of-scope.
  Blank source risks keep the existing approved rev3 out-of-scope meaning.
- Raw edits are in memory until `สร้างฉบับร่าง`; navigation/close protection and
  corrected CSV download are available, not durable raw-file autosave. Switching
  sheets retains corrections. Returning from an edited normalized preview requires
  explicit discard confirmation. Rev3 drafts keep original selected-origin source
  rows and SHA-256 separately from `sourceImport.review` corrections, reasons,
  excluded physical rows and added records. This evidence is immutable on draft
  edits and survives Excel/JSON export. It is not the original binary file.
- After conversion, authenticated `POST action=inspect` performs a read-only
  server preview using the existing API validators. It creates no draft or
  publication. Inspection is debounced and stale/cancelled results are ignored.
  Row fixes and metadata changes trigger inspection again. Invalid field values
  can still be saved as a repairable draft; acceptance remains server-gated.
- Forecast diagnostics collect multiple cell/field issues through the same rule
  function used by the integration acceptance gate. Other families collect basic
  field-shape issues and per-row domain failures; their existing semantic validators
  can still report the first dependent failure per row/batch. Do not claim complete
  simultaneous enumeration of every observation-domain conflict.
- Draft validation runs on open and after each saved revision, with explicit retry.
  Stale revisions, permissions, source/base locking, explicit confirmation/reason,
  atomic publication and the visitor read paths remain unchanged. The import review
  distinguishes ordinary changed values versus a published baseline from conflicting
  duplicate source records.
- Remaining boundaries: corrupt/encrypted/oversized files, malformed CSV quoting
  or column counts, unsafe headers and damaged metadata still stop with recovery
  text. Header-row auto-detection, merged-header reconstruction, new forecast origins,
  geometry import, durable raw-review drafts and generic source-file binary storage
  are not added. The source evidence extension is rev3-specific; other families
  retain their original API envelopes without CMS-only fields.
- Verification: targeted parser/review/cache/unsaved-change unit tests, CMS/API
  contract and isolated SQL lifecycle/publication tests, desktop/mobile import
  journeys (including invalid year/ID/formula/missing-area repair, duplicates,
  save/reload/export, stale edits and explicit publish), and protected CMS build.
  Screenshots: `artifacts/import-repair/`. No remote mutation, migration, commit,
  push or deploy is included in this local checkpoint.

### Reviewed Downloads And Offline Repair

- Both the raw-file review and the normalized API preview use
  `ImportReviewDownloads`. They export the current in-memory values, including
  UI corrections, without creating a draft, publishing or filtering exports to
  only the currently visible table page. Pending/failed server inspection cannot
  be downloaded as a reviewed normalized payload.
- `Excel พร้อมผลตรวจ` creates `Korat_import_reviewed.xlsx`: editable `Data`,
  `_รายงานตรวจ`, `_วิธีใช้`, optional `_ไม่นำเข้า`, and existing `_Metadata` when
  applicable. It reuses the Admin Excel writer, Cordia New, centered data cells,
  frozen headings and filters. Error/warning cells have color and notes; rev3
  risks also have input guidance and validation choices. These annotations are
  snapshots, not a live validation engine inside Excel.
- `Data` retains import columns without adding diagnostic fields. Reports refer
  to the original source row plus the one-based exported record position, not
  CSV physical line numbers (quoted multiline values can occupy several lines).
  Excluded records are not included in Data; Excel keeps them on `_ไม่นำเข้า`.
  Only the selected source sheet is exported. Recheck column mapping on upload.
- `CSV สำหรับแก้ไข` is available for raw rev3 and observation tables, alongside
  `รายงานปัญหา CSV`. CSV has no color, cell notes or envelope metadata. Observation
  source/batch metadata must be entered again. Canonical forecast/archive payloads
  need their envelope/base/scope metadata, so their offline-edit download is Excel,
  not a misleading data-only CSV that the existing importer cannot round-trip.
- Unresolved formula/error/date source cells are written as literal text prefixed
  with `[KTP_REVIEW_REQUIRED] ` in both formats. The reader restores a blocking
  issue for unchanged markers. Operators must replace the whole value with verified
  source data, not just remove a warning to bypass review. Formula cached results
  are never executed or accepted. Generic CSV formula guarding remains enabled;
  Excel keeps string types, including leading-zero IDs. Opening CSV directly in
  spreadsheet software may infer types; use Excel or import CSV identifiers as text.
- Reimport is a new upload and hash, with fresh validation, not a merge into a
  saved draft. Raw corrections/exclusions are not a hidden trusted approval.
  Canonical Excel preserves the existing metadata envelope; no API or publication
  contract is changed. Tests cover unchanged holds, explicit external fixes,
  null/zero, identifiers, metadata, report-sheet exclusion, and browser download /
  edit / reupload / save on desktop and mobile emulation. Native Excel rendering
  and physical-device testing are not part of this local checkpoint.

## Returning to loaded Admin data (local follow-up)

- `createAdminClient` retains up to 16 successful list/detail/catalogue reads in
  memory for the mounted Admin account. No draft data is persisted in browser
  storage. Sign-out/account replacement discards that workspace and its cache.
- `useAdminRead` renders a matching cached result immediately and revalidates
  with the existing session checks and server authorization. Only uncached
  initial reads register the full-page loader. Returning from imports or a
  resource detail and manually refreshing keep ready panels visible.
- Same-account session notifications and browser focus do not initiate Admin
  reads or replace unsaved forms. Save/publish/clone/import invalidate cached
  reads, including late responses started before a mutation. Warm detail
  revalidation disables editing until its latest revision arrives. Manual
  refresh respects the existing unsaved-changes guard.
- A temporary refresh failure retains the last result with a local error;
  rejected access/session or a missing draft removes that result. Hard reload
  still verifies the session and loads from the server.
- Baseline isolated tests reproduced the imports-to-home loading regression;
  browser focus and same-user session notifications alone did not reproduce it.
  This change is local, not deployed; no auth policy or backend contract changed.

## Reference catalogue grouping (local follow-up)

- The reference panel now has three groups: ข้อมูลพื้นที่, ชั้นข้อมูลแผนที่ and
  แหล่งข้อมูลอ้างอิง. Area names and tambon boundaries now share the area group;
  map layers expand to the province outline and neighboring provinces.
  Search includes nested layer names; category filters use these same groups.
- Station locations, nearest-station coverage and neighboring-country geometry
  are hidden from the main catalogue and its search. Their original payloads,
  stored versions, bootstrap registration, history/download and old deep links
  remain intact. No database migration or publication is needed for this UI change.
- Source tables show the existing TMD, GISTDA drought, RID, OAE and Agri-Map
  references, explicitly labeled อ้างอิงประกอบ. They are not established as
  inputs to the published forecast model. Flood, EWS, pest and observed-disaster
  source entries stay in the complete original payload but are omitted here.
- Source editing retains original array indices, including gaps left by hidden
  rows. Saving changes only the selected original entry; all other rows remain.
  This follow-up is not yet deployed.

## Resource row controls (2026-10-02 follow-up)

- Resource details default to browsing without row or page checkboxes. The
  explicit `เลือกเพื่อดาวน์โหลด` action reveals selection controls; cancellation
  clears the selection. Original-row identities, cross-page CSV selection and
  filter/revision clearing remain unchanged.
- Detail actions use compact text buttons while retaining 44px touch targets,
  keyboard activation and dialog focus restoration. Mobile keeps the same
  bounded list viewport and pagination. The change applies to both area and
  reference-source projections; no data or persistence contract changed.
- The read-only record dialog adapts the supplied desktop/mobile mockups with
  category/revision metadata, original labeled values and a separate explanation.
  It uses the real resource state (`เผยแพร่แล้ว` / `ฉบับร่าง`), not the mockup's
  unverified `ข้อมูลปัจจุบัน` label. The existing Korat Tan Phai branding stays.
  Mobile uses a bottom sheet; its body scrolls while the close footer stays
  reachable, including short viewports. All three close paths restore focus.

## Unified Area Workspace (2026-10-03, Local)

- Both hierarchy and tambon-boundary resource links open `AreaWorkspace` under
  ข้อมูลพื้นที่. Hierarchy links start in รายชื่อ; existing boundary links start
  in แผนที่. Other geometry, source and retained-resource views are unchanged.
- The list groups whole districts with collapse/expand, found/total counts and
  pagination by district groups (4 by default). Search opens matching groups.
  Search (including Thai digits), searchable district/tambon selectors, boundary
  status and sorting feed the same row set in both views. Changing district
  resets its dependent tambon selection. Zero results use the shared empty state.
- Identity/name authority is the CMS hierarchy. Geometry joins only by exact
  `subdistrictCode` / `Admin_code`. Duplicate codes are not resolved by choosing
  the first feature. Unmatched geometry stays visible in its own review group.
  Missing, duplicate, invalid rendering geometry, different names, orphan and
  unavailable reads are distinct. Rendering validation is not topology or
  survey certification. Counts are derived from the loaded revisions, never
  hardcoded or claims about hazard/forecast coverage.
- Read paths reuse authenticated `resource-catalog` and `resource-get` with
  `useAdminRead`. An explicitly opened revision/draft is preserved and paired
  with the published counterpart, not an unpublished draft chosen implicitly.
  Both versions/states are shown. Missing/failed/malformed resources are unknown,
  not absence of boundaries; retry is available. No static/bundled fallback.
- `AreaBoundaryMap` is a neutral, read-only CMS geometry inspector. It reuses the
  local projection/path, collision-aware map labels and shared anchored-zoom math without mounting the
  forecast map's own data loaders or changing visitor map behavior. It supports
  selected-area inspection, zoom/reset, pointer drag when zoomed, keyboard
  selection, and mobile page scrolling at fit. Filters fit the visible geometry.
  The same `WorkspaceDialog` and map show general/boundary details, source and
  revision; mobile retains the bounded bottom sheet and reachable close action.
- Selection is explicit. District checkboxes select matching members of that
  group; the all-results checkbox includes all matching pages. Sort, pagination
  and list/map switching retain selection; filters, revision changes and cancel
  clear it. CSV uses existing quoting/formula guards. GeoJSON contains selected
  original features, deduplicated by source index, without simplifying geometry
  or replacing its properties with canonical display names. Button counts show
  how many features are actually exportable, including invalid features for review.
- History and full original JSON remain available separately for both datasets.
  No migration, mutation, permission, publication, or new geometry-import/edit
  capability is introduced. Existing import/publication gates remain in force.
- Targeted coverage: `tests/areaModel.test.ts`, presentation/export unit tests,
  `e2e/admin-resource-detail.spec.ts` (desktop/mobile, isolated CMS database),
  plus existing catalog/navigation consumers. Authenticated read-only release
  coverage uses `scripts/smoke-admin-navigation.mjs` with the area journeys in
  `scripts/smoke-admin-areas.mjs`. This implementation checkpoint is local;
  see `HANDOFF.md` for subsequent verified deployment status.

## Operator-facing cleanup (2026-09-30 checkpoint)

The owner requested a no-code workspace with understandable Thai names and no
unused demo/stub inventory. This local follow-up starts from the verified sidebar
release `7bfeb6d`; it has not been deployed or migrated.

- The landing page prioritizes the published forecast, resumable imports/drafts,
  then eight explained reference resources. Resource keys, revision hashes and
  raw JSON paths are not the primary labels.
- `src/admin/resourcePresentation.ts` owns the curated views. Administrative
  names and four geometry resources support the website. Source descriptions,
  49 source-backed station locations and station-distance coverage remain
  inspectable, explicitly distinguished from live measurements. Only source-backed
  rows are shown in those reference views; no null or missing value becomes zero.
- Retained demo advisories, farmer/persona/workflow fixtures, illustrative models,
  empty observation/research schemas, retired rev02 and duplicated internal joins
  are removed from the everyday resource list. All 45 versioned resources,
  bootstrap readers, original payloads and immutable audit history remain intact.
  Hiding a resource is not deletion or a change to backend authorization.
- Opening a resource is read-only. Editing source descriptions requires an
  explicit draft action and named Thai form fields; save, conflict/reload,
  reason, audit and explicit publication use the existing API. Geometry and
  administrative identity views do not offer unsafe generic scalar editing.
  Old deep links remain inspectable as retained history with original download.
- Forecast corrections show area names, target month and one semantic risk
  selector. The selector changes `status` and `riskCode` together while preserving
  area, target and horizon. Unresolved imports require an explicit choice; null
  out-of-scope remains distinct from the numeric no-risk value 0.
- Excel is the primary file workflow; JSON is a secondary interoperable format.
  Imports match both canonical keys and existing Thai field labels. The unpublishable
  new-model-result option is removed from the import chooser; old result drafts
  remain available for review/export. Station/satellite/crop ingestion remains
  available because durable storage is implemented, with its non-live limitation.
- Only the exact unpublished cutover verification draft recorded in
  `CMS_CUTOVER_20260928.md` is omitted from the normal task list. No record is
  deleted, and arbitrary operator drafts are never filtered by a test-like title.

Checks and rendered evidence are recorded in `docs/CMS_NO_CODE_20260930.md`.

## Owner Requirements

The local CSV / XLS / XLSX rev3 import follow-up is documented in
`docs/CMS_REV3_IMPORT_20260930.md`. It adds Thai column matching, templates,
samples and a separate dictionary sheet while keeping the existing-origin
publication boundary. The files and UI have not been deployed.

- Reuse Supabase Auth and existing staff accounts. Staff and Admin have the same
  operational role for this release; display personas never grant permission.
- `/admin/login` requires a separate sign-in even when the visitor session is
  active. Same accounts/provider, separate persisted sessions and tab channels.
  Signing out either scope must preserve the other scope's refresh session.
- No-code upload, inspect, resolve errors, edit, validate, export and explicitly
  publish. An upload is not publication.
- API and files use the same domain fields and validators. CMS bookkeeping is a
  separate envelope, not a second observation/forecast schema.
- Move all current business datasets behind CMS-managed storage. A CMS screen
  alone does not satisfy this: the actual consumer must stop reading bundled data.
- Keep original source, corrections, revisions and audit history. Published
  revisions are immutable. Detect concurrent edits instead of last-write-wins.
- Only Nakhon Ratchasima. Do not activate parked Actual or nationwide demo views.
- Reuse the current brand, auth shell, searchable selects and dialog behavior.

## Contract Inventory

| Family | Existing authority | CMS behavior |
| --- | --- | --- |
| Station observations | `server/model-inputs/contract.mjs` | Same V1 envelope and all required/optional fields; immutable accepted batch |
| Satellite and crop | `server/model-inputs/domain-contract.mjs` | Same V1 fields, units, quality, provenance and null semantics |
| Model result | `server/model-inputs/model-contract.mjs` | Same scope, cutoff, input-batch provenance and six prediction cells |
| Current forecast archive | Supabase forecast tables / rev03 verification artifact | Reviewed adapter; origin T, target T+h; original workbook blanks are out of scope |
| Geography and routing | Admin hierarchy and GeoJSON | Codes are keys, names are labels; read-only area workspace; structural/coverage checks are required for replacement |
| Retired registries, research and demo content | Historical CMS revisions only | Removed from runtime and active seed in the approved 2026-10-03 cleanup; retain original/history reads, reject clone/edit/publish |
| Personal workspaces | Existing user-owned Supabase tables | Remain user-owned, not public CMS data; preserve RLS |
| User identity | Supabase Auth | No password/role editing in generic data forms |

Code constants defining schemas, validation rules, UI labels, brand tokens and
the supported geographic boundary are configuration, not business observations.
They must not be replaced with remotely editable executable logic.

## Safety And Activation

The implementation must fail closed if CMS storage/permissions are unavailable.
No server secret may enter Vite variables or browser bundles. Use the signed-in
session; never accept an actor ID, an Admin persona or a role from the browser as
authorization. Explicit operator membership is attached to existing Auth users.

Original imports and prior published versions are immutable. Corrections create
draft revisions with actor, timestamp, reason and before/after values. A stale
revision is a conflict, not a successful save. Validation uses the same existing
API validators, including rejection of unknown fields. Export keeps every field,
including nulls, timestamps, units and provenance. No hidden unit/date coercion.

Production cutover requires approved migration/seed, exact row/field/hash parity,
permission tests, runtime read-path checks and a rollback checkpoint. Do not mark
the no-hardcoded-data requirement complete until every active reader is migrated.

## Delivery Checklist

- [x] Locate existing APIs, schemas, runtime readers and unpublished integrations.
- [x] Shared input/edit/export field descriptors and existing API validators.
- [x] Durable drafts, immutable original payloads, revision conflicts and audit.
- [x] XLSX/JSON upload, column mapping, issue resolution, filtered editor and export.
- [x] Reviewed corrections to existing forecast origins publish as new versions.
- [x] Prepare lossless seed for 45 reference/geometry/retained resources.
- [x] CMS build replaces registered JSON imports and map file reads; no fallback.
- [x] Local permission, lifecycle, null/zero, provenance and API parity tests.
- [ ] Complete the remaining feature gates below; this is not a full CMS release.
- [x] Owner-approved remote migrations/seed and real-account CMS candidate checks.
- [x] Owner-approved production cutover and real-account post-promotion checks.

## Implemented Boundaries

Design reuse is intentional: CMS uses the same `AppSelect`, `MonthSelect`,
`WorkspaceDialog`, `Skeleton`, button classes, brand tokens/fonts, shell and
account controls as the visitor UI. `WorkspaceEmptyState` serves both CMS and
the visitor irrigation adapter. Login uses one form implementation. Table
editing/pagination and publication workflows remain CMS-owned; consistency
does not justify sharing domain state or visitor/Admin sessions.

`/admin` uses an independent Supabase session and the shared app shell. Visitor
`/login` and `/admin/login` share `LoginScreen`, styling and error/password
behavior. `authScope.ts` selects distinct SDK storage/broadcast keys; crossing
between visitor/Admin performs document navigation and same-scope return URLs
only. Visitor keys remain backward compatible. This is browser session isolation,
not a second user directory or an additional permission tier. The server
verifies the token with Auth and checks `ktp_cms_operators`; the SQL RPC repeats
the membership check. Personas in the retained `users` resource never grant
permission. No service key is exposed through Vite variables.

`/api/admin-data` uses `CMS_SUPABASE_URL` and `CMS_SUPABASE_SECRET_KEY` on the
server. Unconfigured environments show an unavailable state, not demo records.
Existing accounts are enrolled when the draft migration is explicitly applied;
review that account list before approving the migration. Later accounts are not
automatically enrolled.

Station, satellite and crop batches retain the exact existing API envelope,
units, quality, optional fields and null semantics. Acceptance uses the original
validators and immutable `model_input_batches` storage. A draft may contain
invalid values so the operator can repair them; neither browser validation nor
a successful upload authorizes acceptance. Unknown columns require an explicit
ignore decision. Imports do not execute spreadsheet formulas.

The archive-review envelope differs from a model-result envelope deliberately:
it references an existing `baseDatasetId` and origin, rather than inventing a
model cutoff or input-batch provenance. Its prediction cells use the same shared
fields as the forecast API. Publication checks the latest base, complete
289-area x 6-horizon grid, exact T+h dates and risk/status agreement. It clones
the dataset atomically and keeps previous publications and other origins intact.
Readers and readiness checks recognize `admin_reviewed_forecast` explicitly.

The original `Master_Data_Drought_Final` shape (Year, Month, ID, names,
Irrigation_Status, Pred_Risk_T+1..6) has a no-code adapter for existing origins.
Source IDs join through the database crosswalk, never guessed names. Exact
duplicates collapse; conflicting cells become visibly unresolved draft values,
not last-row-wins. Missing areas cannot become blank/out-of-scope predictions.
The selected origin's source rows, sheet name and workbook SHA-256 are retained
as immutable import evidence. This does **not** retain the original file binary.

The local importer also accepts Thai headers from `src/admin/rev3Fields.json`,
manually selected equivalent columns, CSV (UTF-8 or explicit Windows-874), and
binary XLS. CSV fields remain strings until the selected rev3 field interprets
them. Human risk labels map to the same numeric/null semantics, while unknown
values remain visible for correction. Template placeholders `ยังไม่กรอก` are
blocked; they cannot silently become out-of-scope. Source evidence preserves
the uploaded column names and values and physical row numbers, including CSV
quoted multiline fields. Helper sheets in the shipped template are not imported.

Excel parsing runs in a cancellable worker with a 60-second deadline, 20 MB file
limit, 100,000-row/100-column sheet limit. Normal API imports explicitly select
up to 2,000 rows per draft; acceptance retains the original 1 MB API batch limit.
XLSX exports use Cordia New, centered data, frozen headers and filters; large
metadata is chunked below Excel's cell-text limit. JSON is the lossless original
payload export, including invalid values before repair.

## Reference Read Path

`shared/cmsResources.mjs` inventories five active resources: the genuine
administrative hierarchy, generated forecast summary and three geometry layers.
Only hierarchy and summary preload; geometry loads when needed. The initial
45-resource cutover inventory below is historical evidence, not the active
catalog. Retired database revisions retain original/history access but are
excluded from startup, seeding and mutation.

`scripts/prepare-cms-reference-seed.mjs` only writes local preparation artifacts:

- `artifacts/admin-cms-20260927/migration/reference-seed.sql`
- `artifacts/admin-cms-20260927/migration/reference-inventory.json`

It performs no network operations. The seed is transactional and refuses to
overwrite a different existing revision. Local tests compare all seeded JSON
values with their originals, not only row counts.

The CMS build uses `VITE_REFERENCE_BACKEND=cms` alongside
`VITE_DATA_BACKEND=supabase`. Before importing the authenticated UI, the app reads
an authenticated reference catalog and one bundle containing the two required
preloaded resources. Immutable IDs pin the page session to coherent revisions. Geometry
loads on demand against the same catalog. A missing resource or failed request
fails closed; no catch handler loads bundled business data.

The Vite plugin substitutes the registered JSON consumers, including hierarchy,
search, scope and Excel selection. It also refuses unregistered canonical JSON
imports. CMS builds omit public GeoJSON copies and expose a
`reference-backend.json` marker. Original files remain in source control for
migration verification and explicit static regression builds only. Static mode
is not a fallback for CMS mode. Production now enables both database flags;
changing a build flag is not a substitute for the cutover gates.

Reference drafts preserve data shape, nulls, types, IDs, joins, provenance and
status labels. Safe scalar fields can be edited in a paginated, searchable UI;
unsafe URL schemes are rejected. Save conflicts and publication against a stale
base are rejected. Existing drafts are resumable from the resource list. History
records actors, reasons and values; published versions cannot be overwritten.
Navigation with unsaved edits is blocked. Shared dialogs let the owning form
defer close while saving or show a custom discard confirmation.
Explicit sign-out also respects unsaved changes; expired/revoked sessions still
leave the authenticated UI. Successful persisted imports explicitly release the
navigation guard before opening the new draft.

Saved forecast selections now require the actual loaded dataset ID. There is
no hardcoded original-revision fallback or original-revision date window in the
bookmark client. Database publication/run constraints remain authoritative.

## Remaining Feature Gates

Do not describe this as complete no-code ownership of every dataset yet:

- New forecast origins are implemented in the 2026-10-15 candidate, awaiting
  migration and release. Arbitrary model-result publication remains disabled.
- Geometry replacement, structural reference changes, new canonical areas and
  derived resource regeneration need domain-specific validation and coordinated
  publication. Those resources are inspect/export-only in the generic editor.
- The reference editor preserves array cardinality; it is not a generic schema
  migration tool. Pending/retained data cannot be promoted to real by changing a
  status field.
- Original XLSX/CSV bytes, durable raw-review checkpoints and UI restore are
  implemented in the 2026-10-15 candidate, not activated on production yet.
  Structured originals and previous publications remain preserved.
- The existing model-input validator still uses the canonical area allowlist
  as a validation contract. Moving/change-managing that registry across all API
  services needs a coordinated migration, not a browser-only edit.
- Before future cutovers, repeat real Supabase authorization, full-size
  publication timing, recovery and production row/hash parity. The 2026-09-28
  database results and remaining activation status are in the cutover record.
- iOS reference readers are not migrated by this web CMS release.
- Generalized arbitrary workbook schemas and geometry/asset upload are outside
  the implemented adapters. CSV upload is supported for rev3 and observation
  tables; format-specific metadata and repair limits are documented above.

## Candidate Runbook

1. Obtain owner approval for the target Supabase project and operator membership.
   Back up the live database and record the active forecast dataset/version.
2. Apply the already-required model-input migration, then CMS migrations
   `20260927010000`, `20260927020000`, `20260927030000`, then
   `20260928010000` in order on an isolated
   candidate with the forecast schema/data already present.
3. Review and apply the prepared reference seed there. Compare all 45 resource
   payloads and original hashes, forecast counts and sample T+h/null values.
4. Configure server-only CMS credentials for that candidate and build with both
   database backend flags. Never put a server secret in a `VITE_*` variable.
5. Exercise allowed/denied auth, edit/reload/conflict, import/export, publish,
   page reload, map geometry and failure-without-fallback using a real account.
   Rehearse full-size publication and a new reviewed revision restoring prior
   values. Do not delete immutable history as a rollback technique.
6. Record feature gates still open, migration report and candidate evidence.
   Ask the owner explicitly before any production migration or deployment.

Local checks live in `tests/admin-data`, `tests/adminWorkbook.test.ts`,
`tests/adminNormalizedForecast.test.ts`, `tests/workspaceDialog.test.tsx`,
`e2e/admin-data.spec.ts`, `e2e/admin-auth.spec.ts` and `e2e/cms-references.spec.ts`. Browser fixtures use an
isolated PGlite database and test-only Auth/network interception. They are never
imported by application code and are restricted to localhost.

### Initial Local Verification Evidence

- 39 Node tests passed across CMS contracts, isolated SQL migrations, shared
  API validators and operational endpoint compatibility.
- 40 Vitest tests passed across import/export, normalized workbook repair,
  forecast revision loading, bookmarks, shared dialogs, unsaved changes and auth.
- Built-preview browser flows cover desktop/mobile import, repair, reload,
  conflict, export, acceptance, reviewed forecast publication and reference
  publication. The map test verifies CMS geometry reads and zoom; missing CMS
  resources fail closed. No production account/data is used by these fixtures.
- Screenshots and local build/seed artifacts are under
  `artifacts/admin-cms-20260927/`; fixture annotations identify test-only edits.
- These initial local checks did not prove remote behavior. Subsequent authorized
  database/candidate/production verification is recorded in the cutover document.
  Broad unrelated iOS/parked-feature audits were not part of this web release.

# Korat Tan Phai / โคราชทันภัย Project Map

Documentation review: 2026-11-04, against this checkout at `dfc567d` and its
runtime `9f7c807`. This maps maintained source, not a fresh production inspection.
See [HANDOFF](docs/HANDOFF.md) for the latest verified release evidence.

## Purpose and Current Scope

Korat Tan Phai is an authenticated Nakhon Ratchasima drought dashboard. Active
surfaces are forecast overview, province/district/subdistrict six-horizon
forecasts, Excel reporting, personal saved workspaces and the no-code CMS at
`/admin`. The public workspace is forecast-only under
[FORECAST_ONLY_RESTORATION](docs/FORECAST_ONLY_RESTORATION.md).

Actual routing and its source integration remain parked by the owner's decision.
Metadata/validation/backend ingestion contracts are retained where real; they do
not imply configured live feeds. The satellite/DOAE/model publication architecture
in [MODEL_PIPELINE_DESIGN](docs/MODEL_PIPELINE_DESIGN.md) remains a future design.

The source cleanup removes synthetic nationwide/workflow data, the old source
registry and research/rainfall stubs, rev02 files/builders, the unused national demo
map and risk-fusion endpoint. It preserves original rev03 lineage, real hierarchy,
map geometry, source-backed CMS operations, stored history and saved selections.

## Project Coordinates

- Repository: `/Users/point/korattanphai`
- Remote: `https://github.com/purichw/korattanphai.git`
- Production: `https://korattanphai.vercel.app`
- Vercel project: `korattanphai`
- Stack: Vite, React, TypeScript and Supabase Auth/database; Vercel handlers.
- Current checkout/branch and release SHA must be checked before edits or deploy.
  A document timestamp does not authorize overwriting another checkout's changes.

## Route and Surface Map

| Path/surface | Responsibility |
| --- | --- |
| `/login` | Visitor email/password login and internal return path |
| `/` | Nakhon Ratchasima province forecast overview |
| `/drought` | Province six-horizon drought forecast |
| `/{district-slug}` | District workspace |
| `/{district-slug}/{subdistrict-slug}` | Subdistrict workspace |
| `/nakhon-ratchasima/...` | Compatible aliases for existing geographic links |
| `/admin/login` | Independent admin sign-in |
| `/admin` and its detail/import screens | Data management, drafts and publication |
| Excel export / saved workspaces | Dialogs within the visitor workspace |

Visitor and admin navigation have distinct purposes. Admin links stay in admin
workflows; legacy nationwide, farmer, alert/publication demo sections are removed.
Actual/operational components are not mounted by current public workspace routes.

## Main Ownership Map

| Files/directories | Owns |
| --- | --- |
| `src/main.tsx`, `src/App.tsx` | Root, lightweight login/startup, history, lazy loading |
| `index.html`, `src/components/AppStartup.tsx`, `src/app-startup.css`, `src/startupMotion.ts` | Shared pre-JS/React illustrated loading, real readiness steps, continuous orbit and reduced motion |
| `src/components/PageLoadBoundary.tsx` | Blocking page-read registration, hidden/inert content, immediate release plus visual completion fade |
| `src/theme-tokens.css`, `src/brand-theme.css` | Navy / Powder / Amber web paint; shared Visitor/Admin palette, no layout changes |
| `src/AuthenticatedApp.tsx` | Visitor shell, account controls, export and saved actions |
| `src/store.tsx`, `src/persistedState.ts`, `src/browserStorage.ts` | Supported language/month preferences and storage recovery |
| `src/domain.ts`, `src/data/catalog.ts` | Real hierarchy-derived locations, code/slug lookup and routing |
| `src/components/NakhonRatchasimaWorkspace.tsx` | Route composition, scope and loading |
| `src/components/nakhon-ratchasima/` | Local map, camera/geography helpers, forecast controls/model and views |
| `src/forecastPeriod.ts`, `src/data/forecastScope.ts` | Origin/horizon calendar and administrative request scope |
| `src/useForecastArchive.ts`, `src/data/supabaseForecastArchive.ts` | Revision-aware scoped database loading |
| `src/data/cmsReferences.ts`, `shared/cmsResources.mjs` | Five-resource active catalog and pinned reference loading |
| `src/data/localMapGeometry.ts` | Shared bounded loading for three map geometries |
| `src/admin`, `server/admin-data` | No-code CMS import/repair, reviewed downloads, publication/history, new rounds, readiness, private checkpoints and recovery; released contracts in `docs/CMS_FORECAST_LIFECYCLE.md` |
| `src/authScope.ts`, `src/useAuth.ts`, `src/supabase.ts` | Separate account session scopes and shared lazy client |
| `src/access` | Parked officer-role scaffold; visitor compatibility mode remains explicit |
| `src/styles.css`, `src/admin/admin.css` | Existing brand tokens, layout, responsive component styles |
| `src/types.ts`, `src/i18n.ts` | Current data types, Thai labels and formatting |
| `api/`, `server/model-inputs`, `server/operations` | CMS/input/operational handlers and isolated backend services |

Shared UI includes `AppSelect`, `PageSummary`/`MetricGrid`/`MetricCard`,
`MapPreviewFooter`, loading primitives, dialogs and `WorkspaceBookmarks`.
Preserve their keyboard, mobile, alignment and navigation contracts when reusing.

## Data and Source Map

Retained canonical source files:

- `src/data/canonical/nakhon_ratchasima/admin_hierarchy.json`: one province,
  32 districts and 289 subdistricts, or 322 real location nodes.
- `src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json`:
  normalized original Excel archive for integrity checks/static regression mode.
- `data/normalized/drought-rev03/`: original normalization lineage and manifests.

Generated `forecast-archive-summary.json` and `forecast-overview-t1.json` derive
from rev03 before dev/build. Do not hand-edit them or treat them as new sources.
Database builds exclude raw archive assets and load current published revisions.

`shared/cmsResources.mjs` contains exactly five active read-only system resources:
real hierarchy, generated forecast summary, local subdistrict geometry, local
province boundary and Thailand ADM1 neighbor context. Bootstrap requires only
the first two payloads; authenticated Visitor entry then preloads the three
geometries alongside workspace/forecast loading, sharing requests with map readers.
Admin and signed-out entry do not trigger that Visitor preload. Retired
catalog rows may still exist in CMS history but are not active runtime inputs.

Source geometry is retained at:

- `public/geodata/nakhon-ratchasima-subdistricts.geojson`
- `public/geodata/nakhon-ratchasima-boundary.geojson`
- `public/geodata/thailand-adm1.geojson`

CMS builds fetch pinned published reference IDs with no static fallback. Static
regression builds use these files. Regenerate the local outline from all local
polygons using `npm run generate:nr-boundary`, never manual coordinate edits.
ADM1 provides neighboring province context, not a nationwide risk dataset.

## Runtime Data Flow

```mermaid
flowchart LR
  Login["Visitor session"] --> App["Forecast workspace"]
  App --> Refs["CMS hierarchy + summary"]
  App --> Map["Three pinned map geometries"]
  App --> Load["Area + source T + horizon"]
  Load --> Revision["Published revision check"]
  Revision --> Slice["Scoped forecast slice RPC"]
  App --> Saved["Owner-only followed areas / filters"]
  App --> Export["Excel export"]
  Export --> Load
  App --> Prefs["Language / month preferences"]
  Admin["Independent admin session"] --> Draft["Import / edit / validate draft"]
  Draft --> Publish["Explicit publish + audit/originals"]
  Publish --> Revision
```

Database mode uses `VITE_DATA_BACKEND=supabase`; CMS references use
`VITE_REFERENCE_BACKEND=cms` and require database mode. Loaders preserve source
scope, verify revision before cache reuse and dispose protected caches on account
changes/logout. Initial failures show retry, not bundled predictions or zero risk.
Static mode is an isolated regression configuration, not a recovery fallback in
production. See [FORECAST_SCOPED_LOADING](docs/FORECAST_SCOPED_LOADING.md).

Preferences use `korat-tan-phai-preferences-v1` and contain language/month only.
The previous demo-state key is read only for compatible preferences; old workflow
fields are ignored and the snapshot is preserved. Auth and database saved rows
are separate. A failed database save cannot be reported as browser-only success.

Current Vercel APIs are `/api/admin-data`, `/api/model-inputs`,
`/api/operational-context`, `/api/health` and `/api/telemetry`. Accepted model inputs
are stored separately and cannot automatically publish forecasts. Clock/source-gap
metadata does not establish a live actual feed. Configuration/release evidence is
in [API](docs/API.md), [NFR operations](docs/NFR_OPERATIONS_RUNBOOK.md) and HANDOFF.

## Product and Data Contracts

- Visible UI remains Thai and usable without technical knowledge. Use actual
  buttons, clear field descriptions, sample values and honest validation states.
- Preserve `TH-P29`, administrative code `30` and all existing area links. Join
  values using administrative codes, never Thai names or route slugs.
- Source workbook Year/Month is origin T. T+1 through T+6 are forward calendar
  months; source T itself is not a T+0 risk. Legacy URL `target` and saved
  `target_period` still select source T and must not be reinterpreted.
- Original rev03 has 289 mapped source IDs, 127 origins (`2015-06`–`2025-12`) and
  220,218 vintages. These are baseline validation facts; visible current periods,
  counts and latest revision come from the published data, not UI constants.
- Risk `0` means no detected forecast risk, `1` moderate, `2` high. Blank is
  out-of-scope; missing rows are a separate problem. Neither becomes a green zero.
- Workbook irrigation is independent of forecast risk. No live water, weather,
  rainfall or agricultural area feed is implied by the two available map modes.
- Forecasts are not official damage observations. Parked actual/agriculture
  components require verified inputs before they can show real values.
- Forecast CMS import/edit/publish remains active; system references stay read-only.
  Unknown/retired reference keys cannot be cloned, edited or published, while
  stored original/version/history access remains intact.
- Visitor/admin sessions stay independent, including refresh and sign-out.
  No persona or client-editable label grants permission.

## Running and Verifying

```bash
npm install
npm run dev
npm run build:protected
```

Vite defaults to `http://127.0.0.1:5173`. Use the project launchers in `package.json`;
`scripts/local-runtime.mjs` checks the actual host's local-runtime restrictions.
Use attached or managed Playwright mode as supported by that environment.

Match verification to changed risk. Target geography/routing tests for joins,
CMS/backend tests for permission/publication behavior and map/loading tests for
shared loaders. Use build/bundle/exposure gates and affected browser journeys for
release; do not run broad suites merely because a document lists them.

For an authorized deployment, follow [RELEASE_RUNBOOK](docs/RELEASE_RUNBOOK.md)
and [PRODUCTION_SMOKE](docs/PRODUCTION_SMOKE.md). Check the intended revision,
required CI, build and promotion separately. Verify real authenticated reads,
no-code admin journeys, independent sessions, mobile map labels and affected
routes. `/api/health` is a liveness surface; it does not prove that input feeds,
schedulers or private readiness are configured. Do not test deleted demo endpoints.

Local tests may use explicit fixtures. Production/preview reads require an
approved real account; never commit credentials or silently replace runtime data
with test fixtures. Source cleanup alone does not authorize remote data deletion.

## Documentation Guide

- [ARCHITECTURE](docs/ARCHITECTURE.md), [DATA_CONTRACT](docs/DATA_CONTRACT.md):
  active ownership, source/time semantics, persistence and loading boundaries.
- [APP_MAP](docs/APP_MAP.md), [INTERACTION_MAP](docs/INTERACTION_MAP.md): current
  surfaces and user journeys.
- [DROUGHT_REV03_NORMALIZATION](docs/DROUGHT_REV03_NORMALIZATION.md),
  [DROUGHT_REV03_CUTOVER](docs/DROUGHT_REV03_CUTOVER.md): original source lineage
  and historical cutover evidence.
- [CMS_CUTOVER_20260928](docs/CMS_CUTOVER_20260928.md): historical CMS activation;
  the current resource allowlist is in code and DATA_CONTRACT.
- [ACTUAL_FORECAST_SEPARATION](docs/ACTUAL_FORECAST_SEPARATION.md): parked actual
  eligibility and future integration guards, superseded routing as noted above.
- [RAINFALL_SOURCE_AUDIT](docs/RAINFALL_SOURCE_AUDIT.md): historical source/proxy
  research, not a current feed inventory.
- [NOTIFICATION_CONTRACT](docs/NOTIFICATION_CONTRACT.md): historical demo/future
  provider cautions, not an active delivery service.
- [AUTH_SETUP](docs/AUTH_SETUP.md), [WORKSPACE_ACCESS](docs/WORKSPACE_ACCESS.md),
  [OPERATIONS](docs/OPERATIONS.md), [API](docs/API.md): access and backend scope.
- [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md), [SHARED_COMPONENTS](docs/SHARED_COMPONENTS.md):
  visual direction and component interaction contracts.
- [LOADING_SCREEN](docs/LOADING_SCREEN.md): shared illustrated startup, responsive
  assets, real readiness and recovery behavior, and reference comparison evidence.
- [HANDOFF](docs/HANDOFF.md): release checkpoint, evidence and outstanding risks.

Historical specifications preserve provenance but do not override current code,
verified source data or explicit product decisions. A deleted runtime file should
not be restored merely to satisfy an old diagram or source inventory.

### Complete reading index

Use the relevant row, not every document for every task. Dated evidence records
what was checked then; it does not certify the current alias or device install.

| Area | Maintained contracts / operating guides | Dated evidence, research or parked design |
| --- | --- | --- |
| Orientation | [README](README.md), [AGENTS](AGENTS.md), this map, [HANDOFF](docs/HANDOFF.md) | — |
| Runtime and journeys | [ARCHITECTURE](docs/ARCHITECTURE.md), [APP_MAP](docs/APP_MAP.md), [INTERACTION_MAP](docs/INTERACTION_MAP.md), [FORECAST_ONLY_RESTORATION](docs/FORECAST_ONLY_RESTORATION.md) | [ACTUAL_FORECAST_SEPARATION](docs/ACTUAL_FORECAST_SEPARATION.md), [rollback parking lot](docs/rollback-parking-lot.md) |
| Design and loading | [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md), [BRAND_SURFACE_THEME](docs/BRAND_SURFACE_THEME.md), [SHARED_COMPONENTS](docs/SHARED_COMPONENTS.md), [LOADING_SCREEN](docs/LOADING_SCREEN.md) | [HOME_OVERVIEW_PARITY](docs/HOME_OVERVIEW_PARITY.md), [DROUGHT_WORKSPACE_PARITY](docs/DROUGHT_WORKSPACE_PARITY.md), [semantic audit](docs/SITEWIDE_SEMANTIC_AUDIT_2026-09-05.md), [sidebar account release](docs/SIDEBAR_ACCOUNT_RELEASE_20260930.md) |
| Forecast tools | [SEARCH_BEHAVIOR](docs/SEARCH_BEHAVIOR.md), [FORECAST_MAP_TOOLS](docs/FORECAST_MAP_TOOLS.md), [FORECAST_EXCEL_EXPORT](docs/FORECAST_EXCEL_EXPORT.md), [FORECAST_SCOPED_LOADING](docs/FORECAST_SCOPED_LOADING.md) | [IRRIGATION_FILTER](docs/IRRIGATION_FILTER.md) contains original rev02-era evidence; current source authority is rev03 |
| Data | [DATA_CONTRACT](docs/DATA_CONTRACT.md), [API](docs/API.md) | [rev03 normalization](docs/DROUGHT_REV03_NORMALIZATION.md), [rev03 cutover](docs/DROUGHT_REV03_CUTOVER.md), [original Supabase migration](docs/SUPABASE_DATA_MIGRATION.md), [legacy cleanup](docs/LEGACY_CLEANUP_20261003.md) |
| CMS | [ADMIN_CMS](docs/ADMIN_CMS.md), [CMS_FORECAST_LIFECYCLE](docs/CMS_FORECAST_LIFECYCLE.md) | [CMS cutover](docs/CMS_CUTOVER_20260928.md), [no-code implementation](docs/CMS_NO_CODE_20260930.md), [no-code release](docs/CMS_NO_CODE_RELEASE_20260930.md), [rev3 import](docs/CMS_REV3_IMPORT_20260930.md) |
| Auth | [AUTH_SETUP](docs/AUTH_SETUP.md), [WORKSPACE_ACCESS](docs/WORKSPACE_ACCESS.md) | Historical account/configuration checks stay dated within these guides |
| Release and performance | [RELEASE_RUNBOOK](docs/RELEASE_RUNBOOK.md), [ACTIONS_USAGE](docs/ACTIONS_USAGE.md), [PRODUCTION_SMOKE](docs/PRODUCTION_SMOKE.md) | [performance audit](docs/PERFORMANCE_20261011.md), [theme dependency repair](docs/THEME_RELEASE_DEPENDENCIES_20261103.md), [NFR regression](docs/NFR_REGRESSION_2026-09-09.md) |
| Operations | [OPERATIONS](docs/OPERATIONS.md), [NFR_OPERATIONS_RUNBOOK](docs/NFR_OPERATIONS_RUNBOOK.md), [NON_FUNCTIONAL_REQUIREMENTS](docs/NON_FUNCTIONAL_REQUIREMENTS.md), [ANALYTICS](docs/ANALYTICS.md), [SEO](docs/SEO.md) | [ALERTING](docs/ALERTING.md), [NOTIFICATION_CONTRACT](docs/NOTIFICATION_CONTRACT.md) describe removed demo/future delivery contracts |
| Research and proposed integrations | [MODEL_INPUT_DATA_MAPPING](docs/MODEL_INPUT_DATA_MAPPING.md) describes the implemented V1 envelope and proposed adapters | [MODEL_PIPELINE_DESIGN](docs/MODEL_PIPELINE_DESIGN.md), [THAI_AGRICULTURAL_DATA_RESEARCH](docs/THAI_AGRICULTURAL_DATA_RESEARCH.md), [RAINFALL_SOURCE_AUDIT](docs/RAINFALL_SOURCE_AUDIT.md), [AGRI_MAP_CAPABILITY_COMPARISON](docs/AGRI_MAP_CAPABILITY_COMPARISON.md) are not proof of live feeds |
| Native | [Mobile README](apps/mobile/README.md), [NATIVE_PARITY](apps/mobile/NATIVE_PARITY.md) | Simulator, device install and export evidence are separate; no TestFlight/App Store release is recorded |

### Project skills and maintenance

- `$korat-tan-phai-new-chat` at
  `/Users/point/.codex/skills/korat-tan-phai-new-chat/SKILL.md` owns onboarding
  and its `references/new-chat-context.md` reading/continuation guide.
- `$korat-tan-phai-shared-components` at
  `/Users/point/.codex/skills/korat-tan-phai-shared-components/SKILL.md` routes
  component work to the maintained owner and current product contracts.
- These user-local skills are outside Git. A project commit does not publish
  skill edits. Shared UI/motion/release skills remain generic; keep project
  palettes, release SHAs and data contracts here rather than copying them there.
- Resolve repo-relative docs against the current authorized worktree, not a
  hardcoded main checkout. Keep source/runtime, docs commits, hosted CI,
  deployment and physical-device proof separate. Update the canonical contract
  and link it from maps/skills; preserve dated history with a supersession note.

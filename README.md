# Korat Tan Phai / โคราชทันภัย

Authenticated drought dashboard for Nakhon Ratchasima, derived from the Kaset
Tan Phai prototype. The active product is forecast-only: source-backed drought
predictions, irrigation context and Excel reporting. Actual routing is parked at
the owner's request; this is not a live actual-data or multi-hazard alert service.
The site brand is Korat Tan Phai / โคราชทันภัย.

## Where To Start

1. Read [PROJECT_MAP.md](PROJECT_MAP.md) for the full repo map, current state,
   guardrails, and maintainer reading order.
2. Read [docs/APP_MAP.md](docs/APP_MAP.md) before changing routes, navigation,
   or user-facing surfaces.
3. Read [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md) before changing canonical
   JSON, runtime state, alert payloads, or map joins.
4. Read [docs/SHARED_COMPONENTS.md](docs/SHARED_COMPONENTS.md) before adding,
   changing, or standardizing shared UI components.
5. Read [docs/RELEASE_RUNBOOK.md](docs/RELEASE_RUNBOOK.md) before commit, push,
   deploy, or production smoke work.
6. Read [docs/ADMIN_CMS.md](docs/ADMIN_CMS.md) for CMS contracts, editable data,
   permission boundaries and remaining feature gates. The approved migration
   checkpoint is [docs/CMS_CUTOVER_20260928.md](docs/CMS_CUTOVER_20260928.md).

## Main Surfaces

All visitor product routes open the forecast workspace. `target` means source month T and
`horizon` selects T+1 through T+6, with or without `mapLayer=forecast-archive`.
Retired `period` links open the default forecast selection, never treating an
actual valid month as an origin. See the [restoration contract](docs/FORECAST_ONLY_RESTORATION.md)
and latest [release checkpoint](docs/HANDOFF.md).

The app is a Thai-only single-page application. Navigation exposes `ภาพรวม`,
its `ภัยแล้ง` subitem, and `ส่งออก Excel` in database mode. `/` opens the
Nakhon Ratchasima workspace after login.

- Province overview: `/`
- Province drought context: `/drought`
- District: `/{district-slug}`
- Subdistrict: `/{district-slug}/{subdistrict-slug}`
- Legacy aliases under `/nakhon-ratchasima/...` are still accepted for old links.
- Excel export and personal saved areas/filters open dialogs, not separate routes.
- Inherited nationwide, farmer, approval and notification components are not
  active product features. Their presence in source is not evidence of delivery.

## Login

Login uses Supabase Email + Password with an admin-provisioned account. Set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the local environment
using `.env.example` as the placeholder reference. No demo username bypass exists.
Missing configuration denies entry with a not-ready message. Never expose a
service-role JWT, `sb_secret` key or database password through Vite variables.

Visitor `/login` and CMS `/admin/login` use the same accounts and shared login
form, but independent SDK sessions. Entering `/admin` requires Admin sign-in;
logging out one scope does not revoke the other scope. CMS access additionally
requires server-verified operator membership; retired personas grant no access.
`VITE_DATA_BACKEND=supabase` reads the verified Excel
archive through authenticated RLS and saves personal areas/filters per account.
CMS builds also use `VITE_REFERENCE_BACKEND=cms` to read versioned reference
resources and geometry from authenticated storage, with no bundled fallback.
Original static files remain for verification builds; earlier deployment assets
may remain public. See [Data Migration](docs/SUPABASE_DATA_MIGRATION.md)
for historical source integrity and [Auth Setup](docs/AUTH_SETUP.md) for the Preview
checklist, test-only mocks, unverified backend prerequisites and SMTP limitations.

## Current Maintenance Context

The latest verified release in this checkout is `9f7c807` (2026-11-03), with
documentation checkpoint `dfc567d`. [HANDOFF](docs/HANDOFF.md) owns exact runtime,
CI, candidate, promotion and smoke evidence; recheck the served revision before
a future release. A docs-only checkpoint is not another runtime deployment.

- Visitor and Admin share the illustrated [loading screen](docs/LOADING_SCREEN.md).
  Its 0/33/67/100% values count completed auth/module/page-read milestones,
  not bytes or elapsed time. Pending work does not advance the bar; the
  blue/amber orbit remains continuous across screen replacement.
- The [CMS lifecycle](docs/CMS_FORECAST_LIFECYCLE.md) is released: new forecast
  rounds, computed data readiness, server-saved import review and recovery into
  a new draft. Readiness does not imply accuracy or permission to publish.
- [Navy / Powder / Amber](docs/BRAND_SURFACE_THEME.md) is the website palette.
  Preserve the layout, original logo and visible gold-rice artwork.
- [Native iOS](apps/mobile/README.md) has real Auth and forecast workflows.
  [NATIVE_PARITY](apps/mobile/NATIVE_PARITY.md) records remaining feature/device
  gaps. The new web skin/loading release does not update the native binary.
- Use the current worktree for this task. The default branch or the main
  checkout is not necessarily the deployed source. Project-specific skills
  and the complete documentation index are in [PROJECT_MAP](PROJECT_MAP.md).

## Commands

For the new local-system JSON/CSV collector and model-input API, run
`npm run model-inputs:demo` for a synthetic end-to-end example. Setup and the
POST/GET contract live in [docs/API.md](docs/API.md#model-inputs-local-system-bridge).
It has no live source or automatic forecast publication configured yet.
Verified Thai source fields and research are in
[docs/THAI_AGRICULTURAL_DATA_RESEARCH.md](docs/THAI_AGRICULTURAL_DATA_RESEARCH.md).

Operational hardening, measurable requirements and activation status are in
[Non-functional requirements](docs/NON_FUNCTIONAL_REQUIREMENTS.md) and the
[NFR operations runbook](docs/NFR_OPERATIONS_RUNBOOK.md). The NFR handlers were
deployed to [production](https://korattanphai.vercel.app) on 2026-09-09: public
health returns 200; model-input ingestion and private readiness return 503
because they remain unconfigured; telemetry POST returns 204 while disabled.
No remote migration, live feed/scheduler, monitoring, notification recipient or remote log
store was activated. V2 remains proposed; see [release evidence](docs/HANDOFF.md).
`npm run check:health` checks the existing public web/API without modifying data.
`npm run test:operations` verifies operational endpoint contracts locally.
`npm run model-inputs:job`, `model-inputs:backup`, and `model-inputs:restore`
provide one-shot collection, source-scoped export and empty-local-target restore.

```bash
npm install
npm run dev
npm run build
npm run build:protected
npm test
npm run test:e2e
```

The `dev`, `preview`, and `test:e2e*` scripts run through local-runtime guards.
When the Codex sandbox blocks localhost binding or Chromium launch, they fail
fast with the outside-sandbox commands to use instead of a raw Vite/Chromium
stack trace.

Codex/sandbox E2E workflow:

```bash
# terminal 1, run outside the Codex sandbox
VITE_SUPABASE_URL=https://ktp-auth-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_only npm run dev:e2e

# terminal 2, run outside the Codex sandbox
npm run test:e2e:attached
```

When the current sandbox blocks local port binding or browser launch, use the
supported outside-sandbox/attached path. Otherwise
`npm run test:e2e:managed` starts Vite automatically. Follow the runtime guard's
actual result; not every Codex host has the same restrictions.

Production target: [https://korattanphai.vercel.app](https://korattanphai.vercel.app)

Do not commit, push, deploy, migrate, or touch production data unless the current
user task explicitly authorizes it.

## Canonical Docs

- [PROJECT_MAP.md](PROJECT_MAP.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/APP_MAP.md](docs/APP_MAP.md)
- [docs/AGRI_MAP_CAPABILITY_COMPARISON.md](docs/AGRI_MAP_CAPABILITY_COMPARISON.md)
- [docs/INTERACTION_MAP.md](docs/INTERACTION_MAP.md)
- [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md)
- [docs/ACTUAL_FORECAST_SEPARATION.md](docs/ACTUAL_FORECAST_SEPARATION.md)
- [docs/RAINFALL_SOURCE_AUDIT.md](docs/RAINFALL_SOURCE_AUDIT.md)
- [docs/NON_FUNCTIONAL_REQUIREMENTS.md](docs/NON_FUNCTIONAL_REQUIREMENTS.md)
- [docs/NFR_OPERATIONS_RUNBOOK.md](docs/NFR_OPERATIONS_RUNBOOK.md)
- [docs/NFR_REGRESSION_2026-09-09.md](docs/NFR_REGRESSION_2026-09-09.md)
- [docs/RELEASE_RUNBOOK.md](docs/RELEASE_RUNBOOK.md)
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- [docs/SHARED_COMPONENTS.md](docs/SHARED_COMPONENTS.md)
- [docs/HANDOFF.md](docs/HANDOFF.md)
- [docs/ALERTING.md](docs/ALERTING.md)
- [docs/NOTIFICATION_CONTRACT.md](docs/NOTIFICATION_CONTRACT.md)
- [docs/OPERATIONS.md](docs/OPERATIONS.md)
- [docs/API.md](docs/API.md)
- [docs/ANALYTICS.md](docs/ANALYTICS.md)
- [docs/SEO.md](docs/SEO.md)

## Data Contract Snapshot

- Current forecast scope: 32 districts and 289 subdistricts in province code `30`.
- Prototype national risk, advisory/persona workflows, source registries and
  research-readiness layers have been removed from the runtime.
- Active CMS references are the genuine administrative hierarchy, forecast
  archive summary, subdistrict polygons, province boundary and Thailand ADM1.
  The first two are bootstrap payloads. After authenticated Visitor bootstrap,
  geometry preloads alongside workspace/forecast loading; map readers share
  those requests. Admin and signed-out entry do not preload Visitor geometry.
- Local preferences store only language/month under
  `korat-tan-phai-preferences-v1`; account data remains in Supabase.
- Nakhon Ratchasima local drill-down data lives under
  `src/data/canonical/nakhon_ratchasima/` and preserves `TH-P29` as the existing
  province with admin province code `30`, 32 districts, and 289 subdistricts.
- Database mode reads scoped, published rev03 forecasts through
  `src/data/supabaseForecastArchive.ts`. The canonical verification/static-mode
  artifact is `src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json`,
  derived only from `Drought_T1-6_rev03.xlsx`. It contains 289 mapped Source_IDs,
  127 origin months from June 2015 through December 2025, and 220,218 forecast
  slots, including out-of-scope cells. `Source_YearMonth` is origin T;
  `issueMonth = T` and `targetMonth = T + horizon`. December 2025 therefore
  forecasts January-June 2026. Rev02 is retired, not a fallback or authority.
- Supabase reads check the latest published revision before reusing cache;
  database failures never fall back to static predictions or ThaiWater.
- Irrigation comes from the same workbook: Collecting = unknown, RainFed =
  rainfed/no irrigation, Irrigation = access to irrigation. It is not a live
  water-level or irrigation-network dataset.
- Archive risk values are semantic forecast values: `0` no forecast risk, `1`
  moderate forecast risk, `2` high forecast risk, and blank workbook cells are
  out of scope. Do not collapse blank/out-of-scope values into no-risk or
  missing-evidence states.
- Historical rainfall fixtures and research panels were removed from runtime;
  their research documents are provenance, not active observation feeds.
- CMS mode fetches published local geometry from authenticated reference
  storage. The source/static verification files remain at
  `public/geodata/nakhon-ratchasima-subdistricts.geojson` and
  `public/geodata/nakhon-ratchasima-boundary.geojson`. The outline is generated
  from the same tambon geometry; these files are not a production fallback.
- Local Nakhon Ratchasima joins must use admin codes, not Thai names or route
  slugs. Missing local evidence must render as no-data/insufficient evidence,
  not low risk.
- Historical local map periods from `normalized_research_monthly_panel.json`
  and `normalized_research_panel_summary.json` were intentionally cleared for a
  dataset refresh. Do not restore December 2025 historical map periods unless a
  new source-backed refresh explicitly asks for that.

Visible rev03 values are source-backed archived forecasts, not synthetic scores,
current conditions, observed damage or a live prediction service. Synthetic
agriculture and operational fixtures remain separate and must not be reintroduced
as official data. Public-safety wording must retain uncertainty and source dates.

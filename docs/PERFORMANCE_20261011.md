# Loading Checkpoint (2026-10-11)

The initial audit inspected production read-only at runtime
`3742db78fee90b464e48f0585f76ce59682544b2`. The changes were subsequently
released as `8b05a25bbaa24ffafb2bf92fee0d47ff4614a190` on 2026-10-12
(Asia/Bangkok). No application data, database configuration or timeout changed.

## Changes

| Surface | Previous dependency | Change |
| --- | --- | --- |
| Visitor startup | Forecast response and map mount before geometry | After authenticated CMS bootstrap, preload pinned geometry alongside workspace code and forecast reads |
| Admin dashboard | Draft list before forecast/reference catalogs mount | Mount the independent catalogs while the list loads |
| Forecast Excel/CSV import | Month catalog before area crosswalk | Read both together; enable review only after both finish |
| Admin area view | Selected register before boundary counterpart | Use the account-owned catalog to start the counterpart while the selected payload loads |

Existing geometry/request deduplication, per-account cache ownership, revision
pinning, cancellation and error handling are reused. Admin and signed-out
startup do not preload Visitor geometry. The page-readiness boundary remains
in place; partial startup is not exposed as ready content. An unavailable
boundary remains unknown, never an assertion that all boundaries are missing.
The earlier preload applies only to CMS references. Static-mode loading keeps
its existing map-failure/manual-retry behavior rather than adding a speculative
read that could consume its first failure before the map mounts.

Area links still load their explicitly requested revision. Only a matching
catalog ID/draft ID permits early identification; unknown and older links use
the existing payload-first path. No latest-publication replacement is added.

## Evidence And Limits

- Live read-only probes covered Visitor initial load, reload, province/district/
  tambon navigation, Admin dashboard, imports navigation and area/map reads.
  Completed probes recorded successful HTTP responses, no application writes
  and no page errors. The previously observed intermittent HTTP 500 was not
  reproduced, and this change does not claim to fix that incident.
- Production samples showed initial waits around 9-15 seconds and one area
  entry around 9 seconds. These are diagnostic samples, not latency guarantees
  or valid before/after benchmarks: request interception disabled browser HTTP
  caching and the local host was under extreme concurrent load.
- Controlled browser tests hold one dependency pending and assert the other
  request has already started. The first three tests fail on the old build at
  precisely those assertions and pass on the changed protected build on both
  desktop and mobile, including no duplicate geometry/catalog reads.
- Targeted auth, CMS, geometry, Admin-read, readiness and forecast-provider unit
  tests passed (43 cases). TypeScript and the final protected build, exposure
  check and bundle budgets passed. No static archive fallback was introduced.
- Broader initial browser checks passed 17 cases with one pre-existing skip;
  two mobile workflows timed out during severe local contention (load average
  exceeded 190). One trace shows a local mock catalog alone taking 7.2 seconds.
  This was not treated as proof of a production regression. Both timed-out
  cases passed on the final build in one unchanged serial diagnostic rerun
  (2/2, 1.2 minutes). No assertions or timeouts were relaxed.
- Final area checks passed 8/8 on desktop/mobile: register/counterpart overlap,
  filtering, map/CSV/GeoJSON export, direct links/reload, unknown boundary and
  catalog failures/retry, and retained panels during revalidation. Screenshots
  were inspected for the Visitor/Admin mobile views and desktop/mobile area
  maps. No broader whole-site suite or hosted candidate benchmark was run at
  this local checkpoint; subsequent release coverage is recorded below.
- Pre-release static-mode loading/error/retry coverage prompted the CMS-only
  preload guard above. The updated source passed TypeScript and all 43 targeted
  unit tests again. Desktop/mobile loading tests passed 25/26; the one dev-module
  startup timeout passed an unchanged, isolated diagnostic rerun (1/1).
  The dev server also logged full-page reloads triggered by generated HTML
  under local test artifacts. Local contention and development reloads are
  limits on timing evidence, not grounds to weaken release assertions.

## Production Release (2026-10-12)

- Source commits: `f756b6a` (loading changes) and `8b05a25` (explicit Vercel
  upload exclusions matching `.gitignore`). Released from the existing scoped
  branch without including unrelated checkout changes.
- [Quality Gate 38156665900](https://github.com/purichw/KoratTanPhai/actions/runs/38156665900),
  attempt 2, passed all seven jobs on exact `8b05a25`: scope, contracts,
  built-browser, database-browser, cms-browser, browser-compatibility and
  regression. Attempt 1 failed before any runner steps because of account
  billing. The owner changed repository visibility, then the unchanged rerun
  passed. Tests, assertions and release gates were preserved.
- Candidate `dpl_F39b2Mi6SE1owJWJJ52xBQwBPFKG` passed its protected build,
  exposure and bundle budgets, plus authenticated read-only smoke: 39 Visitor
  checks, desktop/mobile Admin navigation and area workflows, and Excel/CSV
  review, download, external repair and revalidation. No application data was
  written. The same existing candidate was promoted; no replacement build was
  created to bypass the blocked CI run.
- The primary alias was verified against recovery deployment
  `dpl_BU1exuHZeWZUWaAtEAFVGpiqcjVK` (`3742db7`) immediately before promotion
  and against `dpl_F39b2Mi6SE1owJWJJ52xBQwBPFKG` (`8b05a25`) afterward.
  Hosted markers confirm Supabase forecasts and CMS references with
  `fallback: false`; `/api/health` returns process health with `no-store`.
- [Deployment Smoke 38159969482](https://github.com/purichw/KoratTanPhai/actions/runs/38159969482)
  passed on the production alias using exact `8b05a25` harness source.
  Independent production Admin/area and reviewed-file smoke passed on desktop
  and mobile, preserving separate login sessions and recording zero
  application-data writes. No database migration was performed.

Evidence: `artifacts/performance-20261011/` in the isolated
`artifacts/forecast-touch-pan-20261006` worktree. `production/` and
`production-areas/` contain read-only probe reports; `before-tests/`,
`after-tests/`, `final-area-tests/` and `mobile-diagnostic/` contain controlled
browser evidence. `candidate/` and `production-release/` hold the authenticated
release checks, and `release-receipt.json` records the deployment and CI status.
No claim of a specific percentage speedup should be made until an equivalent
hosted candidate is measured under comparable conditions.

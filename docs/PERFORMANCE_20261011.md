# Loading Checkpoint (2026-10-11)

Local changes only. Production was inspected read-only at runtime
`3742db78fee90b464e48f0585f76ce59682544b2`; no application data, database
configuration, deployment or timeout was changed.

## Changes

| Surface | Previous dependency | Local change |
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
  maps. No broader whole-site suite or hosted candidate benchmark was run.
- Pre-release static-mode loading/error/retry coverage prompted the CMS-only
  preload guard above. The updated source passed TypeScript and all 43 targeted
  unit tests again. Desktop/mobile loading tests passed 25/26; the one dev-module
  startup timeout passed an unchanged, isolated diagnostic rerun (1/1).
  Required hosted CI and candidate smoke remain pending before promotion.

Evidence: `artifacts/performance-20261011/` in the isolated
`artifacts/forecast-touch-pan-20261006` worktree. `production/` and
`production-areas/` contain read-only probe reports; `before-tests/`,
`after-tests/`, `final-area-tests/` and `mobile-diagnostic/` contain controlled
browser evidence.
No claim of a specific percentage speedup should be made until an equivalent
hosted candidate is measured under comparable conditions.

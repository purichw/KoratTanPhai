# Korat Tan Phai / โคราชทันภัย Interaction Map

## Active Product Journeys

Current navigation and ownership are in `APP_MAP.md`. The owner requested
[forecast-only restoration](FORECAST_ONLY_RESTORATION.md); Actual routing is parked.

1. Supabase login restores the requested internal forecast route and query.
2. Home uses the latest published origin and T+1 unless an origin is supplied.
   Plain and explicit archive links both preserve source month T and horizon.
   Root T+2..T+6 opens the full forecast view without losing district scope.
3. Page/map month selectors and page/strip horizon controls share the same state.
   Period changes revalidate the Supabase revision; late results cannot replace
   newer selections. Missing origins show recovery, never silently substitute latest.
4. Navigation, search, saved filters and browser history retain geographic scope
   and forecast selection. No Actual switch or operational clock request is active.
5. Map filters select risk and workbook irrigation. The locate-style icon returns
   to the area view, not device GPS. Existing camera/preview behavior is unchanged.
6. Province/district graphs switch percent/count; tambon pages show one status.
   Risk-summary, attention and guidance disclosures open one at a time.
7. Saved workspaces persist owner-only areas and named forecast filters in Supabase.
8. Excel export checks current revision and exports all six horizons; optional
   comparison aligns the same target calendar months. See `FORECAST_EXCEL_EXPORT.md`.

Agriculture/research panels require actual records; cleared/synthetic datasets
do not make them active. The nationwide, field-verification, farmer and delivery
journeys below describe historical prototype contracts removed from runtime,
not available services or retained executable components.

## Active Admin Journeys

1. `/admin/login` signs in independently with the existing Supabase accounts;
   server-verified CMS operator membership gates every operation.
2. `/admin` shows published forecasts/readiness, saved import work/drafts and
   the active reference catalogue. Names and tambon boundaries share one area
   workspace with district grouping/filtering and a boundary map.
3. Upload Excel/CSV, inspect source-row/cell issues, repair in the UI or download
   reviewed Excel/CSV for offline correction and fresh validation on reupload.
4. Save/resume the operator-private raw review, including original file bytes,
   with revision conflicts and failed saves kept visible. Conversion produces a
   canonical draft; the raw checkpoint is not a publication approval.
5. Create a new origin using an empty 289×6 draft or the normalized importer.
   Empty cells remain insufficient data. Validation, comparison against the live
   base, explicit reason/confirmation and atomic publication remain separate.
6. Recover one prior round into a new reviewed draft; other origins and immutable
   history remain intact. Never reset the live publication pointer to an old ID.

See [ADMIN_CMS](ADMIN_CMS.md) and [CMS_FORECAST_LIFECYCLE](CMS_FORECAST_LIFECYCLE.md).
Five active references are read-only system resources; geometry replacement and
arbitrary model output publication are not enabled by the forecast editor.

## Historical Prototype Journeys (not mounted)

The following demo IDs, personas and reducer actions describe the retired
prototype. They are not the current Admin authorization or forecast workflow.

### Resident / Farmer Alert Journey

1. Operator publishes an approved advisory.
2. Runtime creates a farmer alert for `FARM-001`.
3. Farmer persona sees the alert card.
4. Farmer taps the alert to mark it read.
5. Farmer sees the top recommended actions from the advisory.

Historical limitation: This was local demo state only. No real notification,
identity, acknowledgement receipt, or server audit exists.

### Local Operator Risk Review Journey

1. Operator opens Overview or Risk events.
2. Operator filters by month, hazard, crop, or province.
3. Operator selects a risk event.
4. Event detail shows severity, confidence, time window, owner, evidence,
   recommended actions, workflow state, and audit trail.
5. Operator opens field work or advisory workspace from the event.

### Nakhon Ratchasima Local Drill-Down Journey

Historical prototype flow below. Current paths/controls are the active product
journey above and `APP_MAP.md`; do not restore old data/readiness panels from
this description.

1. Operator opens `/nakhon-ratchasima` directly or from the nationwide map area
   profile.
2. Supabase login returns the operator to the requested internal route after email/password authentication.
3. Province view shows 32 districts, 289 navigable subdistricts, local layer
   selector, source freshness, and provenance guardrails.
   The visible layer selector hides water, flood, reservoir, weather, and
   rainfall layers while those catalog/data entries remain parked in source for
   future ingest and prediction work.
4. Operator opens a district, for example
   `/nakhon-ratchasima/wang-nam-khiao`.
5. District view shows child subdistricts and inherited province/regional
   context.
6. Operator opens a subdistrict, for example
   `/nakhon-ratchasima/wang-nam-khiao/t-302504`.
7. Subdistrict view shows drought status, data-readiness context, inherited
   evidence counts, and an explicit no-data state where local evidence is not
   seeded.

### Province Placeholder Journey

1. Operator opens the nationwide map and selects a province that is not yet
   locally seeded.
2. The preview/detail action opens `/{province-slug}` from canonical province
   routing data.
3. The workspace shows province-level filters and containers for situation,
   agriculture, and data readiness.
4. Placeholder copy must make the missing local evidence explicit. It must not
   translate missing district/subdistrict data into normal, low-risk, or zero
   rainfall states.

### Field Team Verification Journey

1. Open Field work.
2. Review assigned task and checklist.
3. Submit field observations.
4. Reducer marks `FV-0825-NE-01` as `Submitted`.
5. Reducer raises main event confidence to `High`.
6. Event status becomes `Verified / Advisory Ready`.

### Advisory / Approval Journey

1. Field verification must be submitted first.
2. Officer edits advisory actions if needed.
3. Officer submits advisory for review.
4. Supervisor approves or requests changes.
5. Approved advisory enables publication.

### Publication Journey

1. Open Alerts after advisory approval.
2. Choose channels.
3. Publish.
4. Reducer creates deterministic delivery records.
5. Reducer creates farmer alert linked to `ADV-2026-824`.
6. Main event status becomes `Published / Monitoring`.

## Historical Persona Journeys (not CMS)

The retired prototype simulated roles through personas. The current CMS instead
uses real sessions and server-enforced membership; see Active Admin Journeys.

Operator persona expectations:

- National officer: overview, event prioritization, publication readiness.
- เจ้าหน้าที่จังหวัด/อำเภอ: ตรวจสอบพื้นที่และแก้ไขคำแนะนำ.
- Extension officer: field task submission.
- Analyst: model/data registry and forecast reasoning.
- หน่วยงานน้ำ: ดำเนินการด้านชลประทานและบริหารจัดการน้ำ.
- Supervisor: approval or changes requested.

## Historical Demo Form Flows (removed owners)

File/component names below are historical pointers, not current source paths.

Field verification form:

- File: `WorkflowSection` in `src/AuthenticatedApp.tsx` (legacy).
- Seed values come from `FieldTask.seedObservation`.
- Submit action: `submitVerification`.
- Disabled after task status is `Submitted`.

Advisory action textareas:

- File: `WorkflowSection` in `src/AuthenticatedApp.tsx` (legacy).
- Runtime list: `runtime.advisoryActions`.
- Update action: `updateAdvisoryAction`.
- Submit review enabled only when task is submitted and advisory is `Draft Ready`
  or `Changes Requested`.

Publication channel checkboxes:

- File: `AlertsSection` in `src/AuthenticatedApp.tsx` (legacy).
- Runtime list: `runtime.selectedChannels`.
- Disabled after publication.

## Auth / Session Flow

FACT:

- Supabase Email + Password replaces the retired username gate. The SDK owns
  session restore, token refresh and persistence; `src/useAuth.ts` subscribes
  to auth changes with cleanup and stale-result protection.
- The old `korat-tan-phai-login-user` value is removed, never accepted as auth.
- Login preserves internal `next` paths including query/hash, even if the
  login page is refreshed. External return URLs are rejected.
- Visitor and Admin use independent session keys and same-scope cross-tab
  events. Cross-scope navigation reloads the document; signing out one scope
  does not sign out the other. Retired personas are neither persisted current
  UI nor a permission source.
- See `AUTH_SETUP.md` for test-only mocks, logout error states and Preview checks.

Real-account release checks are separate from mocked local tests. CMS operations
already enforce server authorization; future jurisdiction-specific officer
restrictions remain separate work in [WORKSPACE_ACCESS](WORKSPACE_ACCESS.md).

## Error / Loading / Empty States

Current states:

- Shared illustrated loading covers initial Visitor/Admin reads. Real auth,
  module/bootstrap and page-read milestones drive 0/33/67/100%; pending work
  never advances with time. The orbit remains continuous across mounts.
- Failed reads release the full-page loader to the existing error/retry; they
  do not become successful data. A slow React loader offers reload after 20s.
  Cached refreshes retain local feedback, and completion never delays content
  interaction. See [LOADING_SCREEN](LOADING_SCREEN.md).
- Core geometry/read failures have actionable retry and no static fallback in
  CMS mode. Optional neighboring context does not block a ready core map.
- Empty search/analysis/irrigation results use shared icon, explanation and reset
  controls. Empty lists do not imply zero risk. Analysis results scroll inside
  the bounded modal rather than forcing an empty full-height panel.
- Risk 0, out of study scope and missing records remain distinct. A failed
  revalidation is explicit and blocks exports that require a fresh revision.
- Import validation errors identify source positions and repair actions.
  Invalid/stale drafts cannot publish; failed saves retain unsaved input and
  offer retry. Recovery creates a new draft rather than discarding history.

## Navigation Behavior That Must Not Regress

- Sidebar section buttons must keep keyboard and pointer access.
- Control-band filters must preserve selected section.
- The visible app is Thai-only; do not reintroduce a TH/EN toggle without an
  explicit product decision.
- Admin navigation must stay within CMS; Visitor login cannot bypass Admin login.
- Toasts must be dismissible.
- Map zoom/pan must stay bounded inside the map canvas so long-press or
  touchpad dragging cannot reveal page-level horizontal overscroll or move
  Thailand out of focus.
- Local forecast maps allow immediate one-finger horizontal panning within
  camera bounds. Vertical-first gestures scroll the page; a cancelled scroll
  must not swallow the next tap. Keep pinch zoom and long-press panning intact.
  `e2e/map-touch-pan.spec.ts` covers real Chromium touch input across overview,
  province, district, and tambon routes without waiting for a long press.
- Province, district and subdistrict maps share the same wheel/touchpad zoom contract:
  vertical wheel input over the map zooms around the pointer quickly, while
  horizontal wheel input is contained so the page cannot drift sideways.
- Local map shapes support keyboard and pointer selection with scoped previews
  and district/tambon drilldown. Clearing a transient selection must not reopen
  a hover preview while the camera returns. A route-selected tambon remains
  selected only on that route. No rainfall or national demo layer is active.
- Nakhon Ratchasima breadcrumbs must remain usable on mobile and should not
  require the nationwide filter band.
- Active hierarchy-back actions are deterministic: province drought returns to
  Home, district to province drought, and tambon to its parent district. Home
  has no nationwide back action. Do not use arbitrary browser history for this
  hierarchy.

## Emergency-Use Interaction Requirements

FACT: The current app is a prototype.

For production readiness, public-safety interactions must:

- Show timestamp and timezone on alert data.
- Show severity and what changed since the last update.
- Provide clear action steps, not only risk labels.
- Avoid relying on color alone.
- Remain readable at mobile widths and browser zoom.
- Communicate uncertainty and source freshness.

# โคราชทันภัย Design System

## Brand / Tone / Visual Direction

The UI should feel calm, formal, Thai-first, operational, and trustworthy.

Primary audience:

- Residents who need understandable public risk information.
- Local operators and field teams who need quick action cues.
- Administrators who need review, approval, and publication controls.

Do not make the app feel like a marketing landing page. The active product is a
forecast dashboard and no-code CMS; it is not an activated public alert service.

### Brand Assets

- Primary sidebar lockup: `public/brand/korat-tan-phai-sidebar-logo.webp`
  (`640x585`). `SidebarBrand` owns its responsive presentation. Never stretch,
  crop, recolor or redraw the artwork.
- Compact emblem: `public/brand/korat-tan-phai-emblem.png` (`768x768`), with a
  WebP counterpart. Use it with live brand text when the full lockup is too small.
- Browser favicon: `public/brand/korat-tan-phai-favicon.png` (`512x512`).
- The native iOS app uses the same unmodified Korat emblem. Legacy `kaset-*` files
  are not the current product identity and must not be used in new Korat UI.
- The supplied artwork contains gradients, highlights, and fine raster detail;
  do not auto-trace it to SVG. Re-export from the original design source only if
  a true vector master becomes available.

## Typography

Current font stack is defined in `src/styles.css`:

```css
"Google Sans", "Noto Sans Thai", "Noto Sans", system-ui, -apple-system,
BlinkMacSystemFont, "Segoe UI", sans-serif
```

`index.html` loads Google Fonts for Google Sans.

Rules:

- Visible product UI is Thai-only. Do not add a TH/EN toggle unless the product
  owner explicitly reopens that decision.
- Thai text must be readable without English knowledge.
- English can remain only for necessary codes, source acronyms, URLs, API terms,
  GeoJSON, SMS, LINE, and internal IDs.
- Avoid heavy 800/900 weights for dense Thai UI.
- Avoid viewport-based font scaling.
- Use line height generously for Thai body text.
- Prevent long labels from overflowing cards or panels.

## Color / Tokens

Current web paint tokens live in `src/theme-tokens.css` (Navy / Powder / Amber,
owner-approved 2026-11-03). `src/brand-theme.css` maps the existing component API
below to these roles. Component/lazy Admin CSS and SVGs share the palette.

Core roles:

- `--bg`: page background.
- `--surface`: cards/panels.
- `--surface-muted`: quiet nested surface.
- `--ink`: primary text.
- `--muted`: secondary text.
- `--line`, `--line-strong`: borders.
- `--primary`, `--primary-strong`: actions/nav.
- `--teal`, `--amber`, `--red`, `--yellow`: risk and evidence accents.
- `--green-soft`: legacy component name for non-risk selected/quiet blue surfaces.
- `--ktp-risk-*`: forecast fills, status text/surfaces and out-of-scope hatch.
- `--radius`: 8px panel radius.

Active forecast paint is in `NakhonRatchasimaLocalMap` and shared chart/legend
owners. Risk 0 remains green, 1 amber, 2 coral and out-of-scope gray/hatched.

Do not rely on color alone; always pair severity colors with labels.
Retained rainfall styles do not establish an active rainfall layer.

## Web And iOS CI

CI means corporate identity here. Web and iOS share authentic Korat assets and
typography. November's owner request changes the website skin only; native
retains the base identity tokens in `src/styles.css` until a separate native
update. Do not recolor the logo or claim native visual parity with the new web
skin based on the legacy token test alone.

- Native semantic colors and typography live in `apps/mobile/src/theme.ts`.
  All current native text and surface styles use these roles. The native
  parity test checks them against the web and compares the emblem file hash.
- Google Sans static regular, semibold and bold faces ship as local app assets
  through `@expo-google-fonts/google-sans`. Do not depend on a runtime Google
  Fonts request. The font package includes its OFL license and Thai glyphs.
- Adapt safe areas, touch targets, text scaling and spacing to iOS; do not
  copy desktop pixel dimensions. Use the same icon meanings and state wording.
- Reuse platform-independent domain logic. Native views cannot reuse DOM
  components directly; share native primitives when real repeated consumers
  exist. Future dropdowns should preserve searchable lists and selection
  behavior while fitting native sheets, keyboard and accessibility.
- Risk colors must come from the actual forecast legend, not generic accent
  tokens. Native forecast views, maps and charts reuse the shared forecast
  domain and preserve missing-data and out-of-study distinctions. Current
  functionality and verification gaps are recorded in
  `apps/mobile/NATIVE_PARITY.md`.

Run `npm run test:brand` in `apps/mobile` with Node 24 and the repository root
dependencies installed whenever web or native CI tokens/assets change. This
guards source drift; Simulator screenshots still verify actual rendering.

## Asset Locations

### Shared web surface theme

`src/brand-theme.css` adds the reference-led Navy / Powder Blue / White
surface treatment to the existing web components. It is imported once by
`src/main.tsx`. Use its `--brand-*` roles for decorative surfaces; the original
semantic/risk meanings, font metrics and component geometry remain authoritative.
The shared decorative illustration is
`public/brand/korat-rice-landscape-navy-amber.webp`; retain the original
`korat-rice-landscape.webp` as its source. Preserve gold rice against blue hills
with normal blending, rather than desaturating all the artwork into blue.
It is illustrative brand art, not satellite imagery or evidence of field conditions.
See [surface-theme contract](BRAND_SURFACE_THEME.md) for reuse, asset provenance
and the geometry-preservation verification.

- Static map: `public/geodata/thailand-adm1.geojson`
- Nakhon Ratchasima subdistrict map:
  `public/geodata/nakhon-ratchasima-subdistricts.geojson`
- Nakhon Ratchasima local province outline:
  `public/geodata/nakhon-ratchasima-boundary.geojson`
- Primary product logo and compact emblem: `public/brand/`.
- Icons come from `lucide-react`.
- Screenshots used for handoff should live outside git unless intentionally
  added under a documented snapshots folder.

### Illustrated startup and readiness

Visitor and Admin reuse `AppStartup`, `PageLoadBoundary`, `startupMotion.ts`
and the matching pre-JS markup. The loading scene has its own responsive
landscape/portrait WebPs and blue/amber orbit SVG; keep UI text, emblem, steps
and progress native rather than baking them into an image. Read
[LOADING_SCREEN](LOADING_SCREEN.md) for asset paths, crops and exact behavior.

The orbit rotates continuously across mounts (8s per revolution). Progress is
0/33/67/100% for real auth/module/page-read milestones, explicitly N/3 steps.
Never advance it with time or label it as downloaded bytes. Completion releases
the page immediately; its 220ms fade is non-interactive. Reduced motion stops
the ring and skips interpolation/fade. Decorative artwork never blocks readiness.

## Responsive Rules

Current priorities:

- Officer/admin surfaces: desktop-first, dense but readable.
- Visitor forecast surface: mobile-first, plain Thai.

Rules:

- No horizontal overflow at 390px mobile width.
- Controls must keep usable touch targets.
- Dense metric grids must collapse before text becomes narrow word columns.
- Map must remain usable on desktop and provide readable selected-area context on
  mobile.
- Nakhon Ratchasima local workspace must stack route controls, hero, map,
  inspector, and evidence cards on mobile before labels become squeezed.
- Map zoom and pan stay bounded to the selected Korat scope; neighboring
  province context must not compete with forecast polygons or labels.
- Toasts must not cover primary actions permanently.

## Screenshot QA Expectations

Use `$snapshot` for visible UI work.

Choose evidence proportional to the change. A small visible fix needs one
current contextual render; shared or responsive changes need representative
affected states at desktop/mobile widths. Typical checks:

- Desktop around 1440px wide.
- Mobile around 390px wide.
- Affected route/surface.
- Console/network error check when a browser is practical.
- DOM overflow check for pages with dense cards or long Thai copy.

## Do Not Regress UI Decisions

- Thai default and Thai-complete primary UI.
- No visible EN web version.
- Formal public-safety wording.
- Data provenance visible near risk/evidence/model surfaces.
- Layer state must distinguish no data, source unavailable, unsupported layer,
  low risk, and available data.
- No text spilling outside right panels.
- No compressed word-by-word columns in risk or crop detail panels.
- No generic hero/landing page replacing the operational first screen.
- No fabricated official-looking values.

## Design Evidence Retention

Keep only the latest accepted design of each page/component, preserving its
important languages, viewports and states. Before proposing deletion, pair each
superseded mock/export with the actual replacement; filename/date alone is not
proof. Source artwork and runtime assets are not disposable design exports.
Release/incident evidence may have a separate operational purpose; do not delete
the entire artifacts directory or create duplicate old-design backups.

Cleanup is a separate authorized task: inspect real sizes, Git status and active
processes, checksum duplicate files, retain a verified original/recoverable ZIP,
prepare an exact-path dry run and follow the current approval rules. Preserve
source, uploads, databases, credentials, user data, important backups, .git and
uncommitted work. Unproven candidates stay. Measure actual reclaimed space
without rebuilding caches merely to test cleanup. This policy performs no deletion.

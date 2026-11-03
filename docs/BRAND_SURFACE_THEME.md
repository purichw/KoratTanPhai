# Korat web surface theme

## Design contract

The owner's 2026-11-03 `Korat_Tan_Phai_Navy_Powder_Amber_Theme_Handoff_v1`
supersedes the forest/ivory/gold web skin. Use Navy / Powder Blue / White, with
amber for moderate risk and warnings. The owner explicitly prohibited changing
layout or composition. The handoff's illustrative arrangement, nominal type
sizes, radii and spacing are not instructions to change the existing product.

- Palette owner: `src/theme-tokens.css`, loaded from `index.html` before startup
  CSS and JavaScript. Decorative owner: `src/brand-theme.css`, loaded by
  `src/main.tsx`. Component paint, lazy Admin CSS and SVGs share `--ktp-*` roles.
- Shared consumers: app/startup shell, navigation, page headings, page filters,
  `AppSelect`, account/bookmark controls, forecast summary cards, map tools,
  horizon/chart view controls, body/fullscreen dialog portals and the login surface.
- Rules change only paint: color, background, border color, shadow and decoration.
  No width, height, padding, margin, gap, grid, order, font size or line-height
  overrides. No new DOM wrappers, focus targets, interactions or data sources.
- Reuse existing components and their semantic paint roles. `--brand-*` aliases
  serve decorative surfaces; `--primary`, `--ink`, etc. remain the component API.
  Do not copy route-specific skins or add DOM wrappers for a color change.
- Risk 0 stays green `#5DAE79`, moderate is amber `#F6AE2D`, high is coral
  `#D95D59`; explicit out-of-study is `#CBD5E1` with `#95A4B5` hatching.
  Missing/unavailable has a distinct unknown role `#718198`, never risk 0.
  Labels, categories, thresholds, counts, months, pattern geometry and export
  formats/data contracts are preserved. Blue risk-0 card surfaces are allowed;
  their risk markers stay green. Non-risk CMS success uses blue plus its label.
- Official logo artwork and font assets are unchanged. Native styling is outside
  this web-only request. The base identity defaults in `styles.css` remain the
  native parity baseline; the web skin overrides them. Do not claim native
  visual parity with this new skin based on the legacy token check alone.
- Background art is decorative and does not intercept input or convey a status.
  Solid colors remain readable if the illustration fails to load.
- Landscape art uses the dedicated Navy/Amber derivative, with cool blue hills
  and warm gold rice. Use normal blending: luminosity blending removed the gold
  and was rejected by the owner. Keep readable overlays behind text, but let
  foreground rice and landscape detail remain visible. Preserve existing crops
  and sizes; never recolor the logo, map categories or uploaded content.

## Palette and state roles

Primary/sidebar `#173A6A`; strong `#0F2E5E`; hover `#204777`; active/focus
`#2E6BDE`; selection `#E7F0FF`; page `#EEF4FC`; card white; map `#E2EBF5`.
Text `#182B4C`, secondary `#5D6E88`, border `#D7E2F1`, strong border `#B9CBE3`.
Risk cards and validation use dedicated risk text/surface roles. These are
handoff colors, not values sampled from the production screenshot.

Apply the same roles to Visitor/Admin entry/loading, sidebar/account, search,
bookmarks, filters, empty/error states, analysis/export dialogs, chart/map
legends and CMS resource/area views. Layout and behavior stay with their owners.

## November local verification (2026-11-03)

Branch `feat/navy-theme-20261103` is based on `8186896`, after the released
`2d2d7cb` runtime. Evidence is in `artifacts/navy-theme-20261103/` in the isolated
worktree. Before was captured before editing, using the same local routes,
browser, fonts, data and viewport as After. Reference is the handoff's selected
image; it is a palette reference, not permission to adopt its composition.

- 22 matched desktop/mobile scenes: overview, province, district, tambon,
  analysis, account menu, both login pages, Admin dashboard, grouped areas and
  area map. All 1,967 recorded component rectangles/type metrics match exactly.
  CMS reference timestamps were seeded to the original capture minute so
  timestamp-dependent intrinsic widths compare against identical content.
- Source comparison preserves all 7,471 non-paint CSS declarations, including
  media queries, spacing, sizes, type, radii, map controls and artwork crops.
- Additional 320/768/1024 px checks found no horizontal page overflow. Desktop
  is 1440×960; mobile is Chromium touch emulation at 390×844, not a physical iPhone.
- Seven foreground/surface contrast pairs are 5.18:1–12.75:1. This is targeted
  palette evidence, not a whole-product accessibility certification.
- Eight browser checks cover pre-JavaScript Visitor/Admin entry, data risk
  paint/hatching, filter semantics, search/keyboard/focus and page loading.
  Two further database-mode checks cover coordinates, playback, search and real
  PNG/PDF downloads; exported map paint/hatching was visually inspected. They
  were initially skipped by the static harness, then passed against the required
  isolated Supabase fixture mode.
- TypeScript/Vite builds pass for static and Supabase/CMS modes; the three
  legacy native base-token/font/logo checks pass. Original asset files and
  data/auth/publication logic are unchanged. Existing large-chunk build warnings
  remain; no budget or assertion was weakened.
- Full release/CI, live production smoke, Safari/physical devices, native UI
  migration and deployment are outside this local theme task. No remote data
  writes. Keep this distinction when reporting readiness for a future release.

Initial comparison images: `comparison-desktop.png` (Reference/Before/After),
`comparison-mobile.png` and `comparison-admin.png`; detailed states and metrics
live beside them. The supported preview starts from this isolated worktree;
the shared root checkout is not the source of these changes.

### Artwork correction (2026-11-03)

The owner rejected the washed-out monochrome landscape. The current runtime
uses `public/brand/korat-rice-landscape-navy-amber.webp` (1536 × 1024,
169,702 bytes), an imagegen color-edit derivative of the original below. The
original remains unchanged. Existing image sizes/positions and all UI geometry
are unchanged. Blue hills and gold rice are now authored separately in the asset;
normal blending and lighter overlays preserve them on the shared Visitor/Admin
shell and login surface. The archive note retains a pale readable backing.

Built-in imagegen edit prompt: recolor the original landscape to pale powder-blue
sky `#EEF4FC`, layered powder-blue `#A9C8F7` hills and navy `#173A6A` foliage,
while retaining luminous warm-gold rice panicles, the original 3:2 composition,
perspective, object positions and botanical detail. Use the selected handoff
only for color relationships; no UI, text, logo, added objects or watermark.
Output was encoded with `cwebp -q 84 -m 6`.

Focused post-correction evidence is in `artwork/`: five matched Chromium scenes
(desktop/mobile overview and Admin login, plus the mobile menu) have identical
component rectangles, no horizontal overflow and no page errors. These current
captures supersede the earlier artwork appearance. Full build/release and
whole-site tests were not repeated for this paint-only correction.

## Illustration provenance

Asset: `public/brand/korat-rice-landscape.webp`, 1536 × 1024, 118,484 bytes.
Created using the built-in `image_gen` tool, then encoded as WebP quality 80.
The same file is cached and reused with CSS crops for the sidebar, page heading,
overview context band, empty-attention surface and login page. It is illustrative
art, not a real location photograph, satellite image or forecast input.

Generation prompt:

> Use case: stylized-concept. Create a production website decorative brand asset,
> NOT a UI mockup. Wide landscape illustration, 1536 x 1024. A refined hand-painted
> Thai agricultural landscape inspired by the Khorat plateau: softly layered
> distant hills, rice fields and scattered indigenous trees, delicate golden rice
> panicles and rich olive-green long leaves framing the bottom left and bottom
> right corners. Elegant botanical engraving meets watercolor, subtle detailed
> paper grain. Restrained forest green, sage, warm ivory #faf7ee and antique gold.
> Morning haze, calm dignified public-service identity, premium but quiet.
> Composition: upper 65 percent is near-empty warm ivory sky with extremely faint
> hill silhouettes; all clearly visible hills, fields and foliage concentrated in
> bottom 35 percent. Rice stems along side edges curl into the lower corners, not
> the center. Richest forest green and gold details at the very bottom edge;
> distant landscape low contrast. This will be reused as a subtle background
> behind text in a data dashboard, so the upper and central areas MUST be very
> quiet. No typography, no logos, no frames, no website controls, no map, no people,
> no watermark.

## Historical September local verification (previous skin)

Evidence: `artifacts/brand-refresh-20260927/`. Authenticated Chrome, Supabase
provider, source December 2025 / T+1; 1440 × 960 and 390 × 844 viewports.
Before disables only the newly added theme module in the same source and state.
After uses the final theme. The mockup is an illustrative direction, not a
pixel-parity target; comparison crops remove its presentation/device framing.

- Overview, province, Soeng Sang district and Bot tambon: 181 visible component
  rectangles compared (x/y/width/height), with no differences over 0.5 CSS px.
  Forecast map fill sets match the baseline across all eight route/viewport pairs.
- Desktop/mobile account menus, search results, dropdowns, analysis, map color
  modes and playback were exercised. Escape restores focus for the inspected
  menus/dialogs; no page errors or horizontal overflow. Additional overflow
  checks at 1024 and 320 px. Decorative art decodes successfully.
- Build and three native brand-parity checks passed. Full unrelated regression
  suites, physical-device checks and production deployment were not performed.
- Current desktop/mobile full-page captures and contextual interaction captures
  were personally inspected; comparisons are saved alongside the evidence.
- One capture attempt encountered an unavailable forecast response; the final
  repeat completed all eight route/viewport pairs with populated data. No loader
  or error-recovery behavior was changed as part of the theme.

The local checkpoint above precedes the production release below.

## Production release (2026-09-27)

Runtime `c03cd7e` on `release/brand-theme-20260927-v2` is deployed at
`https://korattanphai.vercel.app`, artifact
`dpl_9nxHr9FT9iYDkGQSYV95WUmontem`. This adds only the six theme files to
the `e11c59f` production baseline, retaining its already-released Plus Code
feature. UAT/research/API edits and local budget changes remain excluded.

All five [CI jobs](https://github.com/purichw/korattanphai/actions/runs/36317441953)
passed on the exact runtime commit, including protected builds and unchanged
bundle/exposure gates. Candidate and production each passed 39 authenticated
read-only smoke checks and eight route/viewport checks against the preceding
production version: 181 component rectangles and font/padding/gap values match;
map risk fill sets are unchanged. The hosted illustration decodes and its bytes
match the committed asset. Production desktop/mobile captures were inspected.

Evidence: `artifacts/brand-release-20260927/release-v2-state.json`,
`production-v2/` and `comparison-v2-*.png`. Physical-device checks and unrelated
UAT/API integration testing were not run. No database or native changes.
Recovery artifact: `dpl_Aq5RepuAFryPMtc7Taa8zm4owaW6`.

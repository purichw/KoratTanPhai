# Shared illustrated loading screen

Implemented and released on 2026-11-03 on `feat/loading-scene-20261103` as runtime
`25bed0a9a2baa03d3a5b851c2550b138374b32d5` at `https://korattanphai.vercel.app`.
The subsequent local follow-up below adds continuous ring motion and real
readiness milestones; it is not yet deployed. Visitor/Admin data, authentication,
map/chart behavior and publication contracts are unchanged.

## Reference and implementation ownership

The owner supplied a 1536×1024 clean desktop mock and an annotated tablet/mobile
sheet. Their distinctive elements are the official Korat identity, sky-blue
scene, gold rice, Phimai temple, wall, Ya Mo statue, circular frosted halo,
blue/amber arcs, process icons and glowing loading bar.

- `src/components/AppStartup.tsx`: single presentational React component for
  Visitor/Admin/auth/module startup; `path` and `message` retain their existing
  meaning. `phase` is supplied by the real auth/module/page owner.
- `src/app-startup.css`: scoped layout, native text, halo, motion, responsive
  artwork and recovery. No global font or product layout overrides.
- `index.html`: pre-JavaScript companion markup, inline versions of the same
  Lucide icons, shared CSS and viewport-matched image preloads. Keep its anatomy
  synchronized with `AppStartup`; no runtime bundle is needed for first paint.
- `PageLoadBoundary`, readers and auth retain readiness/error ownership.
  Pending content becomes interactive immediately when its reads settle. A
  non-interactive 220ms completion fade shows the final progress, without a
  minimum loading delay. Failed reads expose the existing error/retry UI.

Text, logo, icons, status, bar and arcs are separate DOM/SVG/CSS elements. The
reference was not flattened into a full-screen UI image. The logo remains the
existing `korat-tan-phai-emblem.webp`; its details intentionally differ from the
illustrated reference. Typography uses the product's existing Google Sans.

## Honest progress and recovery

Local motion follow-up after `781f913` (not yet deployed): `startupMotion.ts`
captures the orbit's CSS animation start time from the pre-JavaScript screen in `main.tsx`.
Each `AppStartup` mount aligns its orbit to that same
document timeline in a layout effect. This prevents auth/module/page-read handoffs
from visibly restarting the loader. CSS owns frame-by-frame movement; there is
no JavaScript animation loop or readiness delay. The orbit now takes eight
seconds per revolution, with a compositor hint and a tiny SVG preload. Reduced
motion still stops movement and releases the compositor hints.

Normal-motion browser sampling reproduced backward animation-time jumps in the
old implementation and zero in the corrected entry-to-page handoff. The new
startup browser regression asserts continuous orbit phase across replacement
DOM nodes, visible rotation, real readiness values and reduced-motion feedback. Evidence is local at
`artifacts/loading-motion-20261103/`; this does not certify physical-device FPS.

The local follow-up replaces the released indeterminate bar with **page-readiness
progress**, explicitly labeled `ความพร้อมของหน้า · N/3 ขั้นตอน`. The denominator
counts three actual lifecycle milestones, not downloaded bytes, individual
requests or estimated remaining time:

| Owner state | Completed | Display |
| --- | --- | --- |
| Pre-JavaScript / auth checking | 0/3 | 0%; ตรวจสอบสิทธิ์ |
| Authenticated module/bootstrap pending | 1/3 | 33%; โหลดระบบ |
| Module ready, blocking page reads pending | 2/3 | 67%; เตรียมหน้า |
| All blocking page readers have settled | 3/3 | 100%; พร้อมแสดงหน้า |

Values stop while their owner is pending, including after the 20-second recovery
threshold. Completion means the page can present its result **or existing
error/retry**, not that failed data requests succeeded. Signed-out/auth failure
and chunk failure keep their own routing/recovery without fabricated completion.
Cached route entry can skip completed milestones. Decorative images never block.

The fill interpolates once toward each real value (220ms, 80ms at completion),
never loops or advances from elapsed time. Fast successive updates cancel the
old interpolation and continue from the visible fill. Page completion releases
inert content, scroll lock and focus immediately; only the aria-hidden, inert,
pointer-transparent splash fades for 220ms. A new pending read cancels that exit.
Reduced motion stops the orbit, applies progress directly and hides completion
immediately. There is no added minimum request wait.

The optional `message` remains the single live status. Without it, `/admin`
uses the Admin preparation message; Visitor uses the public preparation message.
The shared English brand caption stays the same in both contexts.

After the existing 20-second wait, the mounted React component offers the shared
secondary reload button. It does not dismiss the screen or pretend a request
succeeded. The pre-JavaScript entry retains its no-script instruction; it does
not acquire a fake timer. Motion respects `prefers-reduced-motion`. Decorative
elements are hidden from assistive technology and never intercept input. Hidden
page content retains the existing inert/focus contract.

## Artwork and responsive behavior

| Asset | Dimensions | Encoded size | Use |
| --- | --- | --- | --- |
| `public/brand/korat-loading-landscape.webp` | 1536×1024 | 137,264 bytes | Desktop, tablet and landscape |
| `public/brand/korat-loading-portrait.webp` | 934×1684 | 90,374 bytes | Portrait phones up to 720px |
| `public/brand/korat-loading-orbit.svg` | 800×800 viewBox | Small vector | Native animated blue/amber arcs |

Both WebPs were produced from the owner's visual direction using the built-in
image-generation tool, then encoded with `cwebp -q 85 -m 6`. Original supplied
images and the official logo were not modified. Generated intermediate files
are not runtime dependencies.

Generation direction: remove all UI, type, logo and rings from the clean desktop
reference, reconstruct clear sky, preserve the illustrated scenery and lighting.
For portrait, compose the same landmarks using the sheet's phone reference,
reserve open sky for native UI, then lower/rescale the statue and horizon so the
statue does not collide with the status. Only the final background derivatives
are shipped. This is decorative illustration, not a geographic boundary source.

Desktop uses cover at the bottom. Portrait phone/tablet scenes scale
proportionally to width and anchor at the bottom, with a matching sky extension
above, preserving landmarks rather than center-cropping them away. Halos keep
text readable without desaturating the rice. Short-height layouts compact the
brand/steps; phone-landscape recovery uses a horizontal row. The screen can
scroll vertically for larger text; decoration cannot cause horizontal overflow.
Only the matching scenery is preloaded. Art loading is never a readiness gate.

## Verification and evidence

Local motion/progress follow-up: TypeScript, 22 focused unit tests and 36 affected
desktop/mobile browser cases pass. These include auth/module failure, map and
Admin failure/retry, pending waterfalls, unchanged progress after 20 seconds,
all lifecycle values, reduced motion and completion cleanup. Initial browser
trace capture hit local disk `ENOSPC`; the remaining cases and affected repeat
passed with tracing disabled, without relaxing assertions. A real browser
recording samples 0/33/67/100 with zero backward orbit-time jumps across mounts;
its frames were visually inspected. Evidence:
`artifacts/loading-progress-20261103/` and
`artifacts/loading-motion-20261103/progress/`. No full build/CI/deploy or physical
device FPS certification was performed for this local follow-up.

Original released illustration verification:

Evidence is local and gitignored at `artifacts/loading-scene-20261103/` in the
isolated worktree. Captures use real routes and the existing deterministic auth/
data fixtures, holding the relevant reads pending. They do not certify a live
production backend. Before was captured before the implementation edits.

- Matched Visitor/Admin captures at 1536×1024, 1365×1024 and 390×844.
- Additional 768×1024 tablet portrait, 320×568 compact phone and 844×390 landscape;
  compact/landscape include the slow-reload state and keyboard focus.
- `comparison-desktop.png` and `comparison-mobile.png`: Reference / Before /
  After. Screenshots are unretouched; only uniform resizing, reference cropping
  and external labels are used. The sheet's phone panel has a different aspect
  ratio from its nominal device label, so the comparison preserves that ratio
  and does not claim pixel-exact mobile geometry.
- `e2e/page-loading.spec.ts` and `e2e/color-theme.spec.ts`: 12 desktop/mobile cases
  passed, covering pre-JS artwork, Visitor essential/optional reads, Admin read
  waterfalls, failure/retry, inert content, reduced motion and slow reload.
- `npx tsc -b` and final `npm run build` pass. The existing large Excel-chunk
  warning remains; no new package was added.
- Final compact/landscape recovery captures pass without lost controls. No
  horizontal page overflow or page errors were observed in the capture matrix.

The original local design pass did not certify production or a physical iPhone.
The subsequent authorized release used the normal gate, as recorded below.

## Production release evidence

- [Quality Gate 41649902370](https://github.com/purichw/KoratTanPhai/actions/runs/41649902370),
  attempt 1, passed all seven jobs on exact `25bed0a`. Unit tests: 491;
  built-browser: 226; database-browser: 150; CMS-browser: 65; compatibility: six.
  Existing intentional skips remain. Protected build, exposure, bundle budget
  and production dependency checks passed without weakened thresholds.
- Candidate `https://korattanphai-qpgf5yfgc-purich-w.vercel.app`, deployment
  `dpl_9L32JjRwCmkvhxg1v5gQZhwtRTji`, was built from a tracked-source Git archive
  with explicit Supabase/CMS flags, then promoted only after the gate and
  authenticated read-only candidate checks passed. The production alias was
  verified before and after promotion. Prior recovery deployment:
  `dpl_Gj4ntMUf56sjzWkrerSjVA52oNQZ` (`1746981`).
- Candidate Visitor smoke passed 39 checks; Admin navigation, grouped areas,
  templates, readiness and recovery checks passed on desktop/mobile.
- After promotion, authenticated [Deployment Smoke 41652225999](https://github.com/purichw/KoratTanPhai/actions/runs/41652225999)
  passed on exact `25bed0a`. The separate production Admin navigation/areas/
  lifecycle checks also passed on desktop/mobile, with no application-data writes.
- Eight loading captures on each of candidate and production cover Visitor/Admin
  pre-JavaScript entry and authenticated pending state on desktop/mobile. The
  harness briefly holds real reads, captures, then continues them unchanged and
  verifies ready content; it does not substitute API responses or modify data.
- All three new asset hashes/MIME types match, both WebPs decode, the CMS marker
  confirms no fallback, and no broken images, horizontal overflow, page errors
  or failed requests were observed. Current production screenshots were visually
  inspected. Evidence: `artifacts/loading-scene-20261103/release/`.
- The initial concurrent local unit run timed out in an unchanged Excel archive
  test. Focused checks and all 491 tests with a single worker passed; the hosted
  full gate also passed. No runtime repair or timeout increase was required.

No physical-device test, native-app change, application-data write or migration
is part of this release.

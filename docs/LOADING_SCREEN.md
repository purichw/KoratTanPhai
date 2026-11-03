# Shared illustrated loading screen

Implemented locally on 2026-11-03 on `feat/loading-scene-20261103`; not deployed.
This follow-up changes loading composition only. Visitor/Admin pages, data,
authentication, map/chart behavior and publication contracts are unchanged.

## Reference and implementation ownership

The owner supplied a 1536×1024 clean desktop mock and an annotated tablet/mobile
sheet. Their distinctive elements are the official Korat identity, sky-blue
scene, gold rice, Phimai temple, wall, Ya Mo statue, circular frosted halo,
blue/amber arcs, process icons and glowing loading bar.

- `src/components/AppStartup.tsx`: single presentational React component for
  Visitor/Admin/auth/module startup; keeps its existing `path` and `message` API.
- `src/app-startup.css`: scoped layout, native text, halo, motion, responsive
  artwork and recovery. No global font or product layout overrides.
- `index.html`: pre-JavaScript companion markup, inline versions of the same
  Lucide icons, shared CSS and viewport-matched image preloads. Keep its anatomy
  synchronized with `AppStartup`; no runtime bundle is needed for first paint.
- `PageLoadBoundary`, readers and auth retain readiness/error ownership.
  The screen disappears when their real pending state settles, with no forced
  minimum delay. Failed reads expose the existing error/retry UI.

Text, logo, icons, status, bar and arcs are separate DOM/SVG/CSS elements. The
reference was not flattened into a full-screen UI image. The logo remains the
existing `korat-tan-phai-emblem.webp`; its details intentionally differ from the
illustrated reference. Typography uses the product's existing Google Sans.

## Honest progress and recovery

The current readers do not expose a reliable completion total. The reference's
67% is therefore replaced by animated dots and an **indeterminate** progress bar
without `aria-valuenow`. Never advance a fabricated percentage on a timer.
The three icons describe the preparation sequence; only the first is current
while pending. They do not claim measured sub-stage completion. A future live
stepper needs real phase signals from the owners before it may advance.

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

No full release suite, remote writes, production promotion or physical iPhone
certification was performed for this local UI request. Before deployment, use
the project's normal release gate for the exact intended commit.

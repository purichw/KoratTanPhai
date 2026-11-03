# Theme release dependency gate — 2026-11-03

Quality Gate 41623247506 for theme commit `5afdfbe` failed at the existing
`npm audit --omit=dev --audit-level=moderate` step. No production promotion took
place. The production dependency audit reported DOMPurify advisories including
GHSA-cg2g-xh64-v4q7, Glob GHSA-3g3m-2fjr-6pw4, and minimatch
GHSA-g3hv-75wg-m249. These were transitive dependencies already in the lockfile.

The release repair is scoped to those consumers:

- jsPDF: DOMPurify 3.4.17, retaining jsPDF 4.2.1.
- ExcelJS: unzipper 0.12.5 removes the retired fstream/rimraf/glob 7 chain.
- ExcelJS / archiver-utils: glob 14.0.3 retains the consumed `glob.sync` API.
- ExcelJS / readdir-glob: minimatch 11.0.4 retains the consumed `Minimatch` API.
- ExcelJS, archiver, zip-stream and unrelated packages remain at their existing
  versions. The development-only obfuscator's minimatch API is not overridden.

Do not run `npm audit fix --force` or globally replace minimatch: legacy
consumers can require a different module API. The scoped overrides are guarded
by `tests/exportDependencies.test.ts`, exercising streaming Thai XLSX values,
zero-risk values and the archiver glob/ZIP round trip. Existing Excel worker,
reviewed export, PNG/PDF browser and complete CI checks remain required.

The production audit after these changes reports zero vulnerabilities. This is
the release's production dependency gate, not a claim that the dev dependency
tree has no advisories. No audit threshold or workflow coverage was relaxed.

Local evidence: 37 targeted export/dependency tests passed; actual desktop/mobile
PNG/PDF downloads passed; a full province Excel worker download preserved all
1,734 source values. The Excel check was rerun on an isolated warmed server with
HMR disabled after the old dev server reoptimized dependencies and reloaded
mid-download. No product assertion or timeout changed. The final normal build
passes. Local exhaustive coverage assertions can time out under concurrent CPU
load; the unchanged assertions remain required in the exact-commit CI gate.

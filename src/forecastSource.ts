import type { NakhonRatchasimaDroughtForecastArchive } from './types';

/** Dataset identity remains stable across reads; provenance belongs to a round. */
export function forecastSourceForOrigin(meta: NakhonRatchasimaDroughtForecastArchive['meta'], origin: string) {
  const source = meta.originSources?.[origin];
  return source ? { workbook: source.filename, sheet: source.sheet, sha: source.sha256 ?? '' }
    : { workbook: meta.sourceWorkbookOriginal, sheet: meta.sourceSheet, sha: meta.sourceWorkbookSha256 };
}

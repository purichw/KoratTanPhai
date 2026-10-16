import { describe, expect, it } from 'vitest';
import { forecastSourceForOrigin } from '../src/forecastSource';
import type { NakhonRatchasimaDroughtForecastArchive } from '../src/types';

const meta = { sourceWorkbookOriginal: 'original.xlsx', sourceSheet: 'Data', sourceWorkbookSha256: 'original-hash',
  originSources: { '2026-10': { filename: 'reviewed.csv', sheet: 'Data', sha256: 'upload-hash', method: 'reviewed_upload' },
    '2026-11': { filename: 'ฉบับตรวจแก้ใน CMS', sheet: 'CMS', sha256: null, method: 'cms_review' } } } as NakhonRatchasimaDroughtForecastArchive['meta'];
describe('per-round forecast provenance', () => {
  it('keeps the original source for old rounds', () => {
    expect(forecastSourceForOrigin(meta, '2025-12')).toEqual({ workbook: 'original.xlsx', sheet: 'Data', sha: 'original-hash' });
  });
  it('uses the selected upload without changing baseline identity', () => {
    expect(forecastSourceForOrigin(meta, '2026-10')).toEqual({ workbook: 'reviewed.csv', sheet: 'Data', sha: 'upload-hash' });
    expect(meta.sourceWorkbookSha256).toBe('original-hash');
  });
  it('does not invent a file hash for manual CMS values', () => {
    expect(forecastSourceForOrigin(meta, '2026-11').sha).toBe('');
  });
});

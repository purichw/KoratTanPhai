import { describe, expect, it } from 'vitest';
import { activeImportSheet, correctImportCell, csvText, importCellIssues, importEvidence, inspectRev3Import } from '../src/admin/importReview';
import { matchRev3Columns, normalizeRev3Sheet, rev3Fields } from '../src/admin/normalizedForecastImport';
import type { ImportSheet } from '../src/admin/workbook';
const areas = [{ sourceId: 0, subdistrictCode: '300101' }, { sourceId: 1, subdistrictCode: '300102' }];
const makeSheet = (): ImportSheet => ({ name: 'Data', columns: rev3Fields.map(field => field.key), sourceRows: [2, 5], rows: areas.map(area => ({
  Year: 2025, Month: 12, ID: area.sourceId, TAMBON_E: '', AMPHOE_E: '', Irrigation_Status: '',
  ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`Pred_Risk_T+${i + 1}`, i % 3])),
})) });
describe('repairable import review', () => {
  it('accepts a complete new origin and uses the same year bounds as the canonical importer', () => {
    const sheet = makeSheet(); sheet.rows.forEach(row => { row.Year = 2199; row.Month = 6; });
    const report = inspectRev3Import(sheet, matchRev3Columns(sheet), areas, ['2025-12'], '2199-06');
    expect(report.issues.every(issue => issue.severity === 'warning')).toBe(true);
    expect(report.missing).toEqual([]);
    expect(report.periods).toContain('2199-06');
  });
  it('collects every invalid period, ID and risk without erasing rows or source positions', () => {
    const sheet = makeSheet(); sheet.rows[0].Year = 2568; sheet.rows[0].Month = 13; sheet.rows[0].ID = 999;
    sheet.rows[0]['Pred_Risk_T+1'] = 'ยังไม่กรอก'; sheet.rows[1]['Pred_Risk_T+4'] = 5;
    const before = JSON.stringify(sheet);
    const result = inspectRev3Import(sheet, matchRev3Columns(sheet), areas, ['2025-12'], '2025-12');
    expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(['year', 'month', 'unknown_id', 'risk', 'missing_areas']));
    expect(result.issues.filter(issue => issue.code === 'risk')).toHaveLength(2);
    expect(result.missing).toEqual([areas[0]]); expect(JSON.stringify(sheet)).toBe(before);
  });
  it('distinguishes identical duplicates from conflicting groups including three source rows', () => {
    const sheet = makeSheet(); sheet.rows.push({ ...sheet.rows[0] }, { ...sheet.rows[0], 'Pred_Risk_T+2': 2 });
    const report = inspectRev3Import(sheet, matchRev3Columns(sheet), areas, ['2025-12'], '2025-12');
    expect(report.issues.filter(issue => issue.code === 'duplicate_conflict').map(issue => issue.row)).toEqual([0, 2, 3]);
    sheet.excludedRows = [3];
    const corrected = inspectRev3Import(sheet, matchRev3Columns(sheet), areas, ['2025-12'], '2025-12');
    expect(corrected.issues.every(issue => issue.severity === 'warning')).toBe(true);
    expect(activeImportSheet(sheet).rows).toHaveLength(3); expect(sheet.rows).toHaveLength(4);
  });
  it('keeps formula/date errors blocked until that cell is explicitly corrected', () => {
    const original = makeSheet(); original.rows[0]['Pred_Risk_T+1'] = '=1+1';
    original.cellProblems = [{ row: 0, column: 'Pred_Risk_T+1', message: 'สูตร' }, { row: 1, column: 'Year', message: 'วันที่' }];
    const edited = correctImportCell(original, 0, 'Pred_Risk_T+1', '0', 'ตรวจต้นฉบับแล้ว');
    expect(importCellIssues(edited)).toHaveLength(1);
    expect(normalizeRev3Sheet(edited).rows[0]['Pred_Risk_T+1']).toBe(0);
    expect(original.rows[0]['Pred_Risk_T+1']).toBe('=1+1');
    const evidence = importEvidence(original, edited, 'a'.repeat(64));
    expect(evidence.rows).toEqual([{ sourceRow: 2, values: original.rows[0] }, { sourceRow: 5, values: original.rows[1] }]);
    expect(evidence.review).toMatchObject({ corrections: [{ before: '=1+1', after: '0', reason: 'ตรวจต้นฉบับแล้ว', sourceRow: 2 }] });
  });
  it('keeps large duplicate-group guidance bounded while reporting every affected row', () => {
    const sheet = makeSheet();
    sheet.rows = Array.from({ length: 1000 }, (_, index) => ({ ...sheet.rows[0], 'Pred_Risk_T+1': index % 2 }));
    const conflicts = inspectRev3Import(sheet, matchRev3Columns(sheet), areas, ['2025-12'], '2025-12').issues.filter(issue => issue.code === 'duplicate_conflict');
    expect(conflicts).toHaveLength(1000);
    expect(conflicts.every(issue => issue.suggestion.length < 250)).toBe(true);
    expect(conflicts[0].suggestion).toContain('และอีก 994 แถว');
  });
  it('never treats missing records or placeholders as out of scope, and preserves explicit zero/null', () => {
    const sheet = makeSheet(); sheet.rows.pop(); sheet.rows[0]['Pred_Risk_T+1'] = null;
    const report = inspectRev3Import(sheet, matchRev3Columns(sheet), areas, ['2025-12'], '2025-12');
    expect(report.missing).toEqual([areas[1]]); expect(report.issues).toHaveLength(1);
    sheet.rows[0]['Pred_Risk_T+1'] = 'ยังไม่กรอก';
    expect(inspectRev3Import(sheet, matchRev3Columns(sheet), areas, ['2025-12'], '2025-12').issues.map(issue => issue.code)).toContain('risk');
  });
  it('escapes formula-looking CSV text and keeps zero and leading-zero codes', () => {
    const csv = csvText(['code', 'risk', 'text'], [{ code: '001', risk: 0, text: '=1+1' }, { code: '002', risk: null, text: 'quoted,"name"' }]);
    expect(csv).toContain('"001","0","\'=1+1"'); expect(csv).toContain('"002","","quoted,""name"""');
  });
});

import { describe, expect, it } from 'vitest';
import ExcelJS from '@protobi/exceljs';
import { createReviewedImportWorkbook, type ImportSheet } from '../src/admin/workbook';
import { readDataFile } from '../src/admin/readDataFile';
import { correctImportCell, csvText, importCellIssues, inspectRev3Import, reviewedImportRows, reviewedIssueRows } from '../src/admin/importReview';
import { matchRev3Columns, normalizeRev3Sheet, rev3Fields } from '../src/admin/normalizedForecastImport';
import { REVIEW_HOLD } from '../src/admin/importReviewMarkers';

const bytes = (value: Uint8Array) => Uint8Array.from(value).buffer;
const areas = [{ sourceId: 0, subdistrictCode: '300101' }, { sourceId: 1, subdistrictCode: '300102' }];
function sourceSheet(): ImportSheet {
  return { name: 'ต้นฉบับ', columns: rev3Fields.map(field => field.key), sourceRows: [2, 5, 6], excludedRows: [2], rows: [0, 1, 0].map((ID, i) => ({
    Year: i === 0 ? 2568 : 2025, Month: 12, ID, TAMBON_E: 'ในเมือง', AMPHOE_E: 'เมืองนครราชสีมา', Irrigation_Status: 'RainFed',
    ...Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`Pred_Risk_T+${index + 1}`, index === 3 ? null : index % 3])),
    ...(i === 1 ? { 'Pred_Risk_T+1': '=1+1' } : {}),
  })), cellProblems: [{ row: 1, column: 'Pred_Risk_T+1', message: 'พบสูตรจาก Excel' }] };
}

describe('reviewed offline import files', () => {
  it('exports Cordia data, annotated cells, reports and excluded rows without importing report sheets', async () => {
    const source = sourceSheet(); const before = JSON.stringify(source);
    const mapping = matchRev3Columns(source);
    const issues = inspectRev3Import(source, mapping, areas, ['2025-12'], '2025-12').issues;
    const output = await createReviewedImportWorkbook(source, issues, null, mapping);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes(output));
    expect(book.worksheets.map(sheet => sheet.name)).toEqual(['Data', '_รายงานตรวจ', '_ไม่นำเข้า', '_วิธีใช้']);
    const data = book.getWorksheet('Data')!;
    expect(data.rowCount).toBe(3); expect(data.getCell('A1').font.name).toBe('Cordia New');
    expect(data.getCell('A2').fill).toMatchObject({ fgColor: { argb: 'FFFFE9E9' } });
    expect(JSON.stringify(data.getCell('A2').note)).toContain('ปีต้นทาง');
    expect(data.getCell('G3').value).toBe(`${REVIEW_HOLD}=1+1`);
    expect(data.getCell('G3').type).toBe(ExcelJS.ValueType.String);
    expect(data.getCell('G3').dataValidation.type).toBe('list');
    expect(book.getWorksheet('_ไม่นำเข้า')!.rowCount).toBe(2);
    const imported = await readDataFile(bytes(output), 'xlsx');
    expect(imported.sheets).toHaveLength(1); expect(imported.sheets[0].rows).toHaveLength(2);
    expect(importCellIssues(imported.sheets[0])).toHaveLength(1);
    expect(JSON.stringify(source)).toBe(before);
    const report = reviewedIssueRows(source, issues);
    expect(report.find(row => row.คอลัมน์ === 'Pred_Risk_T+1')).toMatchObject({ แถวต้นทาง: 'แถว 5', ลำดับรายการในไฟล์แก้ไข: 2 });
  });

  it('accepts explicit offline fixes after reimport without coercing null to zero', async () => {
    const source = sourceSheet(); const mapping = matchRev3Columns(source);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes(await createReviewedImportWorkbook(source, inspectRev3Import(source, mapping, areas, ['2025-12'], '2025-12').issues, null, mapping)));
    book.getWorksheet('Data')!.getCell('A2').value = 2025;
    book.getWorksheet('Data')!.getCell('G3').value = 0;
    const imported = (await readDataFile(bytes(new Uint8Array(await book.xlsx.writeBuffer())), 'xlsx')).sheets[0];
    expect(importCellIssues(imported)).toEqual([]);
    expect(inspectRev3Import(imported, matchRev3Columns(imported), areas, ['2025-12'], '2025-12').issues).toEqual([]);
    expect(normalizeRev3Sheet(imported).rows[1]['Pred_Risk_T+1']).toBe(0);
    expect(normalizeRev3Sheet(imported).rows[1]['Pred_Risk_T+4']).toBeNull();
  });

  it('preserves leading-zero text IDs, numeric zero, null, and API metadata in Excel', async () => {
    const source: ImportSheet = { name: 'สถานี', columns: ['stationId', 'value', 'unit'], rows: [{ stationId: '001', value: 0, unit: 'mm' }, { stationId: '002', value: null, unit: '=literal' }] };
    const metadata = { schemaVersion: 1, sourceId: 'station-test', batchId: 'batch-01' };
    const imported = await readDataFile(bytes(await createReviewedImportWorkbook(source, [], metadata)), 'xlsx');
    expect(imported.sheets[0].rows).toEqual(source.rows); expect(imported.metadata).toEqual(metadata);
  });

  it('keeps CSV source holds blocked after repeated exports, then accepts deliberate repairs', async () => {
    const source = sourceSheet();
    const download = (sheet: ImportSheet) => new TextEncoder().encode(csvText(sheet.columns, reviewedImportRows(sheet).map(row => row.values))).buffer;
    const imported = (await readDataFile(download(source), 'csv')).sheets[0];
    expect(imported.rows).toHaveLength(2); expect(importCellIssues(imported)).toHaveLength(1);
    expect(imported.rows[1]['Pred_Risk_T+1']).toBe(`${REVIEW_HOLD}=1+1`);
    const repeated = (await readDataFile(download(imported), 'csv')).sheets[0];
    expect(repeated.rows[1]['Pred_Risk_T+1']).toBe(`${REVIEW_HOLD}=1+1`);
    expect(importCellIssues(correctImportCell(repeated, 1, 'Pred_Risk_T+1', `${REVIEW_HOLD}=1+1`, 'unchanged hold'))).toHaveLength(1);
    let corrected = correctImportCell(repeated, 0, 'Year', '2025', 'confirmed');
    corrected = correctImportCell(corrected, 1, 'Pred_Risk_T+1', '0', 'confirmed');
    const ready = (await readDataFile(download(corrected), 'csv')).sheets[0];
    expect(importCellIssues(ready)).toEqual([]);
    expect(inspectRev3Import(ready, matchRev3Columns(ready), areas, ['2025-12'], '2025-12').issues).toEqual([]);
    expect(normalizeRev3Sheet(ready).rows[1]['Pred_Risk_T+4']).toBeNull();
  });
});

import { normalizeRev3Sheet, workbookRiskColumns } from './normalizedForecastImport';
import type { ImportSheet } from './workbook';
import type { Json, Payload } from './types';
import { referenceCsv } from './referenceExport';
import { holdReviewValue, isReviewHeld, reviewHoldMessage } from './importReviewMarkers';

export type ImportIssue = { row: number | null; column?: string; code: string; message: string; suggestion: string; severity: 'error' | 'warning' };
export type ImportArea = { sourceId: number; subdistrictCode: string };
export const sourceRowLabel = (sheet: ImportSheet, index: number) => sheet.sourceRows?.[index] === 0 ? `แถวเพิ่ม ${index + 1}` : `แถว ${sheet.sourceRows?.[index] ?? index + 2}`;
export function activeImportSheet(sheet: ImportSheet): ImportSheet {
  const excluded = new Set(sheet.excludedRows ?? []);
  return { ...sheet, rows: sheet.rows.filter((_, index) => !excluded.has(index)), sourceRows: sheet.rows.flatMap((_, index) => excluded.has(index) ? [] : [sheet.sourceRows?.[index] ?? index + 2]) };
}
export function importCellIssues(sheet: ImportSheet, columns = sheet.columns): ImportIssue[] {
  const excluded = new Set(sheet.excludedRows ?? []);
  return (sheet.cellProblems ?? []).filter(problem => !excluded.has(problem.row) && columns.includes(problem.column)).map(problem => ({ ...problem,
    code: 'source_cell', severity: 'error', suggestion: 'เปิดแก้ไขช่องนี้ แล้วแทนที่ด้วยค่าต้นทางที่ยืนยันแล้ว' }));
}
export function inspectRev3Import(sheet: ImportSheet, mapping: Record<string, string>, areas: ImportArea[] | null, periods: string[] | null, origin: string) {
  const issues = importCellIssues(sheet, Object.values(mapping));
  let normalized: ImportSheet;
  try { normalized = normalizeRev3Sheet(sheet, mapping); }
  catch (error) { return { issues: [...issues, { row: null, code: 'mapping', severity: 'error' as const, message: (error as Error).message, suggestion: 'จับคู่คอลัมน์ที่จำเป็นให้ครบและไม่ซ้ำกัน' }], periods: [], missing: [] as ImportArea[] }; }
  const excluded = new Set(sheet.excludedRows ?? []);
  const ids = new Set(areas?.map(area => String(area.sourceId)));
  const found = new Set<string>(); const origins = new Set<string>();
  const groups = new Map<string, number[]>();
  const sourceProblems = new Set(issues.map(issue => `${issue.row}/${issue.column}`));
  const add = (row: number, field: string, code: string, message: string, suggestion: string, severity: 'error' | 'warning' = 'error') => {
    if (!sourceProblems.has(`${row}/${mapping[field]}`)) issues.push({ row, column: mapping[field], code, message, suggestion, severity });
  };
  normalized.rows.forEach((value, index) => {
    if (excluded.has(index)) return;
    const validYear = Number.isInteger(value.Year) && Number(value.Year) >= 1900 && Number(value.Year) <= 2100;
    const validMonth = Number.isInteger(value.Month) && Number(value.Month) >= 1 && Number(value.Month) <= 12;
    if (!validYear) add(index, 'Year', 'year', 'ปีต้นทางไม่ถูกต้อง', 'ใช้ปี ค.ศ. 1900–2100 เช่น 2025 ไม่ใช่ปี พ.ศ.');
    if (!validMonth) add(index, 'Month', 'month', 'เดือนต้นทางไม่ถูกต้อง', 'ระบุเลขเดือน 1–12');
    const period = validYear && validMonth ? `${value.Year}-${String(value.Month).padStart(2, '0')}` : '';
    if (period) origins.add(period);
    if (period && periods && !periods.includes(period)) add(index, 'Year', 'unsupported_origin', `รอบ ${period} ยังไม่มีในคลัง`, 'ตรวจปีและเดือน การเพิ่มรอบใหม่ยังไม่เปิดใช้');
    if (areas && !ids.has(String(value.ID))) add(index, 'ID', 'unknown_id', `ไม่พบ ID ${String(value.ID ?? '')} ในทะเบียน`, 'เลือกพื้นที่จากทะเบียน ห้ามเดาจากชื่อหรือเติมรหัสใหม่');
    if (period === origin && ids.has(String(value.ID))) found.add(String(value.ID));
    workbookRiskColumns.forEach(column => {
      if (value[column] !== null && ![0, 1, 2].includes(value[column] as number)) add(index, column, 'risk', 'ยังไม่มีผลพยากรณ์ที่ถูกต้อง', 'เลือก 0, 1, 2 หรือระบุนอกขอบเขตตามต้นฉบับ ช่องที่ยังไม่กรอกไม่ใช่ระดับ 0');
    });
    if (period && ids.has(String(value.ID))) {
      const key = `${period}/${value.ID}`;
      const group = groups.get(key) ?? []; group.push(index); groups.set(key, group);
    }
  });
  for (const indices of groups.values()) {
    if (indices.length < 2) continue;
    const conflicts = workbookRiskColumns.filter(column => new Set(indices.map(index => JSON.stringify(normalized.rows[index][column]))).size > 1);
    for (const index of indices) {
      const examples = indices.slice(0, 6).filter(other => other !== index).slice(0, 5);
      const remaining = indices.length - 1 - examples.length;
      if (conflicts.length) conflicts.forEach(column => add(index, column, 'duplicate_conflict', 'พื้นที่และเดือนเดียวกันมีค่าพยากรณ์ต่างกัน',
        `เทียบ ${examples.map(other => sourceRowLabel(sheet, other)).join(', ')}${remaining ? ` และอีก ${remaining} แถว` : ''} แล้วแก้ค่าให้ตรงหลักฐาน หรือไม่นำเข้าแถวที่ไม่ใช้`));
      else add(index, 'ID', 'duplicate_identical', 'มีค่าพยากรณ์ซ้ำกันทุกเดือน', 'ระบบจะรวมค่าพยากรณ์ที่ตรงกันเป็นชุดเดียว โดยเก็บแถวต้นฉบับไว้', 'warning');
    }
  }
  const missing = origin && areas && origins.has(origin) ? areas.filter(area => !found.has(String(area.sourceId))) : [];
  if (missing.length) issues.push({ row: null, code: 'missing_areas', severity: 'error', message: `รอบ ${origin} ขาด ${missing.length} ตำบล`, suggestion: 'เพิ่มแถวของพื้นที่ที่ขาดและกรอกผลจากต้นทาง ไม่ใช้ข้อมูลที่เผยแพร่แทนโดยอัตโนมัติ' });
  if (!normalized.rows.some((_, index) => !excluded.has(index))) issues.push({ row: null, code: 'empty', severity: 'error', message: 'ไม่มีแถวที่จะนำเข้า', suggestion: 'คืนแถวที่ไม่นำเข้าหรือเพิ่มข้อมูลก่อนดำเนินการ' });
  return { issues, periods: [...origins].sort().reverse(), missing };
}

export function correctImportCell(sheet: ImportSheet, row: number, column: string, after: Json, reason: string): ImportSheet {
  return { ...sheet, rows: sheet.rows.map((value, index) => index === row ? { ...value, [column]: after } : value),
    cellProblems: [...sheet.cellProblems?.filter(problem => problem.row !== row || problem.column !== column) ?? [],
      ...isReviewHeld(after) ? [{ row, column, message: reviewHoldMessage }] : []],
    corrections: [...sheet.corrections ?? [], { row, column, before: sheet.rows[row][column] ?? null, after, reason }] };
}
export function importEvidence(original: ImportSheet, edited: ImportSheet, sha256: string, mapping?: Record<string, string>, origin?: string): Payload {
  const matches = (row: Payload) => !mapping || !origin || `${row[mapping.Year]}-${String(row[mapping.Month]).padStart(2, '0')}` === origin;
  const relevant = new Set(edited.rows.flatMap((row, index) => matches(row) || original.rows[index] && matches(original.rows[index]) || edited.excludedRows?.includes(index) ? [index] : []));
  const sourceRows = original.rows.flatMap((values, index) => relevant.has(index) ? [{ sourceRow: original.sourceRows?.[index] ?? index + 2, values }] : []);
  if (sourceRows.length > 2000) throw new Error('หลักฐานต้นฉบับรอบนี้เกิน 2,000 แถว กรุณาแยกไฟล์ตามรอบเดือน');
  return { sha256, sheet: original.name,
    rows: sourceRows,
    ...(edited.corrections?.length || edited.excludedRows?.length || edited.rows.length !== original.rows.length ? {
      review: { corrections: (edited.corrections ?? []).filter(entry => relevant.has(entry.row)).map(entry => ({ ...entry, sourceRow: edited.sourceRows?.[entry.row] ?? entry.row + 2 })),
        excludedRows: (edited.excludedRows ?? []).filter(index => relevant.has(index)).map(index => edited.sourceRows?.[index] ?? index + 2),
        addedRows: edited.rows.slice(original.rows.length).filter(matches) },
    } : {}) };
}

export function csvText(columns: string[], rows: Payload[]) {
  return referenceCsv(columns, rows.map(row => ({ cells: columns.map(column => {
    const value = row[column]; return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  }) })));
}
export function reviewedImportRows(sheet: ImportSheet) {
  const blocked = new Map<number, Set<string>>();
  for (const problem of sheet.cellProblems ?? []) {
    const columns = blocked.get(problem.row) ?? new Set<string>(); columns.add(problem.column); blocked.set(problem.row, columns);
  }
  const excluded = new Set(sheet.excludedRows ?? []);
  return sheet.rows.flatMap((row, index) => excluded.has(index) ? [] : [{ index, values: Object.fromEntries(sheet.columns.map(column =>
    [column, blocked.get(index)?.has(column) ? holdReviewValue(row[column]) : row[column] ?? null])) }]);
}

export const reviewReportColumns = ['ชีตต้นทาง', 'แถวต้นทาง', 'ลำดับรายการในไฟล์แก้ไข', 'คอลัมน์', 'ระดับ', 'ปัญหา', 'วิธีแก้ไข'];
export function reviewedIssueRows(sheet: ImportSheet, issues: ImportIssue[]): Payload[] {
  const excluded = new Set(sheet.excludedRows ?? []);
  const positions = new Map<number, number>();
  sheet.rows.forEach((_, index) => { if (!excluded.has(index)) positions.set(index, positions.size + 1); });
  return [...sheet.headerWarnings?.map(message => ({ row: null, code: 'header', message, severity: 'warning', suggestion: 'ตรวจและจับคู่หัวคอลัมน์กับค่าตัวอย่างก่อนนำเข้า' } as ImportIssue)) ?? [], ...issues].map(issue => ({
    ชีตต้นทาง: sheet.name, แถวต้นทาง: issue.row === null ? '' : sourceRowLabel(sheet, issue.row),
    ลำดับรายการในไฟล์แก้ไข: issue.row === null ? '' : positions.get(issue.row) ?? 'ไม่นำเข้า', คอลัมน์: issue.column ?? '',
    ระดับ: issue.severity === 'error' ? 'ต้องแก้ไข' : 'คำเตือน', ปัญหา: issue.message, วิธีแก้ไข: issue.suggestion,
  }));
}

export function downloadImportCsv(columns: string[], rows: Payload[], name: string) {
  downloadImportBlob(new Blob([csvText(columns, rows)], { type: 'text/csv;charset=utf-8' }), name);
}
export function downloadImportBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

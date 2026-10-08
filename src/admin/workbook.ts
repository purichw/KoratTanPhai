import ExcelJS from '@protobi/exceljs';
import { DATA_FIELDS, type DataKind } from '../../shared/dataFields.mjs';
import { rowsKey, type Payload, type Json } from './types';
import { reviewedImportRows, reviewedIssueRows, reviewReportColumns, sourceRowLabel, type ImportIssue } from './importReview';

export type ImportCellProblem = { row: number; column: string; message: string };
export type ImportCorrection = { row: number; column: string; before: Json; after: Json; reason: string };
export type ImportSheet = { name: string; columns: string[]; rows: Payload[]; sourceRows?: number[];
  cellProblems?: ImportCellProblem[]; headerWarnings?: string[]; excludedRows?: number[]; corrections?: ImportCorrection[] };
export type ImportFile = { sheets: ImportSheet[]; metadata: Payload | null };
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 100000;

export async function readAdminWorkbook(bytes: ArrayBuffer): Promise<ImportFile> {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error('ไฟล์เกิน 20 MB');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const sheets: ImportSheet[] = [];
  let metadata: Payload | null = null;
  for (const sheet of workbook.worksheets) {
    if (workbook.getWorksheet('ข้อมูลพยากรณ์') && ['คำอธิบาย', 'ตัวอย่าง', 'รายชื่อพื้นที่'].includes(sheet.name)) continue;
    if (sheet.name === '_Metadata') {
      metadata = {};
      const parts = new Map<string, { total: number; chunks: Map<number, string> }>();
      sheet.eachRow((row, index) => {
        if (index === 1) return;
        const key = row.getCell(1).text;
        if (!key || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('ชื่อ field ใน metadata ไม่ถูกต้อง');
        const part = Number(row.getCell(3).value ?? 1);
        const total = Number(row.getCell(4).value ?? 1);
        if (!Number.isInteger(part) || !Number.isInteger(total) || part < 1 || part > total || total > 100) throw new Error('ลำดับ metadata ไม่ถูกต้อง');
        const entry = parts.get(key) ?? { total, chunks: new Map<number, string>() };
        if (entry.total !== total || entry.chunks.has(part)) throw new Error('ชื่อ field ใน metadata ซ้ำกัน');
        entry.chunks.set(part, row.getCell(2).text); parts.set(key, entry);
      });
      for (const [key, entry] of parts) {
        if (entry.chunks.size !== entry.total) throw new Error('metadata ไม่ครบทุกส่วน');
        metadata[key] = JSON.parse(Array.from({ length: entry.total }, (_, index) => entry.chunks.get(index + 1)).join('')) as Json;
      }
      continue;
    }
    if (sheet.name.startsWith('_')) continue;
    if (sheet.rowCount > MAX_ROWS + 1 || sheet.columnCount > 100) throw new Error('หนึ่งชีตรับได้ไม่เกิน 100,000 รายการและ 100 คอลัมน์');
    const columns: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, cell => columns.push(cell.text.trim()));
    if (!columns.length || columns.some(key => !key || ['__proto__', 'constructor', 'prototype'].includes(key))
      || new Set(columns).size !== columns.length) throw new Error('หัวคอลัมน์ต้องไม่ว่างและไม่ซ้ำกัน');
    const rows: Payload[] = []; const sourceRows: number[] = [];
    for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex++) {
      const row = sheet.getRow(rowIndex);
      if (!row.hasValues) continue;
      const record: Payload = {};
      columns.forEach((key, column) => {
        const cell = row.getCell(column + 1);
        if (cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.Error) {
          throw new Error(`แถว ${rowIndex}: พบสูตรหรือข้อผิดพลาด ต้องใช้ค่าข้อมูลต้นทางที่ยืนยันแล้ว`);
        }
        const value = cell.value;
        if (value === null || value === undefined) record[key] = null;
        else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') record[key] = value;
        else if (value instanceof Date) throw new Error(`แถว ${rowIndex}: วันที่ต้องระบุเป็นข้อความตามรูปแบบ API พร้อมเขตเวลาถ้าจำเป็น`);
        else record[key] = cell.text;
      });
      rows.push(record); sourceRows.push(rowIndex);
    }
    sheets.push({ name: sheet.name, columns, rows, sourceRows });
  }
  if (!sheets.length) throw new Error('ไม่พบตารางข้อมูลในไฟล์');
  return { sheets, metadata };
}

export function mapImportRows(kind: DataKind, sheet: ImportSheet, mapping: Record<string, string>, ignored: string[] = []): Payload[] {
  const selected = Object.values(mapping).filter(Boolean);
  if (new Set(selected).size !== selected.length) throw new Error('หนึ่งคอลัมน์จับคู่ได้เพียง field เดียว');
  if (sheet.columns.some(column => !selected.includes(column) && !ignored.includes(column))) throw new Error('ยังมีคอลัมน์ที่ไม่ได้จับคู่หรือยืนยันไม่นำเข้า');
  return sheet.rows.map(row => {
    const output: Payload = {};
    for (const field of DATA_FIELDS[kind]) {
      const column = mapping[field.key];
      if (!column) continue;
      let value = row[column];
      if (value === null || value === '') {
        if (field.optional) continue;
        value = field.nullable ? null : '';
      } else if (field.type === 'number' && typeof value === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value.trim())) {
        const number = Number(value);
        if (Number.isFinite(number)) value = number;
      }
      // Invalid values are retained for visible correction, not guessed/coerced.
      output[field.key] = value;
    }
    return output;
  });
}

export async function createAdminWorkbook(kind: DataKind, payload: Payload) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'โคราชทันภัย';
  const rowKey = rowsKey(kind);
  const rows = payload[rowKey] as Payload[];
  const keys = [...new Set([...DATA_FIELDS[kind].map(field => field.key), ...rows.flatMap(row => Object.keys(row))])];
  const sheet = workbook.addWorksheet('Data', { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
  sheet.columns = keys.map(key => ({ header: key, key, width: key.toLowerCase().includes('at') ? 30 : 24 }));
  rows.forEach(row => sheet.addRow(keys.map(key => {
    const value = row[key];
    return value === undefined || value === null ? null : typeof value === 'object' ? JSON.stringify(value) : value;
  })));
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: keys.length } };
  addAdminMetadata(workbook, Object.fromEntries(Object.entries(payload).filter(([key]) => key !== rowKey)));
  workbook.worksheets.forEach(styleAdminSheet);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

function addAdminMetadata(workbook: ExcelJS.Workbook, payload: Payload) {
  const metadata = workbook.addWorksheet('_Metadata');
  metadata.columns = [{ header: 'field', key: 'field', width: 30 }, { header: 'value_json', key: 'value', width: 100 }, { header: 'part', width: 10 }, { header: 'parts', width: 10 }];
  for (const [key, value] of Object.entries(payload)) {
    const json = JSON.stringify(value);
    const count = Math.max(1, Math.ceil(json.length / 30000));
    for (let part = 1; part <= count; part++) metadata.addRow([key, json.slice((part - 1) * 30000, part * 30000), part, count]);
  }
}

function styleAdminSheet(page: ExcelJS.Worksheet) {
  page.eachRow((row, index) => {
    row.height = index === 1 ? 32 : 28;
    row.eachCell({ includeEmpty: true }, cell => {
      cell.font = { name: 'Cordia New', size: 16, bold: index === 1, color: { argb: 'FF20362E' } };
      cell.alignment = { vertical: 'middle', horizontal: page.name === '_Metadata' ? 'left' : 'center', wrapText: true };
      if (index === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F2EC' } };
    });
  });
}

/** Reports stay outside Data so the reviewed workbook remains a normal import. */
export async function createReviewedImportWorkbook(source: ImportSheet, issues: ImportIssue[], metadata: Payload | null,
  mapping: Record<string, string> = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'โคราชทันภัย'; workbook.created = new Date();
  const data = workbook.addWorksheet('Data', { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
  data.columns = source.columns.map(column => ({ header: column, width: /name|TAMBON|AMPHOE|ชื่อ/i.test(column) ? 30 : 23 }));
  const exported = reviewedImportRows(source);
  const issuesByCell = new Map<string, ImportIssue[]>();
  issues.forEach(issue => {
    if (issue.row === null) return;
    const key = `${issue.row}/${issue.column ?? '*'}`;
    const list = issuesByCell.get(key) ?? []; list.push(issue); issuesByCell.set(key, list);
  });
  const riskColumns = new Set(Object.entries(mapping).filter(([key]) => /^Pred_Risk_T\+[1-6]$/.test(key)).map(([, column]) => column));
  exported.forEach(({ index, values }) => {
    const row = data.addRow(source.columns.map(column => {
      const value = values[column]; return value && typeof value === 'object' ? JSON.stringify(value) : value;
    }));
    row.eachCell({ includeEmpty: true }, (cell, position) => {
      const column = source.columns[position - 1];
      // Strings, including leading-zero identifiers and formula-like text, stay text.
      if (typeof cell.value === 'string') cell.numFmt = '@';
      const problems = [...issuesByCell.get(`${index}/${column}`) ?? [], ...issuesByCell.get(`${index}/*`) ?? []];
      if (problems.length) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: problems.some(issue => issue.severity === 'error') ? 'FFFFE9E9' : 'FFFFF2D5' } };
        cell.note = `${source.name} · ${sourceRowLabel(source, index)}\n${problems.map(problem => `${problem.message}\n${problem.suggestion}`).join('\n\n')}\nผลตรวจ ณ เวลาดาวน์โหลด ต้องนำกลับเข้าระบบเพื่อตรวจใหม่`;
      }
      if (riskColumns.has(column)) cell.dataValidation = { type: 'list', allowBlank: true,
        formulae: ['"0,1,2,นอกขอบเขตการศึกษา"'], showInputMessage: true, promptTitle: 'ผลพยากรณ์จากต้นทาง',
        prompt: '0, 1, 2 หรือ นอกขอบเขตการศึกษา; ช่องว่าง rev3 หมายถึงนอกขอบเขต ไม่ใช่ 0', showErrorMessage: true,
        errorStyle: 'warning', errorTitle: 'ตรวจค่าพยากรณ์', error: 'ค่าที่เลือกต้องตรงกับหลักฐานต้นทาง ระบบจะตรวจซ้ำเมื่อนำเข้า' };
    });
  });
  data.autoFilter = { from: { row: 1, column: 1 }, to: { row: exported.length + 1, column: source.columns.length } };
  const report = workbook.addWorksheet('_รายงานตรวจ', { views: [{ state: 'frozen', ySplit: 1 }] });
  report.columns = reviewReportColumns.map((column, index) => ({ header: column, width: [22, 20, 22, 26, 16, 48, 70][index] }));
  const reportRows = reviewedIssueRows(source, issues);
  reportRows.forEach(row => report.addRow(reviewReportColumns.map(column => row[column])));
  if (!reportRows.length) report.addRow(['', '', '', '', '', 'ไม่พบปัญหาในขั้นตรวจไฟล์ ณ เวลาดาวน์โหลด', 'ยังต้องตรวจรายละเอียดและยืนยันก่อนเผยแพร่']);
  report.autoFilter = `A1:G${report.rowCount}`;
  if (source.excludedRows?.length) {
    const excluded = workbook.addWorksheet('_ไม่นำเข้า', { views: [{ state: 'frozen', ySplit: 1 }] });
    excluded.columns = [{ header: 'แถวต้นทาง', width: 20 }, ...source.columns.map(column => ({ header: column, width: 23 }))];
    source.excludedRows.forEach(index => excluded.addRow([sourceRowLabel(source, index), ...source.columns.map(column => {
      const value = source.rows[index][column]; return value && typeof value === 'object' ? JSON.stringify(value) : value;
    })]));
  }
  const guide = workbook.addWorksheet('_วิธีใช้');
  guide.columns = [{ header: 'หัวข้อ', width: 28 }, { header: 'รายละเอียด', width: 100 }];
  [
    ['ชีตต้นทาง', source.name], ['ตรวจเมื่อ', workbook.created.toISOString()],
    ['ข้อมูลสำหรับแก้ไข', `${exported.length} รายการใน Data; รวมทุกแถวที่เลือกนำเข้า ไม่จำกัดตามตัวกรองบนหน้าจอ`],
    ['แก้แล้วนำเข้าใหม่', 'แก้ค่าใน Data โดยคงหัวคอลัมน์ไว้ บันทึก .xlsx แล้วอัปโหลดกลับเข้า CMS เลือก Data และตรวจการจับคู่คอลัมน์'],
    ['สีและหมายเหตุ', 'สีชมพู = ต้องแก้ไข; สีเหลือง = คำเตือน สี หมายเหตุ และรายงานเป็นผลตรวจ ณ เวลาดาวน์โหลด ไม่อัปเดตเองเมื่อแก้ไฟล์'],
    ['เซลล์ที่ยังรอยืนยัน', 'ข้อความ [KTP_REVIEW_REQUIRED] เก็บช่องที่เคยมีสูตร/ข้อผิดพลาด/วันที่ไว้ให้ตรวจ แทนที่ทั้งช่องด้วยค่าต้นทางที่ยืนยันแล้ว ห้ามลบเครื่องหมายเพื่อข้ามการตรวจ'],
    ['ความหมายข้อมูล', 'ค่าศูนย์ไม่ใช่ค่าว่าง สำหรับ rev3 ช่องความเสี่ยงว่างหมายถึงนอกขอบเขตการศึกษา พื้นที่ที่ขาดหรือยังไม่กรอกต้องหาค่าจากต้นทาง ไม่เติม 0 โดยอัตโนมัติ'],
    ['รายงานปัญหา', '_รายงานตรวจ อ้างแถวต้นทางเดิมและลำดับรายการใน Data (ไม่รวมหัวคอลัมน์) เมื่อเรียงหรือเพิ่มแถวให้ตรวจใหม่ใน CMS'],
    ['รายการที่ไม่นำเข้า', '_ไม่นำเข้าเป็นหลักฐานเท่านั้น ระบบไม่นำชีตที่ขึ้นต้นด้วย _ มาเป็นแถวข้อมูล'],
    ['CSV', 'CSV ไม่มีสี หมายเหตุ หรือรายละเอียดชุดข้อมูลประกอบ ให้ดาวน์โหลดรายงานปัญหาแยกและระบุรายละเอียดชุดข้อมูลใหม่เมื่อนำเข้า รหัสที่มีศูนย์นำหน้าควรเปิดเป็นข้อความหรือใช้ .xlsx'],
    ['สถานะ', 'ไฟล์นี้เป็นสำเนาที่อยู่ระหว่างตรวจ ไม่ใช่การยืนยันว่าข้อมูลถูกต้องหรือเผยแพร่แล้ว ระบบจะตรวจใหม่และไม่เปลี่ยนหน้าบ้านจนกว่าจะยืนยันเผยแพร่'],
  ].forEach(row => guide.addRow(row));
  if (metadata) addAdminMetadata(workbook, metadata);
  workbook.worksheets.forEach(styleAdminSheet);
  data.eachRow(row => { row.height = 44; });
  for (const page of [report, guide]) page.eachRow((row, index) => {
    row.height = index === 1 ? 36 : 64;
    if (index !== 1) row.eachCell(cell => { cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }; });
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

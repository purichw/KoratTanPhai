import { test, expect, seedAdminSession } from './fixtures';
import { cmsTestDatabase } from '../tests/fixtures/admin-data.mjs';
import { readFile, mkdir } from 'node:fs/promises';
import ExcelJS from '@protobi/exceljs';

test('repairs invalid year, unknown ID, formula and missing area in the UI, then persists source and corrections', async ({ page, context }, testInfo) => {
  test.setTimeout(120000);
  const db = await cmsTestDatabase(context, { forecasts: true, references: true });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    const archive = JSON.parse(await readFile('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
    const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet('Data');
    sheet.addRow(['Year', 'Month', 'ID', 'TAMBON_E', 'AMPHOE_E', 'Irrigation_Status', ...Array.from({ length: 6 }, (_, index) => `Pred_Risk_T+${index + 1}`)]);
    archive.locations.slice(0, -1).forEach((area: { sourceId: number; subdistrictNameTh: string; districtNameTh: string }) =>
      sheet.addRow([2025, 12, area.sourceId, area.subdistrictNameTh, area.districtNameTh, '', 0, 1, 2, null, 0, 1]));
    sheet.getCell('A2').value = 2568; sheet.getCell('C2').value = 999999;
    sheet.getCell('G3').value = { formula: '1+1', result: 2 };
    await seedAdminSession(page); await page.goto('/admin?view=upload');
    await page.getByLabel('ไฟล์ข้อมูล', { exact: true }).setInputFiles({ name: 'repair.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await book.xlsx.writeBuffer()) });
    await expect(page.getByText('ปีต้นทางไม่ถูกต้อง', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ตรวจรายละเอียด', exact: true })).toBeDisabled();
    await mkdir('artifacts/import-repair', { recursive: true });
    await page.getByRole('region', { name: 'ตรวจและแก้ไฟล์นำเข้า' }).scrollIntoViewIfNeeded();
    await page.getByRole('region', { name: 'ตรวจและแก้ไฟล์นำเข้า' }).evaluate(element => {
      const scroller = element.closest('.nr-tool-dialog-content')!;
      scroller.scrollTop += element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12;
    });
    await page.screenshot({ path: `artifacts/import-repair/${testInfo.project.name}-issues.png` });
    await page.getByRole('button', { name: 'แถว 2 · Year', exact: true }).click();
    const editor = page.getByRole('dialog').last();
    await editor.getByLabel('ปีต้นทาง (ค.ศ.)', { exact: true }).fill('2025');
    await editor.getByRole('combobox', { name: 'รหัสพื้นที่ต้นฉบับ', exact: true }).click();
    await page.getByRole('option', { name: new RegExp(`ID ${archive.locations[0].sourceId}$`) }).click();
    await editor.getByLabel('เหตุผลการแก้ไฟล์').fill('ยืนยันปี ค.ศ. และ ID จากทะเบียน');
    await editor.locator('.nr-tool-dialog-content').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: `artifacts/import-repair/${testInfo.project.name}-cell-edit.png` });
    await editor.getByRole('button', { name: 'ใช้ค่าที่แก้ไข', exact: true }).click();
    await expect(page.getByText('ปีต้นทางไม่ถูกต้อง', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'แถว 3 · Pred_Risk_T+1', exact: true }).first().click();
    await page.getByRole('dialog').last().getByRole('combobox', { name: 'ความเสี่ยงล่วงหน้า 1 เดือน', exact: true }).click();
    await page.getByRole('option', { name: '0 · ไม่พบความเสี่ยง', exact: true }).click();
    await page.getByLabel('เหตุผลการแก้ไฟล์').fill('ใช้ค่าที่ตรวจสอบแล้ว ไม่ใช้ผลสูตร');
    await page.getByRole('button', { name: 'ใช้ค่าที่แก้ไข', exact: true }).click();
    await page.getByRole('button', { name: 'เพิ่มพื้นที่ที่ขาด 1 ตำบล', exact: true }).click();
    await page.getByRole('button', { name: 'แถวเพิ่ม 289 · Pred_Risk_T+1', exact: true }).first().click();
    for (let h = 1; h <= 6; h++) {
      await page.getByRole('dialog').last().getByRole('combobox', { name: `ความเสี่ยงล่วงหน้า ${h} เดือน`, exact: true }).click();
      await page.getByRole('option', { name: h === 4 ? 'นอกขอบเขตการศึกษา' : '0 · ไม่พบความเสี่ยง', exact: true }).click();
    }
    await page.getByLabel('เหตุผลการแก้ไฟล์').fill('เติมผลครบหกเดือนจากเอกสารต้นทาง');
    await page.getByRole('button', { name: 'ใช้ค่าที่แก้ไข', exact: true }).click();
    await expect(page.getByRole('button', { name: 'ตรวจรายละเอียด', exact: true })).toBeEnabled();
    const csv = page.waitForEvent('download'); await page.getByRole('button', { name: 'CSV สำหรับแก้ไข', exact: true }).click();
    expect((await csv).suggestedFilename()).toBe('Korat_import_corrected.csv');
    await page.getByRole('button', { name: 'ตรวจรายละเอียด', exact: true }).click();
    await expect(page.getByText('ผ่านการตรวจรูปแบบข้อมูล', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'สร้างฉบับร่าง', exact: true }).click();
    await expect(page).toHaveURL(/draft=/);
    const id = new URL(page.url()).searchParams.get('draft')!;
    await expect(page.getByRole('button', { name: 'เผยแพร่รุ่นใหม่', exact: true })).toBeEnabled();
    await page.reload();
    await expect(page.getByText('ผ่านการตรวจรูปแบบข้อมูล', { exact: true })).toBeVisible();
    const draft = await db.operation('get', { id });
    expect(draft.state).toBe('draft'); expect(draft.payload.sourceImport.rows).toHaveLength(288);
    expect(draft.payload.sourceImport.rows[0].values.Year).toBe(2568);
    expect(draft.payload.sourceImport.rows[1].values['Pred_Risk_T+1']).toBe('=1+1');
    expect(draft.payload.sourceImport.review.corrections).toHaveLength(9);
    expect(draft.payload.sourceImport.review.addedRows).toHaveLength(1);
    expect(draft.payload.predictions).toHaveLength(1734);
    expect((await db.operation('forecast:catalog', {})).revision.datasetId).toBe(draft.payload.baseDatasetId);
    await page.screenshot({ path: `artifacts/import-repair/${testInfo.project.name}-saved.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await db.close(); }
});

test('API-shaped CSV reports field errors before save and rechecks fixes and duplicate removal automatically', async ({ page, context }, testInfo) => {
  test.setTimeout(90000);
  const db = await cmsTestDatabase(context, { references: true });
  try {
    await seedAdminSession(page); await page.goto('/admin?view=upload');
    await page.getByRole('combobox', { name: /^ประเภทข้อมูล / }).click();
    await page.getByRole('option', { name: 'ข้อมูลสถานีตรวจวัด', exact: true }).click();
    const source = 'stationId,observedAt,metric,value,unit,aggregation,periodMinutes,quality\nS1,2025-12-01T00:00:00Z,rainfall,bad,mm,sum,bad,reported\nS1,2025-12-01T00:00:00Z,rainfall,0,mm,sum,60,reported';
    await page.getByLabel('ไฟล์ข้อมูล', { exact: true }).setInputFiles({ name: 'station.csv', mimeType: 'text/csv', buffer: Buffer.from(source) });
    await page.getByRole('button', { name: 'ตรวจรายละเอียด', exact: true }).click();
    await page.getByLabel('รหัสแหล่งข้อมูล', { exact: true }).fill('station-test');
    await page.getByLabel('รหัสชุดข้อมูล', { exact: true }).fill('import-test-1');
    await expect(page.getByText('ค่าตรวจวัด: รูปแบบข้อมูลไม่ถูกต้อง', { exact: true })).toBeVisible();
    const reviewedDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Excel พร้อมผลตรวจ', exact: true }).click();
    const reviewedPath = await (await reviewedDownload).path();
    const reviewed = new ExcelJS.Workbook(); await reviewed.xlsx.load(await readFile(reviewedPath!));
    expect(reviewed.getWorksheet('Data')!.getCell('D2').value).toBe('bad');
    expect(reviewed.getWorksheet('_Metadata')!.getColumn(1).values).toContain('sourceId');
    await mkdir('artifacts/import-repair', { recursive: true });
    await page.locator('.cms-review-downloads').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `artifacts/import-repair/${testInfo.project.name}-preview-downloads.png` });
    await page.getByRole('button', { name: 'แก้ไขรายการ 1', exact: true }).first().click();
    await page.getByLabel('ค่าตรวจวัด', { exact: true }).fill('0');
    await page.getByLabel('ช่วงเวลา (นาที)', { exact: true }).fill('60');
    await page.getByRole('button', { name: 'ใช้ค่าที่แก้ไข', exact: true }).click();
    await page.getByRole('button', { name: 'แก้ไขรายการ 2', exact: true }).click();
    await page.getByRole('button', { name: 'ไม่นำเข้ารายการนี้', exact: true }).click();
    await page.getByRole('button', { name: 'ยืนยันไม่นำเข้า', exact: true }).click();
    await expect(page.getByText('ผ่านการตรวจรูปแบบข้อมูล', { exact: true })).toBeVisible();
    expect((await db.operation('list', {})).total).toBe(0);
    await page.getByRole('button', { name: 'ย้อนกลับ', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'ย้อนกลับไปตรวจไฟล์?', exact: true })).toBeVisible();
    await page.getByRole('dialog').last().locator('footer').getByRole('button', { name: 'กลับไปแก้ไข', exact: true }).click();
    await page.getByRole('button', { name: 'สร้างฉบับร่าง', exact: true }).click();
    await expect(page).toHaveURL(/draft=/);
    const draft = await db.operation('get', { id: new URL(page.url()).searchParams.get('draft')! });
    expect(draft.state).toBe('draft'); expect(draft.payload.observations).toHaveLength(1);
    expect(draft.payload.observations[0].value).toBe(0);
    expect(draft.payload.observations[0].periodMinutes).toBe(60);
  } finally { await db.close(); }
});

test('downloads reviewed Excel and CSV, preserves unresolved holds, and reimports external Excel fixes', async ({ page, context }, testInfo) => {
  test.setTimeout(120000);
  const db = await cmsTestDatabase(context, { forecasts: true, references: true });
  try {
    const archive = JSON.parse(await readFile('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
    const book = new ExcelJS.Workbook(); const data = book.addWorksheet('Data');
    data.addRow(['Year', 'Month', 'ID', 'TAMBON_E', 'AMPHOE_E', 'Irrigation_Status', ...Array.from({ length: 6 }, (_, index) => `Pred_Risk_T+${index + 1}`)]);
    archive.locations.forEach((area: { sourceId: number; subdistrictNameTh: string; districtNameTh: string }) =>
      data.addRow([2025, 12, area.sourceId, area.subdistrictNameTh, area.districtNameTh, '', 0, 1, 2, null, 0, 1]));
    data.getCell('A2').value = 2568; data.getCell('G3').value = { formula: '1+1', result: 2 };
    await seedAdminSession(page); await page.goto('/admin?view=upload');
    const upload = (name: string, buffer: Buffer) => page.getByLabel('ไฟล์ข้อมูล', { exact: true }).setInputFiles({ name, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
    await upload('needs-review.xlsx', Buffer.from(await book.xlsx.writeBuffer()));
    await expect(page.getByText('ปีต้นทางไม่ถูกต้อง', { exact: true })).toBeVisible();
    const csvDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV สำหรับแก้ไข', exact: true }).click();
    const csvPath = await (await csvDownload).path();
    expect(await readFile(csvPath!, 'utf8')).toContain('[KTP_REVIEW_REQUIRED] =1+1');
    const reportDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'รายงานปัญหา CSV', exact: true }).click();
    const reportPath = await (await reportDownload).path();
    expect(await readFile(reportPath!, 'utf8')).toContain('ปีต้นทางไม่ถูกต้อง');
    const excelDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Excel พร้อมผลตรวจ', exact: true }).click();
    const excelPath = await (await excelDownload).path();
    const reviewedBytes = await readFile(excelPath!);
    const reviewed = new ExcelJS.Workbook(); await reviewed.xlsx.load(reviewedBytes);
    expect(reviewed.getWorksheet('Data')!.rowCount).toBe(290);
    expect(reviewed.getWorksheet('Data')!.getCell('A1').font.name).toBe('Cordia New');
    expect(reviewed.getWorksheet('_รายงานตรวจ')!.rowCount).toBeGreaterThan(1);
    await mkdir('artifacts/import-repair', { recursive: true });
    await page.locator('.cms-review-downloads').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `artifacts/import-repair/${testInfo.project.name}-reviewed-downloads.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await upload('reviewed-unmodified.xlsx', reviewedBytes);
    await expect(page.getByRole('button', { name: 'ตรวจรายละเอียด', exact: true })).toBeDisabled();
    await expect(page.getByText(/ช่องนี้ยังไม่ได้ยืนยันค่าต้นทางจากไฟล์ที่ตรวจแล้ว/).first()).toBeVisible();
    reviewed.getWorksheet('Data')!.getCell('A2').value = 2025;
    reviewed.getWorksheet('Data')!.getCell('G3').value = 0;
    await upload('reviewed-fixed.xlsx', Buffer.from(await reviewed.xlsx.writeBuffer()));
    await expect(page.getByRole('button', { name: 'ตรวจรายละเอียด', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'ตรวจรายละเอียด', exact: true }).click();
    await expect(page.getByText('ผ่านการตรวจรูปแบบข้อมูล', { exact: true })).toBeVisible();
    expect((await db.operation('list', {})).total).toBe(0);
    await expect(page.getByRole('button', { name: 'CSV สำหรับแก้ไข', exact: true })).toHaveCount(0);
    const canonicalDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Excel พร้อมผลตรวจ', exact: true }).click();
    const canonicalPath = await (await canonicalDownload).path();
    const canonical = new ExcelJS.Workbook(); await canonical.xlsx.load(await readFile(canonicalPath!));
    expect(canonical.getWorksheet('Data')!.rowCount).toBe(1735);
    expect(canonical.getWorksheet('_Metadata')!.getColumn(1).values).toContain('baseDatasetId');
    await page.getByRole('button', { name: 'สร้างฉบับร่าง', exact: true }).click();
    await expect(page).toHaveURL(/draft=/);
    const draft = await db.operation('get', { id: new URL(page.url()).searchParams.get('draft')! });
    expect(draft.state).toBe('draft'); expect(draft.payload.predictions).toHaveLength(1734);
    expect(draft.payload.predictions.filter((row: { riskCode: number | null }) => row.riskCode === null)).toHaveLength(289);
  } finally { await db.close(); }
});

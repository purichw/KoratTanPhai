import { test, expect, seedAdminSession, seedAuthSession } from './fixtures';
import { cmsTestDatabase } from '../tests/fixtures/admin-data.mjs';
import { mkdir, readFile } from 'node:fs/promises';

test('new round import survives close/reopen, publishes after comparison, and offers a recovery draft', async ({ page, context }, testInfo) => {
  test.setTimeout(150000);
  const db = await cmsTestDatabase(context, { forecasts: true, references: true });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await seedAdminSession(page); await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'ความพร้อมข้อมูล', exact: true })).toBeVisible();
    await expect(page.getByText('ช่วงพยากรณ์ไม่ครอบคลุมเดือนนี้', { exact: true })).toBeVisible();
    await mkdir('artifacts/cms-lifecycle', { recursive: true });
    await page.screenshot({ path: `artifacts/cms-lifecycle/${testInfo.project.name}-readiness.png`, fullPage: true });
    await page.getByRole('button', { name: 'สร้างรอบใหม่', exact: true }).click();
    await page.getByLabel('เดือนตั้งต้นรอบใหม่').fill('2026-10');
    await page.screenshot({ path: `artifacts/cms-lifecycle/${testInfo.project.name}-new-round.png` });
    await page.getByRole('button', { name: 'สร้างฉบับร่าง', exact: true }).click();
    await expect(page).toHaveURL(/draft=/);
    const blank = await db.operation('get', { id: new URL(page.url()).searchParams.get('draft')! });
    expect(blank.payload.predictions.every((row: { status: string; riskCode: unknown }) => row.status === 'insufficient_data' && row.riskCode === null)).toBe(true);
    await expect(page.getByRole('button', { name: 'เผยแพร่รุ่นใหม่', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'รายการนำเข้าและฉบับร่าง', exact: true }).click();
    await page.getByRole('button', { name: 'นำเข้าข้อมูล', exact: true }).click();
    const archive = JSON.parse(await readFile('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
    const headers = 'Year,Month,ID,TAMBON_E,AMPHOE_E,Irrigation_Status,Pred_Risk_T+1,Pred_Risk_T+2,Pred_Risk_T+3,Pred_Risk_T+4,Pred_Risk_T+5,Pred_Risk_T+6';
    const bytes = Buffer.from([headers, ...archive.locations.map((area: { sourceId: number }) => `2026,10,${area.sourceId},Area,District,,0,1,2,,0,1`)].join('\n'));
    await page.getByLabel('ไฟล์ข้อมูล', { exact: true }).setInputFiles({ name: 'new-origin.csv', mimeType: 'text/csv', buffer: bytes });
    await expect(page.getByRole('button', { name: 'ตรวจรายละเอียด', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'บันทึกงานค้าง', exact: true }).click();
    await expect(page.getByText('บันทึกงานค้างแล้ว', { exact: true })).toBeVisible();
    const works = await db.operation('work:list', {});
    expect(works).toHaveLength(1); expect(works[0].snapshot_id).toBeTruthy();
    await page.getByRole('button', { name: 'ปิดการนำเข้าข้อมูล', exact: true }).click();
    await expect(page).toHaveURL(/view=imports/);
    await page.reload();
    await expect(page.getByRole('button', { name: 'เปิดงาน new-origin', exact: true })).toBeVisible();
    expect(await page.locator('.cms-import-work .cms-table-scroll').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/cms-lifecycle/${testInfo.project.name}-resume-list.png`, fullPage: true });
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ดาวน์โหลดต้นฉบับ new-origin.csv', exact: true }).click();
    const downloaded = await download;
    expect(await readFile((await downloaded.path())!)).toEqual(bytes);
    await page.getByRole('button', { name: 'เปิดงาน new-origin', exact: true }).click();
    await expect(page.getByRole('button', { name: 'ตรวจรายละเอียด', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'ตรวจรายละเอียด', exact: true }).click();
    await expect(page.getByText('ผ่านการตรวจรูปแบบข้อมูล', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'สร้างฉบับร่าง', exact: true }).click();
    await expect(page).toHaveURL(/draft=/);
    await page.getByRole('button', { name: 'เผยแพร่รุ่นใหม่', exact: true }).click();
    await expect(page.getByText('เพิ่มรอบใหม่ · 1,734 รายการ', { exact: true })).toBeVisible();
    await page.getByLabel('บันทึกการตรวจสอบ').fill('ทดสอบในฐานข้อมูลแยก ไม่ใช่ข้อมูลจริง');
    await page.screenshot({ path: `artifacts/cms-lifecycle/${testInfo.project.name}-publish-review.png` });
    await page.getByRole('button', { name: 'ยืนยันเผยแพร่', exact: true }).click();
    await expect(page.getByText('เผยแพร่พยากรณ์รุ่นใหม่แล้ว', { exact: true })).toBeVisible();
    expect((await db.operation('forecast:catalog', {})).periods).toEqual(['2026-10', '2025-12']);
    await page.goto('/admin');
    await page.getByRole('button', { name: 'ประวัติและกู้คืน', exact: true }).click();
    const recoveryDialog = page.getByRole('dialog', { name: 'กู้คืนจากรุ่นที่เผยแพร่', exact: true });
    await expect(recoveryDialog).toBeVisible();
    await recoveryDialog.getByRole('combobox', { name: /^เดือนตั้งต้น / }).click();
    await page.getByRole('option', { name: /ธันวาคม 2568/ }).click();
    await page.screenshot({ path: `artifacts/cms-lifecycle/${testInfo.project.name}-recovery.png` });
    await page.getByRole('button', { name: 'สร้างฉบับร่างเพื่อกู้คืน', exact: true }).click();
    await expect(page).toHaveURL(/draft=/);
    const recovery = await db.operation('get', { id: new URL(page.url()).searchParams.get('draft')! });
    expect(recovery.state).toBe('draft'); expect(recovery.source_filename).toMatch(/^restored:/);
    if (process.env.PLAYWRIGHT_DATA_BACKEND === 'supabase') {
      await seedAuthSession(page);
      await page.goto('/drought?target=2026-10');
      await expect(page.locator('.app-shell')).toBeVisible();
      await expect(page.locator('.app-startup')).toHaveCount(0);
      await expect(page.getByRole('combobox', { name: /เดือนตั้งต้น/ }).first()).toContainText('ต.ค. 2569');
      await expect(page.locator('.nr-drought-page-header')).toContainText('ผลพยากรณ์ตามรอบข้อมูล');
      await expect(page.getByRole('img', { name: 'แผนที่ตำบลจังหวัดนครราชสีมา', exact: true })).toBeVisible();
      await expect(page.locator('.nr-map-shape')).toHaveCount(289);
      await page.screenshot({ path: `artifacts/cms-lifecycle/${testInfo.project.name}-visitor-new-round.png`, fullPage: true });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await db.close(); }
});

test('autosave failure preserves review and offers a real retry, without claiming saved', async ({ page, context }) => {
  test.setTimeout(90000);
  const db = await cmsTestDatabase(context, { references: true });
  try {
    await seedAdminSession(page); await page.goto('/admin?view=upload');
    await page.getByRole('combobox', { name: /^ประเภทข้อมูล / }).click();
    await page.getByRole('option', { name: 'ข้อมูลสถานีตรวจวัด', exact: true }).click();
    let fail = true;
    await page.route('**/api/admin-data?action=work-save', route => fail ? route.fulfill({ status: 503, json: { error: { code: 'cms_unavailable' } } }) : route.fallback());
    await page.getByLabel('ไฟล์ข้อมูล', { exact: true }).setInputFiles({ name: 'unfinished.csv', mimeType: 'text/csv', buffer: Buffer.from('stationId,value\nS1,wrong') });
    await expect(page.locator('.cms-autosave')).toContainText('เชื่อมต่อ CMS ไม่สำเร็จ');
    await expect(page.getByText('บันทึกงานค้างแล้ว', { exact: true })).toHaveCount(0);
    fail = false;
    await page.getByRole('button', { name: 'บันทึกงานค้าง', exact: true }).click();
    await expect(page.getByText('บันทึกงานค้างแล้ว', { exact: true })).toBeVisible();
    const works = await db.operation('work:list', {}); expect(works).toHaveLength(1); expect(works[0].revision).toBe(1);
  } finally { await db.close(); }
});

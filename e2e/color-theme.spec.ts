import { test, expect, seedAuthSession } from './fixtures';
import { readFileSync } from 'node:fs';
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';

test('the branded startup is painted before JavaScript, on Visitor and Admin entry', async ({ browser, baseURL }, info) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: info.project.use.viewport });
  const page = await context.newPage();
  try {
    for (const path of ['/', '/admin']) {
      await page.goto(`${baseURL}${path}`);
      await expect(page.locator('.app-startup')).toHaveCSS('background-color', 'rgb(238, 244, 252)');
      await expect(page.locator('.app-startup')).toHaveCSS('color', 'rgb(15, 46, 94)');
      await expect(page.locator('.app-startup img')).toBeVisible();
    }
  } finally { await context.close(); }
});

test('navy UI keeps categorical map paint, hatching, keyboard focus and filter meaning', async ({ page }, info) => {
  const archive = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
  await page.route('https://ktp-auth-test.supabase.co/rest/v1/rpc/ktp_load_forecast_slice', route =>
    route.fulfill({ json: forecastSlice(archive, route.request().postDataJSON()) }));
  await seedAuthSession(page);
  await page.goto('/drought?mapLayer=forecast-archive&target=2025-12&horizon=4');
  await expect(page.locator('.nr-map-shape')).toHaveCount(289);
  await expect(page.locator('.app-shell')).toBeVisible();
  const expected = { 'no-risk': 'rgb(93, 174, 121)', moderate: 'rgb(246, 174, 45)', high: 'rgb(217, 93, 89)' };
  for (const [risk, color] of Object.entries(expected)) {
    await expect(page.locator(`.nr-map-shape.is-forecast-${risk}`).first()).toHaveCSS('fill', color);
    await expect(page.locator(`.nr-map-legend .is-forecast-${risk}`)).toHaveCSS('background-color', color);
  }
  await expect(page.locator('.nr-map-svg pattern rect')).toHaveCSS('fill', 'rgb(203, 213, 225)');
  await expect(page.locator('.nr-map-svg pattern path')).toHaveCSS('stroke', 'rgb(149, 164, 181)');
  await expect(page.locator('.nr-map-legend .is-forecast-out-of-scope')).toHaveCSS('background-image', /repeating-linear-gradient/);
  await expect(page.locator('.nr-map-shape.is-forecast-out-of-scope').first()).toHaveCSS('fill', /url\(/);
  await expect(page.locator('.nr-drought-workspace-kpis')).toContainText('1 ตำบล');
  const select = page.getByRole('combobox', { name: 'สถานะพยากรณ์ภัยแล้ง', exact: true });
  await select.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('option', { name: 'เสี่ยงสูง', exact: true }).click();
  await expect(select).toBeFocused();
  await expect(page.locator('.nr-map-shape.in-focus:not(.is-criteria-filtered):not(.is-forecast-high)')).toHaveCount(0);
  await page.locator('.nr-local-map-reset').click();
  await expect(page.locator('.nr-map-shape:not(.is-criteria-filtered)')).toHaveCount(289);
  await page.getByRole('button', { name: 'วิเคราะห์พยากรณ์', exact: true }).click();
  await expect(page.locator('.nr-analysis-table')).toBeVisible();
  await page.getByRole('combobox', { name: 'อำเภอในตารางวิเคราะห์', exact: true }).click();
  const search = page.getByRole('searchbox', { name: /^ค้นหาตัวเลือก อำเภอในตาราง/ });
  await search.fill('พิมาย');
  await expect(page.getByRole('option', { name: 'พิมาย', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('navy-searchable-filter.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'วิเคราะห์พยากรณ์', exact: true })).toBeFocused();
  const menu = page.getByRole('button', { name: 'เปิดเมนูหลัก', exact: true });
  if (await menu.isVisible()) await menu.click();
  await expect(page.locator('.sidebar-account .account-trigger-copy small')).toBeVisible();
  await expect(page.locator('.sidebar-account .account-trigger-copy small')).toHaveCSS('color', 'rgb(205, 223, 248)');
});

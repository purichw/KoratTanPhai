import { test, expect, seedAuthSession, seedAdminSession } from './fixtures';
import { cmsTestDatabase } from '../tests/fixtures/admin-data.mjs';
import { readFile } from 'node:fs/promises';
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';

test.skip(process.env.PLAYWRIGHT_REFERENCE_BACKEND !== 'cms', 'Requires the dedicated CMS build and database fixture');

test('Visitor starts pinned geometry while the forecast is still pending', async ({ page, context }, testInfo) => {
  test.setTimeout(90000);
  const database = await cmsTestDatabase(context, { references: true });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const geometryReads: string[] = [];
  let forecastStarted = false;
  page.on('request', request => {
    if (request.url().includes('ktp_cms_reference_read')) geometryReads.push(request.postDataJSON().p_id);
  });
  try {
    const overview = JSON.parse(await readFile('src/data/generated/forecast-overview-t1.json', 'utf8'));
    await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', async route => {
      forecastStarted = true;
      await held;
      await route.fulfill({ json: forecastSlice(overview, route.request().postDataJSON()) });
    });
    await seedAuthSession(page); await page.goto('/');
    await expect.poll(() => forecastStarted).toBe(true);
    await expect.poll(() => geometryReads.length).toBe(3);
    await expect(page.locator('.app-startup')).toBeVisible();
    release();
    await expect(page.locator('.nr-map-shape')).toHaveCount(289);
    await expect(page.locator('.app-startup')).toHaveCount(0);
    expect(new Set(geometryReads).size).toBe(3);
    expect(geometryReads).toHaveLength(3);
    await page.screenshot({ path: testInfo.outputPath('parallel-visitor-ready.png') });
  } finally { release(); await database.close(); }
});

test('Admin starts both catalogs before the draft list finishes and does not preload Visitor geometry', async ({ page, context }, testInfo) => {
  test.setTimeout(90000);
  const database = await cmsTestDatabase(context, { forecasts: true, references: true });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const actions: string[] = []; const geometry: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/api/admin-data') actions.push(url.searchParams.get('action')!);
    if (url.pathname.endsWith('/ktp_cms_reference_read')) geometry.push(url.pathname);
  });
  await page.route('**/api/admin-data?**', async route => {
    if (new URL(route.request().url()).searchParams.get('action') === 'list') await held;
    await route.fallback();
  });
  try {
    await seedAdminSession(page); await page.goto('/admin');
    await expect.poll(() => actions.includes('list')).toBe(true);
    await expect.poll(() => actions.includes('forecast-catalog') && actions.includes('resource-catalog')).toBe(true);
    await expect(page.locator('.app-startup')).toBeVisible();
    release();
    await expect(page.locator('.app-startup')).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'ความพร้อมรอบล่าสุด', exact: true })).toContainText('1,734 / 1,734');
    await expect(page.locator('.cms-resource-group')).toHaveCount(2);
    expect(actions.filter(action => action === 'list')).toHaveLength(1);
    expect(actions.filter(action => action === 'forecast-catalog')).toHaveLength(1);
    expect(actions.filter(action => action === 'resource-catalog')).toHaveLength(1);
    expect(geometry).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('parallel-admin-ready.png') });
  } finally { release(); await database.close(); }
});

test('Admin and public workspaces read only the active CMS geography without creating reference drafts', async ({ page, context }, testInfo) => {
  test.setTimeout(120000);
  const database = await cmsTestDatabase(context, { references: true });
  const errors: string[] = []; const reads: string[] = []; const mutations: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('ktp_cms_reference_bundle')) reads.push(request.postData() ?? ''); });
  page.on('request', request => { if (/action=resource-(clone|edit|publish)/.test(request.url())) mutations.push(request.url()); });
  try {
    const archive = JSON.parse(await readFile('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
    const overview = JSON.parse(await readFile('src/data/generated/forecast-overview-t1.json', 'utf8'));
    await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', route => {
      const query = route.request().postDataJSON();
      return route.fulfill({ json: forecastSlice(query.p_horizon_count === 1 ? overview : archive, query) });
    });
    await seedAdminSession(page); await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'ข้อมูลประกอบเว็บไซต์', exact: true })).toBeVisible();
    expect(reads).toHaveLength(1); expect(JSON.parse(reads[0]).p_ids).toHaveLength(2);
    await expect(page.locator('.cms-resource-group')).toHaveCount(2);
    await expect(page.locator('.cms-reference')).not.toContainText('แหล่งข้อมูลอ้างอิง');
    await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('ข้อมูลพื้นที่');
    await page.getByRole('button', { name: 'เปิดข้อมูล', exact: true }).click();
    await expect(page).toHaveURL(/resource=/);
    await expect(page.getByRole('heading', { name: 'ข้อมูลพื้นที่', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ในเมือง', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'สร้างฉบับแก้ไข', exact: true })).toHaveCount(0);
    const id = new URL(page.url()).searchParams.get('resource')!;
    const original = await database.operation('resource:get', { id });
    expect(original.resource_key).toBe('canonical/nakhon_ratchasima/admin_hierarchy');
    await page.getByRole('button', { name: 'ดูรายละเอียด ในเมือง 300101', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'ตำบลในเมือง', exact: true })).toContainText('ในเมือง');
    await page.getByRole('button', { name: 'ปิดรายละเอียดพื้นที่', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'ข้อมูลพื้นที่', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ในเมือง', exact: true })).toBeVisible();
    expect((await database.operation('resource:get', { id })).payload).toEqual(original.payload);
    expect(mutations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('active-cms-reference-details.png'), fullPage: true });
    await seedAuthSession(page);
    const bundleReady = page.waitForResponse(response => response.url().includes('ktp_cms_reference_bundle') && response.ok());
    await page.goto('/');
    const bundle = await (await bundleReady).json();
    expect(Object.keys(bundle).sort()).toEqual(['canonical/nakhon_ratchasima/admin_hierarchy', 'generated/forecast-archive-summary']);
    expect(bundle['canonical/nakhon_ratchasima/admin_hierarchy']).toEqual(original.payload);
    await expect(page.locator('.nr-map-panel .nr-map-shape').first()).toBeVisible({ timeout: 30000 });
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally { await database.close(); }
});

test('Admin opens the known boundary counterpart while the selected area register is pending', async ({ page, context }, testInfo) => {
  test.setTimeout(90000);
  const database = await cmsTestDatabase(context, { references: true });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const reads: string[] = [];
  try {
    const catalog = await database.operation('resource:catalog', {});
    const names = catalog.find((row: { resource_key: string }) => row.resource_key === 'canonical/nakhon_ratchasima/admin_hierarchy');
    const boundaries = catalog.find((row: { resource_key: string }) => row.resource_key === 'geodata/nakhon-ratchasima-subdistricts');
    await seedAdminSession(page); await page.goto('/admin');
    await expect(page.locator('.app-startup')).toHaveCount(0);
    await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('ข้อมูลพื้นที่');
    await page.route('**/api/admin-data?**', async route => {
      if (new URL(route.request().url()).searchParams.get('action') === 'resource-get') {
        const id = route.request().postDataJSON().id;
        reads.push(id);
        if (id === names.id) await held;
      }
      await route.fallback();
    });
    await page.getByRole('button', { name: 'เปิดข้อมูล', exact: true }).click();
    await expect.poll(() => reads.includes(names.id)).toBe(true);
    await expect.poll(() => reads.includes(boundaries.id)).toBe(true);
    await expect(page.locator('.app-startup')).toBeVisible();
    release();
    await expect(page.locator('.cms-area-workspace')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('cell', { name: 'ในเมือง', exact: true })).toBeVisible();
    expect(reads.filter(id => id === names.id)).toHaveLength(1);
    expect(reads.filter(id => id === boundaries.id)).toHaveLength(1);
    await page.getByRole('button', { name: 'แผนที่', exact: true }).click();
    await expect(page.locator('.cms-area-map-canvas > svg > g > path')).toHaveCount(289);
    await page.screenshot({ path: testInfo.outputPath('parallel-admin-area-map.png') });
  } finally { release(); await database.close(); }
});

test('map geometry comes from the pinned CMS revision and zoom behavior is preserved', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Shared loader integration is covered once; responsive editing is covered separately');
  test.setTimeout(120000);
  const database = await cmsTestDatabase(context, { references: true });
  const staticGeometry: string[] = [];
  const geometryReads: string[] = [];
  try {
    const archive = JSON.parse(await readFile('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
    const overview = JSON.parse(await readFile('src/data/generated/forecast-overview-t1.json', 'utf8'));
    await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', route => {
      const query = route.request().postDataJSON();
      return route.fulfill({ json: forecastSlice(query.p_horizon_count === 1 ? overview : archive, query) });
    });
    page.on('request', request => {
      if (new URL(request.url()).pathname.startsWith('/geodata/')) staticGeometry.push(request.url());
      if (request.url().includes('ktp_cms_reference_read')) geometryReads.push(request.postData() ?? '');
    });
    await seedAuthSession(page); await page.goto('/soeng-sang?mapLayer=forecast-archive&target=2025-12&horizon=1');
    const map = page.locator('.nr-map-panel');
    await expect(map.locator('.nr-map-shape').first()).toBeVisible({ timeout: 30000 });
    const layer = map.locator('.nr-map-transform-layer');
    const initial = await layer.getAttribute('transform');
    await map.getByTitle('ขยายแผนที่', { exact: true }).click();
    await expect(layer).not.toHaveAttribute('transform', initial!);
    expect(geometryReads.length).toBeGreaterThanOrEqual(1); expect(staticGeometry).toEqual([]);
    await page.screenshot({ path: 'artifacts/admin-cms-20260927/cms-map.png', fullPage: true });
  } finally { await database.close(); }
});

test('incomplete CMS migration fails closed without serving bundled references', async ({ page, context }) => {
  test.setTimeout(60000);
  await context.route('https://ktp-auth-test.supabase.co/rest/v1/rpc/ktp_cms_reference_catalog', route => route.fulfill({ json: [] }));
  await seedAdminSession(page); await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'ไม่สามารถแสดงหน้านี้ได้', exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'จัดการข้อมูล', exact: true })).toHaveCount(0);
});

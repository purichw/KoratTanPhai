import { readFileSync } from 'node:fs';
import { test, expect, seedAuthSession, type Page } from './fixtures';
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';

const overview = JSON.parse(readFileSync('src/data/generated/forecast-overview-t1.json', 'utf8'));
const archive = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));

async function camera(page: Page) {
  return page.locator('.nr-map-transform-layer').evaluate(element => {
    const matrix = (element as unknown as SVGGraphicsElement).transform.baseVal.consolidate()!.matrix;
    return { x: matrix.e, y: matrix.f, k: matrix.a };
  });
}

async function waitForPageScrollToSettle(page: Page) {
  let previous = Number.NaN;
  let stableSamples = 0;
  await expect.poll(async () => {
    const current = await page.evaluate(() => scrollY);
    stableSamples = current === previous ? stableSamples + 1 : 0;
    previous = current;
    return stableSamples;
  }, { intervals: [100] }).toBeGreaterThanOrEqual(3);
}

async function mapPoint(page: Page) {
  const svg = page.locator('.nr-map-svg');
  await svg.evaluate(element => window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - 150, behavior: 'instant' }));
  await waitForPageScrollToSettle(page);
  return svg.evaluate(element => {
    const box = element.getBoundingClientRect();
    for (const xr of [.5, .4, .6, .3, .7]) for (const yr of [.5, .4, .6, .3, .7, .2, .8]) {
      const x = box.x + box.width * xr, y = box.y + box.height * yr;
      if (document.elementFromPoint(x, y)?.closest('.nr-map-shape')) return { x, y };
    }
    throw new Error('No reachable polygon for touch gesture');
  });
}

for (const route of ['/', '/drought', '/soeng-sang', '/phimai/t-301503']) {
  test(`One-finger horizontal pan preserves page scroll and tap: ${route}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'Real CDP touch input requires the Chromium mobile project.');
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await seedAuthSession(page);
    await page.route('**/rest/v1/rpc/ktp_load_forecast_slice', route => {
      const query = route.request().postDataJSON();
      return route.fulfill({ json: forecastSlice(query.p_horizon_count === 1 ? overview : archive, query) });
    });
    await page.goto(`${route}?mapLayer=forecast-archive&target=2025-12&horizon=1`);
    await expect(page.locator('.nr-map-shape').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const panel = page.locator('.nr-map-panel');
    await panel.getByTitle('ขยายแผนที่', { exact: true }).tap();
    await panel.getByTitle('ขยายแผนที่', { exact: true }).tap();
    let previous = '';
    await expect.poll(async () => {
      const current = JSON.stringify(await camera(page));
      const settled = current === previous;
      previous = current;
      return settled;
    }, { intervals: [100] }).toBe(true);
    const touch = await page.context().newCDPSession(page);
    const swipe = async (point: { x: number; y: number }, dx: number, dy: number) => {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 0 }] });
      // No long-press wait: the first move must claim horizontal intent immediately.
      for (let step = 1; step <= 4; step++) {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + dx * step / 4, y: point.y + dy * step / 4, id: 0 }] });
      }
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    for (const dx of [-64, 64]) {
      const point = await mapPoint(page);
      const before = await camera(page);
      const scroll = await page.evaluate(() => scrollY);
      await swipe(point, dx, 4);
      await expect.poll(async () => ((await camera(page)).x - before.x) * Math.sign(dx)).toBeGreaterThan(10);
      expect((await camera(page)).k).toBe(before.k);
      expect(await page.evaluate(() => scrollY)).toBe(scroll);
      await expect(panel.getByRole('dialog')).toHaveCount(0);
    }
    await page.screenshot({ path: info.outputPath('mobile-horizontal-pan.png'), scale: 'css' });

    const point = await mapPoint(page);
    const beforeScroll = await camera(page);
    const scroll = await page.evaluate(() => scrollY);
    // Compact pages may already be at the bottom; scroll back toward the top.
    await swipe(point, 3, 100);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(scroll - 15);
    expect(await camera(page)).toEqual(beforeScroll);
    await expect(panel).not.toHaveClass(/is-dragging/);

    // Native momentum can keep moving the hit target after touchEnd on CI.
    await waitForPageScrollToSettle(page);
    // A browser-cancelled vertical scroll must not swallow the next ordinary tap.
    const tapPoint = await mapPoint(page);
    await page.touchscreen.tap(tapPoint.x, tapPoint.y);
    await expect(panel.getByRole('dialog', { name: /ข้อมูลย่อพื้นที่/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await touch.detach();
  });
}

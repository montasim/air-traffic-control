import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined), args: ['--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
// Canvas rendering keeps headless timing representative on hosts without a GPU.
await page.addInitScript(() => {
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    if (type.includes('webgl')) return null;
    return getContext.call(this, type, ...args);
  };
});
await mkdir('test-results', { recursive: true });
const more = async () => {
  if (!await page.locator('#pause-panel .menu-more').evaluate(el => el.open)) await page.locator('#pause-panel .menu-more summary').click();
};
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const snapshot = () => page.evaluate(async () => {
  // Reuse the exact Vite module URL, including its HMR timestamp.
  const url = performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === '/src/main.ts')?.name;
  if (!url) throw new Error('Game module was not loaded');
  return (await import(url)).inspectShift();
});
const resize = async (width, height) => {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(250);
};
try {
  await page.goto(process.env.RESIZE_TEST_URL || 'http://127.0.0.1:4287/');
  await expect(page.locator('#start-button')).toBeEnabled();
  await page.locator('#start-button').click();
  await expect(page.locator('#pause-button')).toBeEnabled();
  await expect.poll(async () => {
    const s = await snapshot();
    const p = s.simulation?.aircraft[0]?.position;
    return p && p.x > 80 && p.y > 100 && p.x < s.world.width - 80 && p.y < s.world.height - 100;
  }, { timeout: 15000 }).toBeTruthy();
  console.log('Aircraft ready');
  const initial = await snapshot();
  assert.ok(initial.simulation.aircraft.length);
  const canvas = await page.locator('#game canvas').boundingBox();
  const plane = initial.simulation.aircraft[0];
  const screenPoint = p => ({ x: canvas.x + p.x / initial.world.width * canvas.width, y: canvas.y + p.y / initial.world.height * canvas.height });
  const from = screenPoint(plane.position);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width * .4, canvas.y + canvas.height * .5, { steps: 20 });
  await page.mouse.up();
  await page.locator('#pause-button').click();
  console.log('Route drawn');
  const before = await snapshot();
  assert.ok(before.simulation.aircraft.some(p => p.route?.points.length > 0), 'A route must be committed through actual pointer input');
  await resize(800, 1000);
  await expect(page.locator('#resume-button')).toBeEnabled();
  assert.deepEqual(await snapshot(), before);
  await page.screenshot({ path: 'test-results/resize-paused.png' });
  await page.waitForTimeout(1000);
  assert.deepEqual(await snapshot(), before);
  // A resize dispatched during async audio unlock must prevent resume.
  await page.evaluate(() => {
    document.querySelector('#resume-button').click();
    window.dispatchEvent(new Event('resize'));
  });
  assert.equal((await snapshot()).simulation.phase, 'paused');
  await expect(page.locator('#resume-button')).toBeEnabled();
  await page.locator('#resume-button').click();
  await expect(page.locator('#pause-panel')).toBeHidden();
  const fitted = await page.locator('#game canvas').boundingBox();
  const shifted = await snapshot();
  const aircraft = shifted.simulation.aircraft[0];
  const x = fitted.x + aircraft.position.x / shifted.world.width * fitted.width;
  const y = fitted.y + aircraft.position.y / shifted.world.height * fitted.height;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(fitted.x + fitted.width * .35, fitted.y + fitted.height * .6, { steps: 12 });
  await page.mouse.up();
  const routed = await snapshot();
  const points = routed.simulation.aircraft[0].route.points;
  const end = points.at(-1);
  assert.ok(Math.abs(end.x - shifted.world.width * .35) < 10 && Math.abs(end.y - shifted.world.height * .6) < 10, 'Route input stays aligned after letterboxing');
  // Interrupt a replacement stroke; the previously committed route survives.
  const latest = routed.simulation.aircraft[0];
  await page.mouse.move(fitted.x + latest.position.x / shifted.world.width * fitted.width, fitted.y + latest.position.y / shifted.world.height * fitted.height);
  await page.mouse.down();
  await page.mouse.move(fitted.x + fitted.width * .6, fitted.y + fitted.height * .7, { steps: 3 });
  await resize(1280, 800);
  await page.mouse.up();
  await expect(page.locator('#pause-panel')).toBeVisible();
  assert.deepEqual((await snapshot()).simulation.aircraft[0].route.points, points);
  const after = await snapshot();
  assert.equal(after.runId, before.runId);
  assert.deepEqual(after.world, before.world);
  assert.equal(after.orientation, before.orientation);
  assert.deepEqual(after.evidence, before.evidence);
  assert.equal(after.simulation.score, before.simulation.score);
  assert.ok(after.simulation.elapsed >= before.simulation.elapsed);
  await resize(320, 600);
  await expect(page.locator('#resume-button')).toBeDisabled();
  await page.screenshot({ path: 'test-results/resize-too-small.png' });
  await page.keyboard.press('Escape');
  assert.equal((await snapshot()).simulation.phase, 'paused');
  await resize(1280, 800);
  await expect(page.locator('#resume-button')).toBeEnabled();
  await more();
  await page.locator('#pause-panel [data-screen="settings"]').click();
  await resize(800, 1000);
  await expect(page.locator('#utility-screen')).toBeVisible();
  assert.equal((await snapshot()).simulation.phase, 'paused');
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-panel')).toBeVisible();
  await more();
  await page.locator('#restart-from-pause').click();
  await resize(1280, 800);
  await expect(page.locator('#confirm-dialog')).toBeVisible();
  assert.equal((await snapshot()).runId, before.runId);
  await page.locator('#confirm-cancel').click();
  await page.locator('#resume-button').click();
  // Small changes continue, cumulative substantial changes pause.
  await resize(1200, 800);
  assert.equal((await snapshot()).simulation.phase, 'running');
  await resize(1024, 800);
  assert.equal((await snapshot()).simulation.phase, 'paused');
  assert.equal((await snapshot()).runId, before.runId);
  await resize(800, 1000);
  await more();
  await page.locator('#restart-from-pause').click();
  await page.locator('#confirm-accept').click();
  await expect(page.locator('#pause-panel')).toBeHidden();
  await page.waitForTimeout(300);
  const fresh = await snapshot();
  assert.notEqual(fresh.runId, before.runId);
  assert.equal(fresh.orientation, 'portrait');
  assert.ok(fresh.world.height > fresh.world.width);
  // Start a genuinely phone-sized world, then verify conservative recovery.
  await resize(390, 844);
  await more();
  await page.locator('#restart-from-pause').click();
  await page.locator('#confirm-accept').click();
  await expect(page.locator('#pause-panel')).toBeHidden();
  await resize(390, 780); // Browser chrome alone must not pause the shift.
  assert.equal((await snapshot()).simulation.phase, 'running');
  await page.locator('#pause-button').click();
  const phone = await snapshot();
  await resize(844, 390);
  await expect(page.locator('#resume-button')).toBeDisabled();
  assert.deepEqual(await snapshot(), phone);
  await page.screenshot({ path: 'test-results/resize-phone-landscape.png' });
  await resize(390, 844);
  await expect(page.locator('#resume-button')).toBeEnabled();
  await page.keyboard.press('Escape');
  assert.equal((await snapshot()).simulation.phase, 'running');
  assert.deepEqual(errors, []);
  console.log('Resize browser regression passed: routed aircraft continuity, frozen time, manual resume, orientation, tiny viewport, keyboard guard, utility/dialog preservation, cumulative resizing, and fresh-shift layout.');
} finally {
  await browser.close();
}

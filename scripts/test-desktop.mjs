import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron as electron, expect } from '@playwright/test';

const profile = await mkdtemp(path.join(tmpdir(), 'air-control-smoke-'));
let app;
const errors = [];
try {
  const options = {
    args: ['.'],
    ...(process.env.ELECTRON_EXECUTABLE
      ? { executablePath: path.resolve(process.env.ELECTRON_EXECUTABLE) }
      : {}),
    env: { ...process.env, SNAP_USER_COMMON: profile }
  };
  app = await electron.launch(options);
  let page = await app.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  await expect(page.locator('#app')).not.toHaveAttribute('inert', '', { timeout: 30000 });
  await expect(page.locator('#start-panel')).toBeVisible();
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/desktop-home.png' });
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  const assets = await page.evaluate(async () => {
    const responses = await Promise.all([
      fetch('/assets/arcade/meadow.webp'),
      fetch('/fonts/AtkinsonHyperlegible-Regular.woff2')
    ]);
    return responses.map((response) => response.status);
  });
  assert.deepEqual(assets, [200, 200]);
  await page.locator('input[name="difficulty"][value="easy"]').check();
  await expect(page.locator('#two-end-landing')).not.toBeChecked();
  await page.locator('#two-end-landing').check();
  await expect(page.locator('#start-button')).toBeEnabled();
  await page.locator('#start-button').click();
  await expect(page.locator('#pause-button')).toBeEnabled();
  await expect(page.locator('#game canvas')).toBeVisible();
  await page.locator('#pause-button').click();
  await expect(page.locator('#pause-panel')).toBeVisible();
  const worldBeforeResize = await page.locator('#game canvas').evaluate(canvas => [canvas.width, canvas.height]);
  const scoreBeforeResize = await page.locator('#score').textContent();
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    const [width, height] = window.getSize();
    window.setSize(width, height - 64);
  });
  await expect(page.locator('#resume-button')).toHaveText('Resume');
  await page.locator('#resume-button').click();
  await expect(page.locator('#pause-panel')).not.toBeVisible();
  await expect(page.locator('#confirm-dialog')).not.toBeVisible();
  assert.deepEqual(await page.locator('#game canvas').evaluate(canvas => [canvas.width, canvas.height]), worldBeforeResize);
  assert.equal(await page.locator('#score').textContent(), scoreBeforeResize);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(700, 1000));
  await expect(page.locator('#pause-panel')).toBeVisible();
  await expect(page.locator('#resume-button')).toBeEnabled();
  assert.deepEqual(await page.locator('#game canvas').evaluate(canvas => [canvas.width, canvas.height]), worldBeforeResize);
  assert.equal(await page.locator('#score').textContent(), scoreBeforeResize);
  await page.locator('#resume-button').click();
  await expect(page.locator('#pause-panel')).not.toBeVisible();
  await expect(page.locator('#confirm-dialog')).not.toBeVisible();
  await app.close();
  app = await electron.launch(options);
  page = await app.firstWindow();
  await expect(page.locator('#app')).not.toHaveAttribute('inert', '', { timeout: 30000 });
  await expect(page.locator('input[name="difficulty"][value="easy"]')).toBeChecked();
  await expect(page.locator('#two-end-landing')).toBeChecked();
  assert.deepEqual(errors, []);
  console.log('Desktop smoke passed: boot, assets, renderer isolation, gameplay, resize/resume with stable world and score, and saved settings across restart.');
} finally {
  await app?.close();
  await rm(profile, { recursive: true, force: true });
}

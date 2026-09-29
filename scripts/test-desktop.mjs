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
  await page.locator('#start-button').click();
  await expect(page.locator('#pause-button')).toBeEnabled();
  await expect(page.locator('#game canvas')).toBeVisible();
  await page.locator('#pause-button').click();
  await expect(page.locator('#pause-panel')).toBeVisible();
  await app.close();
  app = await electron.launch(options);
  page = await app.firstWindow();
  await expect(page.locator('#app')).not.toHaveAttribute('inert', '', { timeout: 30000 });
  await expect(page.locator('input[name="difficulty"][value="easy"]')).toBeChecked();
  assert.deepEqual(errors, []);
  console.log('Desktop smoke passed: boot, assets, renderer isolation, gameplay, pause, and saved settings across restart.');
} finally {
  await app?.close();
  await rm(profile, { recursive: true, force: true });
}

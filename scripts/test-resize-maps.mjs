import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined), args: ['--disable-gpu'] });
const page = await browser.newPage();
await page.addInitScript(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    return type.includes('webgl') ? null : original.call(this, type, ...args);
  };
});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const snapshot = () => page.evaluate(async () => {
  const url = performance.getEntriesByType('resource').find(e => new URL(e.name).pathname === '/src/main.ts').name;
  return (await import(url)).inspectShift();
});
await mkdir('test-results/resize-maps', { recursive: true });
try {
  await page.goto(process.env.RESIZE_TEST_URL || 'http://127.0.0.1:4287/');
  const maps = await page.evaluate(async () => (await import('/src/game/maps/mapIds.ts')).MAP_IDS);
  for (const map of maps) {
    for (const portrait of [false, true]) {
      const start = portrait ? { width: 800, height: 1000 } : { width: 1280, height: 800 };
      const end = portrait ? { width: 1280, height: 800 } : { width: 800, height: 1000 };
      await page.setViewportSize(start);
      // This disposable browser profile contains only test fixtures, never user saves.
      await page.evaluate(async mapId => {
        const { createDefaultGameSave } = await import('/src/storage/gameSave.ts');
        const { IndexedDbSavePersistence } = await import('/src/storage/persistence.ts');
        const save = createDefaultGameSave();
        save.selectedMapId = mapId;
        save.career.earnedRankId = save.career.acknowledgedRankId = 'chief-controller';
        await new IndexedDbSavePersistence().write(save);
      }, map);
      await page.reload();
      await expect(page.locator('#start-button')).toBeEnabled();
      await page.locator('#start-button').click();
      await page.locator('#pause-button').click();
      const before = await snapshot();
      await page.setViewportSize(end);
      await expect(page.locator('#resume-button')).toBeEnabled();
      assert.deepEqual(await snapshot(), before);
      await page.locator('#resume-button').click();
      await expect(page.locator('#pause-panel')).toBeHidden();
      const box = await page.locator('#game canvas').boundingBox();
      assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= end.width + 1 && box.y + box.height <= end.height + 1);
      assert.ok(Math.abs(box.width / box.height - before.world.width / before.world.height) < .01);
      await page.screenshot({ path: `test-results/resize-maps/${map}-${portrait ? 'portrait' : 'landscape'}-start.png` });
      console.log(`${map}: ${portrait ? 'portrait' : 'landscape'} shift fitted and resumed`);
    }
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }

import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined), args: ['--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type.includes('webgl') ? null : original.call(this, type, ...args); };
});
const baseUrl = process.env.LIVERY_TEST_URL || 'http://localhost:4287/';
const ready = () => expect(page.locator('#start-button')).toBeEnabled();
const career = () => page.locator('#start-panel [data-screen="career"]').click();
try {
  await mkdir('.impeccable/review/liveries', { recursive: true });
  await page.goto(baseUrl);
  await ready();
  await career();
  await expect(page.getByRole('radio', { name: 'Classic Available' })).toBeChecked();
  await expect(page.locator('input[value="signal"]')).toBeDisabled();
  await expect(page.locator('input[value="midnight"]')).toBeDisabled();
  await page.evaluate(async () => {
    const { createDefaultGameSave } = await import('/src/storage/gameSave.ts');
    const { IndexedDbSavePersistence } = await import('/src/storage/persistence.ts');
    const save = createDefaultGameSave();
    await new IndexedDbSavePersistence().write({ ...save, career: { ...save.career, earnedRankId: 'senior-controller', acknowledgedRankId: 'senior-controller' } });
  });
  await page.goto(baseUrl);
  await ready();
  await career();
  await page.locator('input[value="signal"]').check();
  await expect(page.getByRole('status').filter({ hasText: 'Signal selected' })).toBeVisible();
  await page.locator('input[value="signal"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('input[value="midnight"]')).toBeChecked();
  await expect(page.locator('.livery-status')).toHaveText('Midnight selected for your next flight.');
  await page.locator('.career-liveries').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.impeccable/review/liveries/desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.career-liveries').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.impeccable/review/liveries/mobile.png' });
  assert.equal(await page.locator('.livery-options').evaluate(el => el.scrollWidth <= el.clientWidth), true);
  await page.reload();
  await expect(page.locator('input[value="midnight"]')).toBeChecked();
  await page.locator('#utility-close').click();
  await ready();
  await page.locator('#start-button').click();
  await expect(page.locator('#start-panel')).toBeHidden();
  await page.waitForTimeout(4500);
  await page.locator('#pause-button').click();
  await page.screenshot({ path: '.impeccable/review/liveries/flight.png' });
  // Compare the actual Phaser renderer at gameplay size, including every aircraft class.
  for (const [name, width] of [['desktop', 1100], ['mobile', 390]]) {
    await page.setViewportSize({ width, height: width < 500 ? 1080 : 620 });
    await page.evaluate(async width => {
      document.querySelector('#livery-comparison')?.remove();
      const host = document.createElement('div');
      host.id = 'livery-comparison';
      host.style.cssText = 'position:fixed;inset:0;z-index:1000;background:#203d39';
      document.body.append(host);
      const { default: Phaser } = await import('/node_modules/phaser/dist/phaser.esm.js');
      const { createAircraftView } = await import('/src/game/rendering/AircraftView.ts');
      const { AIRCRAFT_SILHOUETTES, AIRCRAFT_TARGET_CSS_MAJOR_AXIS, AIRCRAFT_MOBILE_CSS_MAJOR_AXIS } = await import('/src/game/rendering/aircraft/visualTokens.ts');
      const { BLUE_WATER_PALETTE } = await import('/src/game/maps/blue-water/renderer.ts');
      const { FROST_CROSSING_PALETTE } = await import('/src/game/maps/frost-crossing/renderer.ts');
      const mobile = width < 500;
      const tileWidth = mobile ? width : width / 2;
      await new Promise(resolve => {
        new Phaser.Game({ type: Phaser.CANVAS, parent: host, width, height: mobile ? 1080 : 620, banner: false,
          scene: { create() {
            this.add.text(16, 12, `Actual flight size · ${mobile ? 'mobile' : 'desktop'}`, { fontFamily: 'Atkinson Hyperlegible', fontSize: '18px', color: '#fff5df' });
            const surfaces = [['Grass', 0x819667], ['Dark water', BLUE_WATER_PALETTE.terrainDark], ['Asphalt', BLUE_WATER_PALETTE.asphalt], ['Snow', FROST_CROSSING_PALETTE.terrainLight]];
            surfaces.forEach(([label, color], tile) => {
              const x = mobile ? 0 : (tile % 2) * tileWidth;
              const y = 50 + (mobile ? tile : Math.floor(tile / 2)) * 250;
              this.add.rectangle(x + tileWidth / 2, y + 120, tileWidth - 12, 240, color);
              this.add.text(x + 12, y + 4, label, { fontFamily: 'Atkinson Hyperlegible', fontSize: '14px', color: '#fff5df', backgroundColor: '#203d39', padding: { x: 4, y: 2 } });
              ['classic', 'signal', 'midnight'].forEach((livery, column) => {
                const cx = x + (column + .5) * tileWidth / 3;
                this.add.text(cx, y + 36, livery, { fontFamily: 'Atkinson Hyperlegible', fontSize: '14px', color: '#fff5df', backgroundColor: '#203d39', padding: { x: 3, y: 2 } }).setOrigin(.5);
                ['liner', 'commuter', 'rotor'].forEach((type, row) => {
                  const aircraft = { id: row + 1, type, position: { x: cx, y: y + 80 + row * 60 }, heading: -.35, state: 'flying', landingProgress: 0 };
                  createAircraftView(this, aircraft, { livery, reducedMotion: true, presentationScale: (mobile ? AIRCRAFT_MOBILE_CSS_MAJOR_AXIS : AIRCRAFT_TARGET_CSS_MAJOR_AXIS)[type] / AIRCRAFT_SILHOUETTES[type].majorAxis });
                });
              });
            });
            this.game.events.once('postrender', resolve);
          } }
        });
      });
    }, width);
    await page.locator('#livery-comparison').screenshot({ path: `.impeccable/review/liveries/comparison-${name}.png` });
  }
  assert.deepEqual(errors, []);
  console.log('Liveries: locks, keyboard selection, persistence, responsive layout, and flight startup passed.');
} finally { await browser.close(); }

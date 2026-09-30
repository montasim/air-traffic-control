import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined), args: ['--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
const errors = [];
let mainUrl;
page.on('request', r => { if (new URL(r.url()).pathname === '/src/main.ts') mainUrl = r.url(); });
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type.includes('webgl') ? null : original.call(this, type, ...args); };
});
const snapshot = () => page.evaluate(async url => (await import(url)).inspectShift(), mainUrl);
async function ready() { await expect(page.locator('#app')).not.toHaveAttribute('inert', ''); await expect(page.locator('#start-button')).toBeEnabled(); await expect(page.locator('#two-end-landing')).toBeEnabled(); }
async function setMode(enabled) { await page.locator('#two-end-landing').setChecked(enabled); await ready(); }
async function practice(enabled) {
  await page.locator('#start-panel [data-screen="help"]').click();
  await page.locator('[data-screen="practice"]').click();
  if (enabled) await expect(page.locator('#practice-target-reverse')).toBeVisible();
  else await expect(page.locator('#practice-target-reverse')).not.toBeVisible();
  const box = await page.locator('#practice-field').boundingBox();
  const point = (x,y) => ({ x: box.x+x/600*box.width, y: box.y+y/320*box.height });
  const from=point(82,230), to=point(520,110);
  await page.mouse.move(from.x,from.y); await page.mouse.down(); await page.mouse.move(to.x,to.y,{steps:15}); await page.mouse.up();
  if (enabled) await page.clock.runFor(4000);
  await expect(page.locator('#practice-status')).toContainText(enabled ? 'Safe landing!' : 'Try again.', {timeout:10000});
  if (!enabled) {
    const original=point(370,110);
    await page.mouse.move(from.x,from.y); await page.mouse.down(); await page.mouse.move(original.x,original.y,{steps:15}); await page.mouse.up();
    await page.clock.runFor(4000);
    await expect(page.locator('#practice-status')).toContainText('Safe landing!');
  }
  await page.locator('#utility-close').click();
  await expect(page.locator('#help-content')).toBeVisible();
  await page.locator('#utility-close').click();
  await expect(page.locator('#utility-screen')).not.toBeVisible();
  await expect(page.locator('#start-panel')).toBeVisible();
}
try {
  await mkdir('test-results/runway-mode', { recursive: true });
  await page.clock.install();
  await page.goto(process.env.RESIZE_TEST_URL || 'http://localhost:5173/');
  await ready();
  await expect(page.locator('#two-end-landing')).not.toBeChecked();
  await expect.poll(async () => (await snapshot()).twoEndLanding).toBe(false);
  assert.equal((await snapshot()).landingZones.filter(z=>z.approach).length,2);
  await practice(false);
  // Keyboard toggling also verifies label focus survives an idle scene rebuild.
  await page.locator('#two-end-landing').focus(); await page.keyboard.press('Space'); await ready();
  await expect(page.locator('#two-end-landing')).toBeChecked();
  await expect(page.locator('#two-end-landing')).toBeFocused();
  await page.reload(); await ready(); await expect(page.locator('#two-end-landing')).toBeChecked();
  await practice(true);
  for (const enabled of [false,true,false,true]) await setMode(enabled);
  await page.locator('input[name="difficulty"][value="easy"]').check();
  await page.locator('#start-button').click();
  await page.locator('#pause-button').click();
  const before=await snapshot();
  assert.equal(before.twoEndLanding,true); assert.equal(before.landingZones.filter(z=>z.approach).length,4);
  await expect(page.locator('#pause-context')).toContainText('Both landing ends');
  await page.setViewportSize({width:500,height:850});
  await expect(page.locator('#resume-button')).toBeEnabled();
  assert.deepEqual(await snapshot(),before);
  await page.locator('#resume-button').click(); await expect(page.locator('#pause-panel')).not.toBeVisible();
  await page.locator('#pause-button').click();
  await page.locator('#pause-panel summary').click();
  await page.locator('#restart-from-pause').click(); await page.locator('#confirm-accept').click();
  await expect(page.locator('#pause-panel')).not.toBeVisible();
  const restarted=await snapshot();
  assert.equal(restarted.twoEndLanding,true); assert.notEqual(restarted.runId,before.runId);
  await page.locator('#pause-button').click();
  await page.locator('#pause-map').click(); await page.locator('#confirm-accept').click(); await ready();
  await setMode(false); await page.reload(); await ready();
  await expect(page.locator('#two-end-landing')).not.toBeChecked();
  await page.setViewportSize({width:360,height:740}); await page.clock.runFor(250); await ready();
  await page.screenshot({path:'test-results/runway-mode/setup-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth),false);
  const checkbox=await page.locator('#two-end-landing').boundingBox();
  assert.ok(checkbox && checkbox.x>=0 && checkbox.x+checkbox.width<=360);
  await page.locator('#start-button').click(); await page.locator('#pause-button').click();
  assert.equal((await snapshot()).twoEndLanding,false);
  assert.equal((await snapshot()).landingZones.filter(z=>z.approach).length,2);
  await expect(page.locator('#pause-context')).toContainText('One landing end');
  // Unlock maps only in this disposable test profile, then switch through the UI.
  await page.evaluate(async () => {
    const { IndexedDbSavePersistence } = await import('/src/storage/persistence.ts');
    const persistence=new IndexedDbSavePersistence(), save=await persistence.read();
    save.career.earnedRankId=save.career.acknowledgedRankId='chief-controller';
    await persistence.write(save);
  });
  await page.reload(); await ready(); await setMode(true);
  await page.locator('#choose-airfield').click();
  await page.locator('[data-map-id="river-bend"]').click();
  await expect(page.locator('#utility-screen')).not.toBeVisible(); await ready();
  await expect(page.locator('#field-title')).toHaveText('River Bend');
  await expect(page.locator('#two-end-landing')).toBeChecked();
  await page.locator('#start-button').click(); await page.locator('#pause-button').click();
  assert.equal((await snapshot()).twoEndLanding,true);
  assert.equal((await snapshot()).landingZones.filter(z=>z.approach).length,4);
  assert.deepEqual(errors,[]);
  console.log('Runway mode passed: defaults, keyboard toggle, practice, repeated toggles, reload, narrow layout and frozen shift through resize/resume.');
} catch(error) { console.error('Browser errors:',errors); throw error; } finally { await browser.close(); }

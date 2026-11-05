import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

/**
 * Guards the memory a phone needs to start the game and open the airfield list. iPhone Safari kills
 * a page that grows too large ("A problem repeatedly occurred"), so this boots an emulated iPhone,
 * tallies every live canvas and WebGL texture, and fails when the peak passes the budget.
 */
const BASE = process.env.MOBILE_TEST_URL || 'http://localhost:4287/';
const BOOT_BUDGET_MB = 320;
const LIST_BUDGET_MB = 450;

const tracker = () => {
  const live = new Map();
  const canvases = [];
  let peak = 0;
  const bytesOf = (args) => {
    if (args.length >= 8) return args[3] * args[4] * 4;
    const source = args[5];
    return (source?.naturalWidth || source?.width || 0) * (source?.naturalHeight || source?.height || 0) * 4;
  };
  const total = () => {
    let sum = 0;
    for (const bytes of live.values()) sum += bytes;
    for (const ref of canvases) { const canvas = ref.deref(); if (canvas) sum += canvas.width * canvas.height * 4; }
    return sum;
  };
  for (const Context of [WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) {
    const upload = Context.prototype.texImage2D;
    Context.prototype.texImage2D = function (...args) {
      const texture = this.getParameter(this.TEXTURE_BINDING_2D);
      if (texture && args[1] === 0) live.set(texture, bytesOf(args));
      const result = upload.apply(this, args);
      peak = Math.max(peak, total());
      return result;
    };
    const remove = Context.prototype.deleteTexture;
    Context.prototype.deleteTexture = function (texture) { live.delete(texture); return remove.call(this, texture); };
  }
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...args) { canvases.push(new WeakRef(this)); return getContext.apply(this, args); };
  window.__memoryPeakMB = () => Math.round(Math.max(peak, total()) / 1048576);
};

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined) });
const failures = [];
for (const map of ['saltmarsh-gateway', 'island-rescue', 'blue-water']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(tracker);
  await page.goto(`${BASE}?review=1&map=${map}`, { waitUntil: 'load' });
  await page.locator('#start-button:not([disabled])').waitFor({ timeout: 60000 });
  await page.waitForTimeout(4000);
  const boot = await page.evaluate(() => window.__memoryPeakMB());
  await page.evaluate(() => { location.hash = '#airfields'; });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-map-id]')].every((card) => card.style.getPropertyValue('--map-preview')), null, { timeout: 90000 });
  const list = await page.evaluate(() => window.__memoryPeakMB());
  console.log(`${map}: boot ${boot} MB (budget ${BOOT_BUDGET_MB}), airfield list ${list} MB (budget ${LIST_BUDGET_MB})`);
  if (boot > BOOT_BUDGET_MB) failures.push(`${map} boot peaked at ${boot} MB`);
  if (list > LIST_BUDGET_MB) failures.push(`${map} airfield list peaked at ${list} MB`);
  if (errors.length) failures.push(`${map}: ${errors.join('; ')}`);
  await page.close();
}
await browser.close();
assert.deepEqual(failures, [], failures.join('\n'));
console.log('Mobile boot memory is within budget.');

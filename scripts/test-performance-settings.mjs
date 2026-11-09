import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const base=process.env.RESIZE_TEST_URL||'http://127.0.0.1:4287/';
let browser;for(const options of [{},{channel:'msedge'},{channel:'chrome'}]){try{browser=await chromium.launch(options);break;}catch{}}
if(!browser)throw new Error('No browser available');
await mkdir('test-results/performance',{recursive:true});
try{for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
 const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>expect(page.locator('#start-button')).toBeEnabled({timeout:30000});
 await page.goto(base);await ready();await expect(page.locator('.hud-best')).toHaveCount(0);
 await page.locator('#start-button').click();await expect(page.locator('.game-diagnostics')).toBeVisible();
 await expect.poll(async()=>/\b[1-9]\d* FPS/.test(await page.locator('.game-diagnostics').innerText())).toBe(true);
 const metrics=await page.locator('.game-diagnostics').innerText();assert.match(metrics,/Game CPU work/);assert.match(metrics,/Process CPU unavailable/);assert.doesNotMatch(metrics,/NaN|undefined/);
 assert.ok(await page.evaluate(()=>{const p=document.querySelector('.game-diagnostics').getBoundingClientRect(),s=document.querySelector('.hud-score').getBoundingClientRect();return p.left>=s.right&&p.right<=innerWidth&&p.top<25;}));
 await page.screenshot({path:`test-results/performance/play-${viewport.width}.png`});
 await page.locator('#pause-button').click();await expect(page.locator('.game-diagnostics')).toContainText('paused');
 await page.goto(`${base}?performance-test=settings#settings`);await ready();
 await expect(page.locator('#performance-toggle')).toBeVisible();await expect(page.locator('#performance-toggle')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.game-diagnostics')).toBeHidden();
 await page.locator('#performance-toggle').scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/performance/settings-${viewport.width}.png`,animations:'disabled'});
 await page.locator('#performance-toggle').click();await expect(page.locator('#performance-toggle')).toHaveAttribute('aria-pressed','false');
 await page.reload();await ready();await expect(page.locator('#performance-toggle')).toHaveAttribute('aria-pressed','false');
 await page.goto(base);await ready();await page.locator('#start-button').click();await expect(page.locator('.game-diagnostics')).toBeHidden();
 await page.goto(`${base}?performance-test=settings#settings`);await ready();await page.locator('#performance-toggle').click();
 await page.goto(base);await ready();await page.locator('#start-button').click();await expect(page.locator('.game-diagnostics')).toBeVisible();
 assert.deepEqual(errors,[]);console.log(`${viewport.width}: stats, placement, settings toggle, persistence and re-enable passed`);await page.close();
}}finally{await browser.close();}

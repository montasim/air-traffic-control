import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.RESIZE_TEST_URL || 'http://127.0.0.1:4287/';
let browser;
for (const options of [{}, {channel:'msedge'}, {channel:'chrome'}]) {
  try { browser = await chromium.launch({headless:true,...options,args:['--enable-precise-memory-info']}); break; } catch { /* try an installed browser */ }
}
if (!browser) throw new Error('No browser available for Three.js runtime checks');
await mkdir('test-results/three', {recursive:true});
const report=[];
try {
  for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:900,height:900}]) {
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const snapshot=()=>page.evaluate(async()=>{
      const url=performance.getEntriesByType('resource').find(entry=>new URL(entry.name).pathname==='/src/main.ts')?.name;
      return (await import(url)).inspectShift();
    });
    await page.goto(`${base}?review=trainee&diagnostics=1`);
    await expect(page.locator('#start-button')).toBeEnabled({timeout:30000});
    await expect(page.locator('#game canvas[data-renderer="three"]')).toHaveCount(1);
    await expect(page.locator('#game canvas')).toHaveCount(1);
    await page.locator('#start-button').click();
    await expect(page.locator('.game-diagnostics')).toBeVisible();
    await expect.poll(async()=>{
      const s=await snapshot(),p=s.simulation.aircraft[0]?.position;
      return p&&p.x>80&&p.y>100&&p.x<s.world.width-80&&p.y<s.world.height-100;
    },{timeout:20000}).toBeTruthy();
    const s=await snapshot();
    const box=await page.locator('#game canvas').boundingBox();
    const p=s.simulation.aircraft[0].position;
    await page.mouse.move(box.x+p.x/s.world.width*box.width,box.y+p.y/s.world.height*box.height);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width*.4,box.y+box.height*.55,{steps:20});
    await page.mouse.up();
    assert.ok((await snapshot()).simulation.aircraft.some(aircraft=>aircraft.route?.points.length),'Drawn route committed');
    const diagnostics=await page.locator('.game-diagnostics').innerText();
    assert.match(diagnostics,/Memory.*(?:MB|unavailable)/);
    assert.match(diagnostics,/Game CPU work/);
    const overlap=await page.evaluate(()=>{
      const panel=document.querySelector('.game-diagnostics').getBoundingClientRect();
      const score=document.querySelector('.hud-score').getBoundingClientRect();
      return {beside:panel.left>=score.right,inside:panel.right<=innerWidth,transparent:getComputedStyle(document.querySelector('.game-diagnostics')).pointerEvents==='none'};
    });
    assert.deepEqual(overlap,{beside:true,inside:true,transparent:true});
    await page.screenshot({path:`test-results/three/${viewport.width}x${viewport.height}.png`});
    await page.locator('#pause-button').click();
    const paused=await snapshot();
    await page.setViewportSize({width:viewport.width+100,height:viewport.height});
    await expect(page.locator('#resume-button')).toBeEnabled();
    assert.deepEqual(await snapshot(),paused,'Resizing a paused shift preserves world and routes');
    await page.locator('#resume-button').click();
    await expect.poll(async()=>(await snapshot()).simulation.phase).toBe('running');
    if(viewport.width===1280) {
      await page.evaluate(()=>{
        const canvas=document.querySelector('#game canvas');
        window.testContextLoss=canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
        if(!window.testContextLoss)throw new Error('Context loss extension unavailable');
        window.testContextLoss.loseContext();
      });
      await expect.poll(async()=>(await snapshot()).simulation.phase).toBe('paused');
      const lost=await snapshot();
      await page.evaluate(()=>window.testContextLoss.restoreContext());
      await expect(page.locator('#resume-button')).toBeVisible({timeout:30000});
      await expect.poll(async()=>await page.locator('#game canvas').count()).toBe(1);
      assert.deepEqual(await snapshot(),lost,'Context recovery preserves the exact paused shift');
    }
    assert.deepEqual(errors,[]);
    report.push({viewport,diagnostics,checks:'Three.js canvas, pointer route, HUD placement, pause/resize/resume passed',memoryCompliance:'unverified: development heap and resource estimates only'});
    await context.close();
  }
  // A failed renderer module exposes the boot recovery action.
  const recoveryPage=await browser.newPage();
  await recoveryPage.route('**/src/game/three/ThreeRuntime.ts*',route=>route.fulfill({status:503,body:''}));
  await recoveryPage.goto(base);
  await expect(recoveryPage.locator('#boot-retry')).toBeVisible({timeout:30000});
  await expect(recoveryPage.locator('#start-button')).toBeDisabled();
  report.push({checks:'Failed renderer module displays recovery UI'});
  await writeFile('test-results/three/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}

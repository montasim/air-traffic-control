import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true,args:['--enable-precise-memory-info']});
const results=[];
try {
  for(const viewport of [{width:1280,height:800},{width:390,height:844}]) {
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    await page.goto(`${process.env.PROFILE_URL || 'http://localhost:4288/'}`);
    await expect(page.locator('#start-button')).toBeEnabled({timeout:30000});
    await expect(page.locator('#game canvas[data-renderer="three"]')).toHaveCount(1);
    await page.locator('#start-button').click();
    await expect(page.locator('.game-diagnostics')).toBeVisible();
    const samples=await page.evaluate(()=>new Promise(resolve=>{
      const samples=[];
      const timer=setInterval(()=>{
        samples.push({time:performance.now(),heap:performance.memory?.usedJSHeapSize,display:document.querySelector('.game-diagnostics')?.textContent});
        if(samples.length===20){clearInterval(timer);resolve(samples);}
      },500);
    }));
    results.push({viewport,samples,limitations:'10-second smoke profile, no forced GC. GPU estimates and browser heap only; not a certification of the 30 MB combined cap.'});
    await context.close();
  }
  await mkdir('test-results/three',{recursive:true});
  await writeFile('test-results/three/production-memory.json',JSON.stringify(results,null,2)+'\n');
  for(const result of results)console.log(JSON.stringify({viewport:result.viewport,lastSample:result.samples.at(-1),peakSampledHeap:Math.max(...result.samples.map(sample=>sample.heap??0)),limitations:result.limitations}));
}finally{await browser.close();}

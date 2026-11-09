import assert from 'node:assert/strict';
import { chromium, webkit } from '@playwright/test';
const base=process.env.RESIZE_TEST_URL||'http://127.0.0.1:5173/';
const engines=[['Chromium',()=>chromium.launch({channel:'msedge'})],['WebKit',()=>webkit.launch()]];
for(const [name,launch] of engines){
 let browser;
 try {browser=await launch();} catch(error){if(name==='WebKit'){console.log('WebKit unavailable: '+error.message.split('\n')[0]);continue;}throw error;}
 try {
  const page=await browser.newPage({viewport:{width:430,height:735},deviceScaleFactor:3,hasTouch:true});
  await page.goto(new URL('scripts/menu-pictures.html',base).href);
  const maps=await page.evaluate(async()=>{
   const meta=document.createElement('meta');meta.name='viewport';meta.content='width=device-width, initial-scale=1';document.head.append(meta);
   document.body.innerHTML='<div id="game" style="position:fixed;inset:0"></div>';
   return (await import('/src/game/maps/mapIds.ts')).MAP_IDS;
  });
  for(const map of maps){
   await page.setViewportSize({width:430,height:735});
   await page.evaluate(async(map)=>{
    window.fullscreenRuntime?.destroy();
    const {ThreeRuntime}=await import('/src/game/three/ThreeRuntime.ts');
    const {mapDefinitionById}=await import('/src/game/maps/registry.ts');
    const {worldSizeForViewport}=await import('/src/game/viewport.ts');
    const r=window.fullscreenRuntime=new ThreeRuntime({map:mapDefinitionById(map),world:worldSizeForViewport(innerWidth,innerHeight),twoEndLanding:true,livery:'classic',night:false,mobile:true,onContextRestored(){}});
    await new Promise((resolve,reject)=>{r.events.once('scene-ready',resolve);r.events.once('runtime-error',reject);});r.sleep();
    window.originalWorld=JSON.stringify(r.world);
   },map);
   for(const viewport of [{width:430,height:735},{width:430,height:932},{width:390,height:844},{width:932,height:430},{width:1024,height:768},{width:1920,height:1080}]){
    await page.setViewportSize(viewport);
    const result=await page.evaluate(async()=>{
     const r=window.fullscreenRuntime,box=document.querySelector('#game canvas').getBoundingClientRect();
     const {pointerToWorld}=await import('/src/game/three/projection.ts');
     const end=pointerToWorld({x:box.right,y:box.bottom},box,r.world);
     return {fills:Math.abs(box.width-innerWidth)<1&&Math.abs(box.height-innerHeight)<1&&box.left===0&&box.top===0,stable:JSON.stringify(r.world)===window.originalWorld,pointer:Math.abs(end.x-r.world.width)<.001&&Math.abs(end.y-r.world.height)<.001};
    });
    assert.deepEqual(result,{fills:true,stable:true,pointer:true},name+' '+map+' '+JSON.stringify(viewport));
   }
   console.log(name+': '+map+' fills all six viewports; world and pointer mapping preserved');
  }
 } finally {await browser.close();}
}

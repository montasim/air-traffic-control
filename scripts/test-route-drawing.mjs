import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const base=process.env.RESIZE_TEST_URL||'http://127.0.0.1:4287/';
let browser;
for(const options of [{},{channel:'msedge'},{channel:'chrome'}]){try{browser=await chromium.launch(options);break;}catch{}}
if(!browser)throw new Error('No browser available');
try{
 for(const touch of [false,true]){
  const viewport=touch?{width:390,height:844}:{width:1280,height:800};
  const page=await browser.newPage({viewport,hasTouch:touch});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'||/GL_INVALID/.test(m.text()))errors.push(m.text());});
  await page.goto(new URL('scripts/menu-pictures.html',base).href);
  const maps=await page.evaluate(async()=>{document.body.innerHTML='<div id="game"></div>';return(await import('/src/game/maps/mapIds.ts')).MAP_IDS;});
  const cdp=touch?await page.context().newCDPSession(page):undefined;
  for(const map of maps){
   const path=await page.evaluate(async({map,viewport})=>{
    window.routeRuntime?.destroy();
    const{ThreeRuntime}=await import('/src/game/three/ThreeRuntime.ts');
    const{mapDefinitionById}=await import('/src/game/maps/registry.ts');
    const{worldSizeForViewport}=await import('/src/game/viewport.ts');
    const r=new ThreeRuntime({map:mapDefinitionById(map),world:worldSizeForViewport(viewport.width,viewport.height),twoEndLanding:false,livery:'classic',night:false,mobile:viewport.width<500,onContextRestored(){}});
    window.routeRuntime=r;await new Promise((resolve,reject)=>{r.events.once('scene-ready',resolve);r.events.once('runtime-error',reject);});
    const parkedTypes=['liner','commuter'].filter(type=>r.layout.apronMarkings?.stands.some(stand=>stand.accepts===type));
    if(r.ground.aircraft.length!==parkedTypes.length)throw new Error('Idle menu must include the original parked aircraft');
    r.startRun();r.sleep();
    const zone=r.layout.landingZones.find(z=>z.approach);
    const start={x:zone.position.x-Math.cos(zone.angle)*180,y:zone.position.y-Math.sin(zone.angle)*180};
    r.session.simulation.aircraft=[{id:100,type:zone.accepts,position:start,heading:zone.angle,speed:90,collisionRadius:18,state:'flying',hasEntered:true,landingProgress:0}];
    window.flushRoute=()=>{const s=r.session.simulation.snapshot();r.syncAircraft(s,0);r.drawRoutes(s);r.presentation.sync();r.renderer.render(r.scene,r.camera);};
    window.flushRoute();
    const rect=r.renderer.domElement.getBoundingClientRect();
    const screen=p=>({x:rect.x+p.x/r.world.width*rect.width,y:rect.y+p.y/r.world.height*rect.height});
    return {start:screen(start),end:screen(zone.position),zone:zone.id};
   },{map,viewport});
   const send=async(type,p)=>{if(touch)await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{...p,id:1,radiusX:1,radiusY:1}]});else if(type==='touchStart'){await page.mouse.move(p.x,p.y);await page.mouse.down();}else if(type==='touchEnd')await page.mouse.up();else await page.mouse.move(p.x,p.y);};
   await send('touchStart',path.start);
   // Vary the drawing bounds across uploads, including shrinking them again.
   for(const t of [.4,.8,.6,1]){
    await send('touchMove',{x:path.start.x+(path.end.x-path.start.x)*t,y:path.start.y+(path.end.y-path.start.y)*t});
    const visiblePixels=await page.evaluate(()=>{
     window.flushRoute();const r=window.routeRuntime,gl=r.renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
     const shown=new Uint8Array(w*h*4),hidden=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,shown);
     r.presentation.ui.previewGraphics.visible=false;r.presentation.sync();r.renderer.render(r.scene,r.camera);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,hidden);
     r.presentation.ui.previewGraphics.visible=true;r.presentation.sync();r.renderer.render(r.scene,r.camera);
     let count=0;for(let i=0;i<shown.length;i+=4)if(Math.abs(shown[i]-hidden[i])+Math.abs(shown[i+1]-hidden[i+1])+Math.abs(shown[i+2]-hidden[i+2])>30)count++;
     return count;
    });
    assert.ok(visiblePixels>20,`${map}: ${touch?'touch':'mouse'} route must be visibly rendered (${visiblePixels} pixels)`);
   }
   const selectedUI=await page.evaluate(()=>{const r=window.routeRuntime;return {guidance:r.presentation.ui.routeGuidance.getState(),label:r.presentation.ui.approachLabels.some(label=>label.visible),selected:r.presentation.actors.get(100).view.ring.visible,diagnostics:!!document.querySelector('.game-diagnostics')};});
   assert.deepEqual(selectedUI,{guidance:'locked',label:true,selected:true,diagnostics:true},'Original selection, runway labels and lock feedback');
   await send('touchEnd',path.end);
   const destination=await page.evaluate(()=>{window.flushRoute();return window.routeRuntime.getShiftSnapshot().simulation.aircraft[0].route?.destinationZoneId;});
   assert.equal(destination,path.zone,`${map}: route connects to runway`);
   assert.equal(await page.evaluate(()=>window.routeRuntime.presentation.ui.routeGuidance.getState()),'confirmed');
   await page.evaluate(()=>window.routeRuntime.presentation.ui.update(401,false));
   assert.equal(await page.evaluate(()=>window.routeRuntime.presentation.ui.routeGuidance.getState()),'neutral');
   console.log(`${map}: ${touch?'touch':'mouse'} visible route and runway connection passed`);
  }
  assert.deepEqual(errors,[]);await page.close();
 }
}finally{await browser.close();}

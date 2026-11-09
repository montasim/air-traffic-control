import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
const base=process.env.RESIZE_TEST_URL||'http://127.0.0.1:5173/';
await mkdir('test-results',{recursive:true});
// Keep a pinned reference implementation, fed the exact same live artwork objects.
await writeFile('test-results/artwork-reference.ts',execFileSync('git',['show','12a2afb:src/game/art/ThreeArtwork.ts'],{encoding:'utf8'}).replace("'./CanvasScene'","'../src/game/art/CanvasScene'"));
const browser=await chromium.launch({channel:'msedge'}),results=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(new URL('scripts/menu-pictures.html',base).href);
 const maps=await page.evaluate(async()=>{document.body.innerHTML='<div id="game"></div>';return(await import('/src/game/maps/mapIds.ts')).MAP_IDS;});
 for(const map of maps)for(const night of [false,true]){
  const result=await page.evaluate(async({map,night})=>{
   const {ThreeRuntime}=await import('/src/game/three/ThreeRuntime.ts'),{mapDefinitionById}=await import('/src/game/maps/registry.ts');
   const {ThreeArtwork:Reference}=await import('/test-results/artwork-reference.ts');
   const THREE=await import('/node_modules/three/build/three.module.js');
   const r=new ThreeRuntime({map:mapDefinitionById(map),world:{width:1600,height:1000},twoEndLanding:false,livery:'classic',night,mobile:false,onContextRestored(){}});
   await new Promise((resolve,reject)=>{r.events.once('scene-ready',resolve);r.events.once('runtime-error',reject);});r.sleep();r.startRun();r.sleep();
   const sim=r.session.simulation;sim.aircraft=Array.from({length:6},(_,i)=>({id:100+i,type:['liner','commuter','rotor'][i%3],position:{x:250+i*180,y:500},heading:i*.4,speed:8,collisionRadius:18,state:'flying',hasEntered:true,landingProgress:0,route:{points:[{x:250+i*180,y:500},{x:500+i*80,y:650},{x:800,y:850}],segmentIndex:1}}));
   const s=sim.snapshot();r.syncAircraft(s,0);r.drawRoutes(s);r.presentation.update(.4,false);r.presentation.sync();
   const reference=new Reference(r.presentation.source,1);reference.sync();const scene=new THREE.Scene();scene.add(reference.group);
   const gl=r.renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
   const pixels=()=>{const p=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
   r.renderer.render(scene,r.camera);const old=pixels(),oldCalls=r.renderer.info.render.calls;
   r.renderer.render(r.scene,r.camera);const current=pixels(),newCalls=r.renderer.info.render.calls;
   let changed=0,sum=0;for(let i=0;i<old.length;i+=4){const d=Math.max(...[0,1,2].map(c=>Math.abs(old[i+c]-current[i+c])));sum+=d;if(d>25)changed++;}
   const output={map,night,changedPercent:changed/(width*height)*100,meanChannelDelta:sum/(width*height),oldCalls,newCalls};
   reference.dispose();r.destroy();return output;
  },{map,night});
  results.push(result);console.log(JSON.stringify(result));
  assert.ok(result.changedPercent<1,`${map}: artwork changed beyond line antialiasing tolerance`);
  assert.ok(result.newCalls<=result.oldCalls,`${map}: draw calls should not increase`);
 }
 assert.deepEqual(errors,[]);await writeFile('test-results/artwork-parity.json',JSON.stringify(results,null,2));
}finally{await browser.close();}

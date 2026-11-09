import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,cp,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
import {createServer} from 'node:http';
import {gzipSync} from 'node:zlib';
import {build} from 'vite';
import {chromium} from '@playwright/test';
import {installInstrumentation} from './benchmark/instrumentation.mjs';
import {loadedBundleBytes} from './benchmark/bundle-size.mjs';
const root=resolve(process.env.BENCH_OUT||'test-results/renderer-benchmark');await mkdir(root,{recursive:true});
const refs={phaser:process.env.PHASER_REF||'5984ef5',three:process.env.THREE_REF||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()};
const template=await readFile('scripts/benchmark/entry.ts.template','utf8');
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
@font-face{font-family:'Barlow Condensed';src:url('/fonts/BarlowCondensed-SemiBold.woff2');font-weight:600}
@font-face{font-family:'Barlow Condensed';src:url('/fonts/BarlowCondensed-Bold.woff2');font-weight:700}
@font-face{font-family:'Atkinson Hyperlegible';src:url('/fonts/AtkinsonHyperlegible-Regular.woff2');font-weight:400}
html,body{margin:0;overflow:hidden;background:#263e38}#game{position:fixed;inset:0}canvas{display:block}
</style><div id="game"></div><script type="module" src="/entry.ts"></script>`;
const setups={
 phaser:`const Phaser=(await import('phaser')).default;const {PlayScene}=await import('./src/game/scenes/PlayScene');const {capFrameRate}=await import('./src/game/frameRate');
 const scale=renderScaleFor(world,{width:innerWidth,height:innerHeight},devicePixelRatio);
 game=new Phaser.Game({type:Phaser.WEBGL,parent:'game',width:world.width*scale,height:world.height*scale,render:{antialias:true,roundPixels:false},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},audio:{noAudio:true},scene:[new PlayScene(mapDefinitionById(mapId),false,'classic',scale,night)]});
 await new Promise(resolve=>game.events.once('scene-ready',resolve));runtime=game.scene.getScene('play');runtime.startRun('medium','benchmark');
 if(profile.detailLevel==='mobile'&&params.get('uncapped')!=='1')capFrameRate(game.loop,()=>false);
 game.events.on(Phaser.Core.Events.POST_RENDER,()=>window.bench.frame());`,
 three:`const {ThreeRuntime}=await import('./src/game/three/ThreeRuntime');
 runtime=new ThreeRuntime({map:mapDefinitionById(mapId),world,twoEndLanding:false,livery:'classic',night,mobile:profile.detailLevel==='mobile',detailLevel:profile.detailLevel,renderScale:renderScaleFor(world,{width:innerWidth,height:innerHeight},devicePixelRatio),onContextRestored(){}});
 await new Promise((resolve,reject)=>{runtime.events.once('scene-ready',resolve);runtime.events.once('runtime-error',reject);});runtime.startRun('medium','benchmark');runtime.events.on('frame',()=>window.bench.frame());`
};
for(const engine of ['phaser','three']){
 const dir=join(root,engine);await mkdir(dir,{recursive:true});
 const tar=join(root,engine+'.tar');execFileSync('git',['archive','--format=tar','-o',tar,refs[engine],'src','public']);execFileSync('tar',['-xf',tar,'-C',dir]);
 if(engine==='three'&&process.env.BENCH_WORKTREE){await cp(resolve('src'),join(dir,'src'),{recursive:true});await cp(resolve('public'),join(dir,'public'),{recursive:true});}
 await writeFile(join(dir,'package.json'),JSON.stringify({private:true,type:'module'}));
 if(engine==='phaser'&&!existsSync(join(dir,'node_modules/phaser/package.json'))){console.log('Installing isolated Phaser 4.2.1 baseline');execFileSync(process.platform==='win32'?'npm.cmd':'npm',['install','--prefix',dir,'--no-save','--package-lock=false','phaser@4.2.1'],{stdio:'inherit',shell:process.platform==='win32'});}
 const entry=template.replace('/*ENGINE_SETUP*/',setups[engine]).replace('/*SIMULATION*/',engine==='phaser'?'runtime.simulation':'runtime.session.simulation').replace('/*ENGINE*/',engine).replace('/*CAP*/',engine==='phaser'?"profile.detailLevel==='mobile'&&params.get('uncapped')!=='1'?30:null":'null');
 await writeFile(join(dir,'entry.ts'),entry);await writeFile(join(dir,'index.html'),html);
 await build({root:dir,configFile:false,logLevel:'error',build:{outDir:join(dir,'dist'),emptyOutDir:false,target:'es2022',sourcemap:false}});console.log(engine+' production benchmark built');
}
const servers=[];const urls={};
for(const engine of ['phaser','three']){const dir=join(root,engine,'dist');const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://local').pathname);const file=resolve(dir,'.'+(path==='/'?'/index.html':path));// Serve only the isolated benchmark root.
 if(!file.startsWith(dir))throw Error('Invalid path');const data=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp'})[extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(data);}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));servers.push(server);urls[engine]=`http://127.0.0.1:${server.address().port}/`;}
const cases=[];
for(const map of ['saltmarsh-gateway','frost-crossing','blue-water'])for(const device of ['desktop','phone'])cases.push({map,device,aircraft:24,mode:'shipped'});
for(const device of ['desktop','phone'])cases.push({map:'saltmarsh-gateway',device,aircraft:6,mode:'shipped'});
cases.push({map:'saltmarsh-gateway',device:'phone',aircraft:24,mode:'uncapped'});
if(process.env.BENCH_CURVED)cases.push({map:'saltmarsh-gateway',device:'desktop',aircraft:24,mode:'curved'});
const repeats=Number(process.env.BENCH_REPEATS||3),sampleMs=Number(process.env.BENCH_SAMPLE_MS||8000),warmMs=Number(process.env.BENCH_WARM_MS||2000);
const selected=process.env.BENCH_SMOKE?cases.slice(0,2):cases;
const results=[];const metadata={refs,repeats,sampleMs,warmMs,workingTree:!!process.env.BENCH_WORKTREE,createdAt:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch};
metadata.bundleBytes={};
for(const engine of ['phaser','three']){const dir=join(root,engine,'dist/assets');let raw=0,gzip=0;for(const file of await readdir(dir)){if(file.endsWith('.js')){const data=await readFile(join(dir,file));raw+=data.length;gzip+=gzipSync(data).length;}}metadata.bundleBytes[engine]={raw,gzip};}
const metric=async cdp=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
const processes=async cdp=>{try{return(await cdp.send('SystemInfo.getProcessInfo')).processInfo;}catch{return[];}};
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1),percentile=(a,p)=>[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*p))]??0;
try{for(let repeat=0;repeat<repeats;repeat++)for(const test of selected)for(const engine of (repeat%2?['three','phaser']:['phaser','three'])){
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true,args:['--enable-precise-memory-info']});
 try{
  const bcdp=await browser.newBrowserCDPSession();metadata.browser=browser.version();
  if(!metadata.gpu){try{metadata.gpu=(await bcdp.send('SystemInfo.getInfo')).gpu;}catch{}}
  const viewport=test.device==='desktop'?{width:1280,height:800}:{width:390,height:844};
  const page=await browser.newPage({viewport,deviceScaleFactor:test.device==='desktop'?1:2,serviceWorkers:'block',reducedMotion:'no-preference'});await page.addInitScript(installInstrumentation);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|CONTEXT_LOST/.test(m.text()))errors.push(m.text());});
  const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
  const query=new URLSearchParams({map:test.map,aircraft:String(test.aircraft),uncapped:test.mode==='uncapped'?'1':'0',routePoints:test.mode==='curved'?'32':'2'});
  await page.goto(urls[engine]+'?'+query,{waitUntil:'load'});await page.waitForFunction(()=>window.ready,undefined,{timeout:60000});
  await page.waitForTimeout(warmMs);
  await page.evaluate(()=>window.reseed());
  const before=await metric(cdp),procBefore=await processes(bcdp);await page.evaluate(()=>window.bench.begin());
  await page.waitForTimeout(sampleMs);
  const measured=await page.evaluate(()=>({ready:{...window.ready,navigationToFirstFrameMs:window.bench.firstFrameMs},fixture:window.fixture(),sample:window.bench.finish()}));const after=await metric(cdp),procAfter=await processes(bcdp);
  const glInfo=await page.evaluate(()=>{const canvas=document.querySelector('#game canvas'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl');const ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION)};});
  await cdp.send('HeapProfiler.collectGarbage');const retained=await page.evaluate(()=>window.bench.memory());
  let processMemory=null;const ids=procAfter.filter(p=>p.type==='renderer').map(p=>Number(p.id)).filter(Number.isSafeInteger);
  if(process.platform==='win32'&&ids.length){try{processMemory=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',`Get-Process -Id ${ids.join(',')} | Select-Object Id,WorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Compress`],{encoding:'utf8'}));}catch{}}
  const seconds=measured.sample.durationMs/1000;
  const cpu=type=>procAfter.filter(p=>p.type===type).reduce((sum,p)=>{const before=procBefore.find(q=>q.id===p.id);return sum+(before?p.cpuTime-before.cpuTime:0);},0)/seconds*100;
  const intervals=measured.sample.intervals;
  const row={engine,...test,repeat,glInfo,ready:measured.ready,fixture:measured.fixture,metrics:{fps:intervals.length/(intervals.reduce((a,b)=>a+b,0)/1000),frameP50Ms:percentile(intervals,.5),frameP95Ms:percentile(intervals,.95),frameP99Ms:percentile(intervals,.99),framesOver50ms:intervals.filter(x=>x>50).length,mainThreadCpuPct:(after.TaskDuration-before.TaskDuration)/seconds*100,mainThreadMsPerFrame:(after.TaskDuration-before.TaskDuration)*1000/(intervals.length||1),rendererProcessCpuPct:cpu('renderer'),gpuProcessCpuPct:cpu('GPU'),drawCallsPerFrame:mean(measured.sample.drawCalls),heapPeakBytes:Math.max(...measured.sample.heapSamples.filter(Number.isFinite)),heapEndBytes:measured.sample.memory.heap,heapRetainedBytes:retained.heap,gpuTextureBytes:retained.textureBytes,gpuRenderbufferBytes:retained.renderbufferBytes,gpuBufferBytes:retained.bufferBytes,canvasBackingBytes:retained.canvasBytes},processMemory,errors,raw:measured.sample};
  if(row.fixture.phase!=='running'||row.fixture.count!==test.aircraft||row.fixture.flying!==test.aircraft||errors.length)throw Error('Invalid trial '+JSON.stringify({engine,test,fixture:row.fixture,errors}));
  results.push(row);await writeFile(join(root,'results.json'),JSON.stringify({metadata,results},null,2));
  console.log(JSON.stringify({trial:results.length,engine,...test,repeat,fps:row.metrics.fps.toFixed(1),cpu:row.metrics.mainThreadCpuPct.toFixed(1),heapMB:(row.metrics.heapRetainedBytes/1e6).toFixed(1)}));
  if(repeat===0){await page.screenshot({path:join(root,`${engine}-${test.map}-${test.device}-${test.aircraft}-${test.mode}.png`)});}
 }finally{await browser.close();}
}}finally{for(const s of servers)await new Promise(r=>s.close(r));}
metadata.bundleBytes=await loadedBundleBytes(root,results);
await writeFile(join(root,'results.json'),JSON.stringify({metadata,results},null,2));
console.log('Results: '+join(root,'results.json'));

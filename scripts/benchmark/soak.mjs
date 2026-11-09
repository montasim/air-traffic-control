import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {installInstrumentation} from './instrumentation.mjs';
const root=resolve(process.env.BENCH_OUT||'test-results/renderer-optimized'),dir=resolve(root,'three/dist');
const server=createServer(async(req,res)=>{try{const p=new URL(req.url,'http://local').pathname,file=resolve(dir,'.'+(p==='/'?'/index.html':p));if(!file.startsWith(dir+sep))throw Error('Invalid path');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.woff2':'font/woff2','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({channel:'msedge',args:['--enable-precise-memory-info']});
try{
 const p=await b.newPage({viewport:{width:1280,height:800}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(installInstrumentation);
 await p.goto(`http://127.0.0.1:${server.address().port}/?map=blue-water&aircraft=24`);await p.waitForFunction(()=>window.ready);
 const cdp=await p.context().newCDPSession(p),samples=[];
 for(let second=10;second<=60;second+=10){
  // Restart positions, not renderer resources, to prevent edge exits during a sustained workload.
  await p.evaluate(()=>window.reseed());await p.waitForTimeout(10000);await cdp.send('HeapProfiler.collectGarbage');
  const sample=await p.evaluate(()=>({fixture:window.fixture(),memory:window.bench.memory()}));samples.push({second,...sample});console.log(JSON.stringify(samples.at(-1)));
  assert.equal(sample.fixture.phase,'running');assert.equal(sample.fixture.flying,24);
 }
 assert.deepEqual(errors,[]);
 const tail=samples.slice(1),heaps=tail.map(s=>s.memory.heap),textures=tail.map(s=>s.memory.textureBytes),buffers=tail.map(s=>s.memory.bufferBytes);
 assert.equal(new Set(textures).size,1,'Texture storage should stabilize');assert.equal(new Set(buffers).size,1,'Geometry storage should stabilize');
 assert.ok(Math.max(...heaps)-Math.min(...heaps)<3e6,'Retained heap should remain bounded after warm-up');
 await writeFile(root+'/soak-results.json',JSON.stringify({durationSeconds:60,samples,errors},null,2));
}finally{await b.close();await new Promise(r=>server.close(r));}

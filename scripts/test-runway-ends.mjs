import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined), args:['--disable-gpu'] });
await mkdir('test-results/runway-ends',{recursive:true});
try {
  for (const type of (process.env.AIRCRAFT_TYPE ? [process.env.AIRCRAFT_TYPE] : ['commuter','liner'])) for (const end of (process.env.RUNWAY_END ? [Number(process.env.RUNWAY_END)] : [0,1])) {
    const page=await browser.newPage({viewport:{width:Number(process.env.TEST_WIDTH || 1280),height:Number(process.env.TEST_HEIGHT || 800)}});
    let mainUrl; page.on('request',r=>{if(new URL(r.url()).pathname==='/src/main.ts') mainUrl=r.url()});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:original.call(this,type,...args)};});
    await page.clock.install({time:new Date(2026,8,30,12,0,0)});
    await page.goto(process.env.RESIZE_TEST_URL || 'http://localhost:4287/');
    await expect(page.locator('#start-button')).toBeEnabled();
    await page.locator(`input[name="difficulty"][value="${process.env.TEST_DIFFICULTY || 'easy'}"]`).check();
    await page.clock.setFixedTime(new Date(11));
    await page.locator('#start-button').click();
    const snapshot=()=>page.evaluate(async url=>(await import(url)).inspectShift(),mainUrl);
    async function routePlane(aircraft, zone, state) {
      const box=await page.locator('#game canvas').boundingBox();
      const screen=p=>({x:box.x+p.x/state.world.width*box.width,y:box.y+p.y/state.world.height*box.height});
      const from=screen(aircraft.position);
      const turn=screen({x:zone.position.x-Math.cos(zone.angle)*zone.captureRadius*4,y:zone.position.y-Math.sin(zone.angle)*zone.captureRadius*4});
      const target=screen(zone.position);
      await page.mouse.move(from.x,from.y);await page.mouse.down();
      await page.mouse.move(turn.x,turn.y,{steps:25});await page.mouse.move(target.x,target.y,{steps:16});await page.mouse.up();
    }
    let s,p;
    for(let i=0;i<25;i++) {
      await page.clock.runFor(1000); s=await snapshot();
      if (type === 'liner') {
        const earlier=s.simulation.aircraft.find(a=>a.type==='commuter' && a.hasEntered && a.position.x>60 && a.position.x<s.world.width-60 && !a.approachZoneId);
        if(earlier) await routePlane(earlier,s.landingZones.find(z=>z.accepts==='commuter' && z.approach?.end===0),s);
      }
      p=s.simulation.aircraft.find(p=>p.type===type && p.hasEntered && p.position.x>60 && p.position.x<s.world.width-60 && p.position.y>90 && p.position.y<s.world.height-60);
      if(p) break;
    }
    assert.ok(p,`An entering ${type} must become available`);
    const zone=s.landingZones.find(z=>z.accepts===type && z.approach?.end===end);
    const box=await page.locator('#game canvas').boundingBox();
    const screen=p=>({x:box.x+p.x/s.world.width*box.width,y:box.y+p.y/s.world.height*box.height});
    const from=screen(p.position);
    // Long straight final segment gives the airframe time to align naturally.
    const approach={x:zone.position.x-Math.cos(zone.angle)*zone.captureRadius*4,y:zone.position.y-Math.sin(zone.angle)*zone.captureRadius*4};
    const turn=screen(approach), target=screen(zone.position);
    await page.mouse.move(from.x,from.y);await page.mouse.down();
    await page.mouse.move(turn.x,turn.y,{steps:25});await page.mouse.move(target.x,target.y,{steps:16});
    await page.screenshot({path:`test-results/runway-ends/${type}-${end}.png`});
    await page.mouse.up();
    s=await snapshot();assert.equal(s.simulation.aircraft.find(a=>a.id===p.id)?.approachZoneId,zone.id);
    let landed=false, resized=false, touchdown=false;
    for(let i=0;i<280;i++) {
      await page.clock.runFor(250);s=await snapshot();
      const tracked=s.simulation.aircraft.find(a=>a.id===p.id);
      if (!touchdown && tracked?.state==='landing') {
        touchdown=true;
        assert.equal(tracked.approachZoneId,zone.id);
        assert.equal(tracked.landingZoneId,zone.id);
        await page.screenshot({path:`test-results/runway-ends/touchdown-${type}-${end}.png`});
      }
      if(!process.env.SKIP_RESIZE && !resized && !touchdown && s.simulation.runwayReservations?.some(r=>r.aircraftId===p.id)) {
        await page.setViewportSize({width:800,height:1000});
        await page.clock.runFor(250);
        const paused=await snapshot();
        assert.equal(paused.simulation.phase,'paused');
        assert.equal(paused.runId,s.runId);
        assert.deepEqual(paused.simulation.runwayReservations,s.simulation.runwayReservations);
        await page.locator('#resume-button').click();
        resized=true;
      }
      if(!s.simulation.aircraft.some(a=>a.id===p.id) && s.simulation.score>0){landed=true;break;}
      if(s.simulation.phase==='over') break;
    }
    if(!landed) { console.log(JSON.stringify({phase:s.simulation.phase,aircraft:s.simulation.aircraft.map(a=>({id:a.id,type:a.type,position:a.position,state:a.state,destination:a.approachZoneId}))})); console.log(await page.locator('#gameover-code').textContent().catch(()=>'')); await page.screenshot({path:`test-results/runway-ends/failure-${type}-${end}.png`}); }
    assert.ok(landed,`${type} must land at end ${end}, phase=${s.simulation.phase}`);
    assert.ok(touchdown,`${type} must enter the landing animation at the selected end`);
    assert.equal(s.evidence.landedTypes[type],1);
    if (!process.env.SKIP_RESIZE) assert.ok(resized,'Runway ownership must also be checked across resize');
    assert.deepEqual(errors,[]);
    console.log(`${type} landed via runway ${zone.label} with pointer-drawn route`);
    await page.close();
  }
} finally { await browser.close(); }

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Run against the Vite development server; uses disposable browser state.
const output = 'test-results/ground-parking';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined),
  args: ['--enable-unsafe-swiftshader'],
});
const results = [];
const errors = [];
try {
  for (const [size, viewport, livery] of [
    ['desktop', { width: 1200, height: 800 }, 'classic'],
    ['portrait', { width: 390, height: 844 }, 'signal'],
    ['landscape', { width: 844, height: 390 }, 'midnight'],
  ]) {
    const page = await browser.newPage({ viewport, serviceWorkers: 'block' });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/@vite/client', (route) => route.abort());
    await page.goto(process.env.GROUND_TEST_URL || 'http://127.0.0.1:4287/');
    const ids = await page.evaluate(async () => (await import('/src/game/maps/mapIds.ts')).MAP_IDS);
    for (const twoEndLanding of [false, true]) for (const id of ids) {
      const runs = await page.evaluate(async ({ id, viewport, twoEndLanding, livery }) => {
        if (window.auditGame) {
          window.auditGame.destroy(true);
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        document.querySelector('#audit-host')?.remove();
        const host = document.createElement('div');
        host.id = 'audit-host';
        host.style.cssText = 'position:fixed;inset:0;z-index:1000;background:#263e38';
        document.body.append(host);
        const { ThreeRuntime } = await import('/src/game/three/ThreeRuntime.ts');
        const { mapDefinitionById } = await import('/src/game/maps/registry.ts');
        const { worldSizeForViewport } = await import('/src/game/viewport.ts');
        const { AIRCRAFT_OUTLINES } = await import('/src/core/aircraftCollision.ts');
        const { onApron } = await import('/src/game/maps/shared/apronLayout.ts');
        const { taxiGuidePaths } = await import('/src/game/maps/shared/groundRoutes.ts');
        const scene = new ThreeRuntime({map:mapDefinitionById(id),world:worldSizeForViewport(viewport.width,viewport.height),twoEndLanding,livery,night:false,mobile:viewport.width<500,renderScale:1,onContextRestored(){}});
        window.auditGame=scene;
        await new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(new Error('Runtime timed out: '+id)),15000);
          scene.events.once('scene-ready',()=>{clearTimeout(timer);resolve();});
          scene.events.once('runtime-error',reject);
        });
        scene.sleep();host.append(scene.renderer.domElement);
        const guides=[...taxiGuidePaths(scene.layout),...Object.values(scene.layout.groundRoutes).flatMap(route=>route.stands.map(stand=>stand.approach??[]))];
        for (const r of scene.layout.runways) guides.push([-1, 1].map((sign) => ({ x: r.center.x + Math.cos(r.angle) * r.length * .5 * sign, y: r.center.y + Math.sin(r.angle) * r.length * .5 * sign })));
        const advance=(delta)=>{
          scene.session.simulation.update(delta);
          scene.syncAircraft(scene.session.simulation.snapshot(),delta);
        };
        const gap = (p, a, b) => {
          const dx = b.x - a.x, dy = b.y - a.y;
          const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
          return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
        };
        const runs = [];
        for (const zone of scene.layout.landingZones.filter((z) => z.approach)) {
          scene.startRun('medium', 'ground-review');scene.sleep();
          const stands = scene.layout.groundRoutes[zone.id].stands;
          // Repeated arrivals cover all stands, occupied replacement, and reduced motion.
          for (let attempt = 0; attempt < stands.length + 2; attempt++) {
            const aircraftId = 1000 + attempt;
            Object.defineProperty(scene.motion,'matches',{value:attempt === stands.length + 1,configurable:true});
            scene.session.simulation.aircraft = [{ id: aircraftId, type: zone.accepts, position: { ...zone.position }, heading: zone.angle, speed: 90, collisionRadius: 18, state: 'landing', hasEntered: true, landingProgress: 0, landingZoneId: zone.id }];
            scene.session.simulation.nextSpawnAt = Infinity;
            let maxGap = 0, outside = 0, parked, pauseChecked = false;
            for (let frame = 0; frame < 3600; frame++) {
              advance(1/60);
              const state = scene.ground.aircraft.find((a) => a.id === aircraftId);
              if (!state) continue;
              if (attempt === 0 && state.phase === 'taxiing' && !pauseChecked) {
                scene.pauseRun();
                const before = JSON.stringify(scene.ground.aircraft);
                host.style.width = `${viewport.width * .9}px`;
                scene.fit();
                advance(.5);
                if (JSON.stringify(scene.ground.aircraft) !== before) throw new Error(`${id}: ground traffic moved while paused/resizing`);
                host.style.width = '';
                scene.fit();
                scene.resumeRun();scene.sleep();
                pauseChecked = true;
              }
              if (state.phase === 'taxiing') maxGap = Math.max(maxGap, Math.min(...guides.flatMap((path) => path.slice(1).map((b, i) => gap(state.position, path[i], b)))));
              if (['taxiing', 'parked'].includes(state.phase) && scene.layout.carrier && zone.accepts === 'commuter') {
                const scale = scene.groundScales.commuter;
                const c = Math.cos(state.heading), s = Math.sin(state.heading);
                for (const [x, y] of AIRCRAFT_OUTLINES.commuter) {
                  if (!onApron({ x: state.position.x + scale * (x * c - y * s), y: state.position.y + scale * (x * s + y * c) }, [scene.layout.carrier.deck], 0)) outside++;
                }
              }
              if (state.phase === 'parked') { parked = state; break; }
            }
            runs.push({ zone: zone.id, attempt, reducedMotion: scene.motion.matches, parked: !!parked, stand: parked?.standId, maxGap, outside, scale:scene.groundScales.commuter, parkedAt:parked?.position });
          }
        }
        scene.renderer.render(scene.scene,scene.camera);
        return runs;
      }, { id, viewport, twoEndLanding, livery });
      for (const run of runs) {
        const label = `${size}/${id}/both-ends=${twoEndLanding}/${run.zone}/${run.attempt}`;
        assert.ok(run.parked, `${label}: did not park`);
        assert.ok(run.maxGap < 0.01, `${label}: guide gap ${run.maxGap}`);
        assert.equal(run.outside, 0, `${label}: airframe crossed deck edge ${JSON.stringify(run)}`);
      }
      if (['carrier-coast', 'blue-water', 'river-bend'].includes(id)) await page.locator('#audit-host').screenshot({ path: `${output}/${size}-${id}-${twoEndLanding}.png` });
      results.push({ size, id, twoEndLanding, livery, runs });
      console.log(`${size}/${id}/both-ends=${twoEndLanding}: ${runs.length} arrivals passed`);
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(`Passed ${results.reduce((sum, item) => sum + item.runs.length, 0)} landing-to-parking replays.`);
} finally {
  await browser.close();
}

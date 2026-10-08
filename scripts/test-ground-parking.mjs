import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Run against the Vite development server; uses disposable browser state.
const output = 'test-results/ground-parking';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined),
  args: ['--disable-gpu'],
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
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return type.includes('webgl') ? null : original.call(this, type, ...args);
      };
    });
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
        // Use the same Phaser module instance as PlayScene (required by its scene registry).
        const source = await (await fetch('/src/game/scenes/PlayScene.ts')).text();
        const { default: Phaser } = await import(source.match(/import Phaser from "([^"]+)"/)[1]);
        const { PlayScene } = await import('/src/game/scenes/PlayScene.ts');
        const { mapDefinitionById } = await import('/src/game/maps/registry.ts');
        const { worldSizeForViewport } = await import('/src/game/viewport.ts');
        const { AIRCRAFT_OUTLINES } = await import('/src/core/aircraftCollision.ts');
        const { onApron } = await import('/src/game/maps/shared/apronLayout.ts');
        const { taxiGuidePaths } = await import('/src/game/maps/shared/groundRoutes.ts');
        const { standApproaches } = await import('/src/game/rendering/shared-map/apronPainter.ts');
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Scene timed out: ${id}`)), 15000);
          window.auditGame = new Phaser.Game({
            type: Phaser.CANVAS, parent: host, ...worldSizeForViewport(viewport.width, viewport.height), banner: false,
            scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
            scene: [new PlayScene(mapDefinitionById(id), twoEndLanding, livery)],
          });
          window.auditGame.events.once('scene-ready', () => window.auditGame.events.once('postrender', () => { clearTimeout(timer); resolve(); }));
        });
        const scene = window.auditGame.scene.getScene('play');
        scene.scene.pause();
        const guides = [...taxiGuidePaths(scene.layout), ...standApproaches(scene.layout.groundRoutes).map((a) => a.points.slice(1))];
        // Straight runway taxi/back-taxi follows the existing runway axis marking.
        for (const r of scene.layout.runways) guides.push([-1, 1].map((sign) => ({ x: r.center.x + Math.cos(r.angle) * r.length * .5 * sign, y: r.center.y + Math.sin(r.angle) * r.length * .5 * sign })));
        const gap = (p, a, b) => {
          const dx = b.x - a.x, dy = b.y - a.y;
          const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
          return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
        };
        const runs = [];
        for (const zone of scene.layout.landingZones.filter((z) => z.approach)) {
          scene.startRun('medium', 'ground-review');
          const stands = scene.layout.groundRoutes[zone.id].stands;
          // Repeated arrivals cover all stands, occupied replacement, and reduced motion.
          for (let attempt = 0; attempt < stands.length + 2; attempt++) {
            const aircraftId = 1000 + attempt;
            scene.reducedMotion = attempt === stands.length + 1;
            scene.simulation.aircraft = [{ id: aircraftId, type: zone.accepts, position: { ...zone.position }, heading: zone.angle, speed: 90, collisionRadius: 18, state: 'landing', hasEntered: true, landingProgress: 0, landingZoneId: zone.id }];
            scene.simulation.nextSpawnAt = Infinity;
            let maxGap = 0, outside = 0, parked, pauseChecked = false;
            for (let frame = 0; frame < 3600; frame++) {
              scene.update(frame * 1000 / 60, 1000 / 60);
              const state = scene.groundTraffic.aircraft.find((a) => a.id === aircraftId);
              if (!state) continue;
              if (attempt === 0 && state.phase === 'taxiing' && !pauseChecked) {
                scene.pauseRun();
                const before = JSON.stringify(scene.groundTraffic.aircraft);
                host.style.width = `${viewport.width * .9}px`;
                window.auditGame.scale.refresh();
                scene.update(0, 500);
                if (JSON.stringify(scene.groundTraffic.aircraft) !== before) throw new Error(`${id}: ground traffic moved while paused/resizing`);
                host.style.width = '';
                window.auditGame.scale.refresh();
                scene.resumeRun();
                pauseChecked = true;
              }
              if (state.phase === 'taxiing') maxGap = Math.max(maxGap, Math.min(...guides.flatMap((path) => path.slice(1).map((b, i) => gap(state.position, path[i], b)))));
              if (['taxiing', 'parked'].includes(state.phase) && scene.layout.carrier && zone.accepts === 'commuter') {
                const scale = scene.groundViews.get(aircraftId).container.scaleX;
                const c = Math.cos(state.heading), s = Math.sin(state.heading);
                for (const [x, y] of AIRCRAFT_OUTLINES.commuter) {
                  if (!onApron({ x: state.position.x + scale * (x * c - y * s), y: state.position.y + scale * (x * s + y * c) }, [scene.layout.carrier.deck], 0)) outside++;
                }
              }
              if (state.phase === 'parked') { parked = state; break; }
            }
            runs.push({ zone: zone.id, attempt, reducedMotion: scene.reducedMotion, parked: !!parked, stand: parked?.standId, maxGap, outside });
          }
        }
        return runs;
      }, { id, viewport, twoEndLanding, livery });
      for (const run of runs) {
        const label = `${size}/${id}/both-ends=${twoEndLanding}/${run.zone}/${run.attempt}`;
        assert.ok(run.parked, `${label}: did not park`);
        assert.ok(run.maxGap < 0.01, `${label}: guide gap ${run.maxGap}`);
        assert.equal(run.outside, 0, `${label}: airframe crossed deck edge`);
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

import { describe, expect, it } from 'vitest';
import { SessionController } from '../../src/game/runtime/SessionController';
import { DEFAULT_TRAFFIC_PROFILE } from '../../src/core/trafficProfile';
import { DEFAULT_COLLISION_SCALES } from '../../src/core/aircraftCollision';
import { FrameMetrics, MemoryLedger, rgbaTextureBytes } from '../../src/game/runtime/diagnostics';
import { drawingSize, pointerToWorld } from '../../src/game/three/projection';
import { SALTMARSH_GEOMETRY } from '../../src/game/maps/saltmarsh-gateway/definition';
import { SALTMARSH_GATEWAY_DEFINITION } from '../../src/game/maps/saltmarsh-gateway';
import { DeferredRuntime } from '../../src/game/runtime/DeferredRuntime';
import { RuntimeEventBus } from '../../src/game/runtime/events';
import type { GameplayRuntime } from '../../src/game/runtime/types';
import { validateAtlasPng } from '../../src/game/three/atlasContract';
import { readFileSync } from 'node:fs';

const options = { zones: [{ id: 'pad', accepts: 'rotor' as const, label: 'H',
  position: { x: 450, y: 800 }, angle: 0, color: 0xffffff, captureRadius: 40 }],
world: { width: 900, height: 1600 }, traffic: DEFAULT_TRAFFIC_PROFILE, collisionScales: DEFAULT_COLLISION_SCALES };

describe('render-independent session continuity', () => {
  it('disposes a late-loading retired backend without forwarding events', async () => {
    let deliver!: (runtime: GameplayRuntime) => void;
    let destroyed = false;
    const runtime = new DeferredRuntime(options.world, () => new Promise(resolve => {deliver=resolve;}));
    const received: string[]=[];
    runtime.events.on('scene-ready',()=>received.push('ready'));
    runtime.destroy();
    const events=new RuntimeEventBus();
    deliver({world:options.world,events,running:false,getSession:()=>undefined,wake(){},sleep(){},captureFrame(){},destroy(){destroyed=true;}});
    await Promise.resolve();
    expect(destroyed).toBe(true);
    events.emit('scene-ready');
    expect(received).toEqual([]);
  });
  it('restores a seeded shift paused and continues identically with detached save state', () => {
    const first = new SessionController(options);
    first.start('medium', 'shift-1', 42);
    for (let frame = 0; frame < 120; frame++) first.simulation.update(1 / 60);
    first.drainEvents();
    first.simulation.pause();
    const saved = first.exportState();
    const next = new SessionController(options);
    expect(next.restore('medium', saved)).toBe(true);
    expect(next.exportState()).toEqual(saved);
    next.simulation.update(10);
    expect(next.exportState()).toEqual(saved);
    first.simulation.resume();
    next.simulation.resume();
    for (let frame = 0; frame < 60; frame++) {
      first.simulation.update(1 / 60);
      next.simulation.update(1 / 60);
    }
    expect(next.exportState()).toEqual(first.exportState());
    expect(saved.simulation).not.toEqual(next.exportState().simulation);
  });

  it('refuses unknown saved landing targets without altering the current session', () => {
    const session = new SessionController(options);
    session.start('medium', 'current', 42);
    const before = session.exportState();
    const invalid = structuredClone(before);
    expect(invalid.simulation.aircraft.length).toBeGreaterThan(0);
    invalid.simulation.aircraft[0].landingZoneId = 'missing';
    expect(session.restore('hard', invalid)).toBe(false);
    expect(session.exportState()).toEqual(before);
  });
});

describe('bounded diagnostics', () => {
  it('accepts the Blender atlas but rejects a decoded-size increase before image decoding', () => {
    const source=readFileSync('public/assets/three/saltmarsh-gateway/atlas.png');
    const bytes=source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength) as ArrayBuffer;
    expect(()=>validateAtlasPng(bytes)).not.toThrow();
    new DataView(bytes).setUint32(16,8192);
    expect(()=>validateAtlasPng(bytes)).toThrow(/512/);
  });
  it('caps drawing buffers for high-resolution and ultrawide worlds without changing hit coordinates', () => {
    for (const world of [{width:1600,height:900},{width:900,height:2400},{width:7680,height:2160}]) {
      const size=drawingSize(world);
      expect(size.width*size.height).toBeLessThanOrEqual(500_000);
      expect(pointerToWorld({x:350,y:250},{left:100,top:50,width:500,height:400},world)).toEqual({x:world.width/2,y:world.height/2});
    }
  });
  it('exposes the final prepared Saltmarsh geometry including settled pads and parking routes', () => {
    for(const [width,height] of [[1600,900],[900,1600],[1000,1000],[2100,900]]) {
      const {layout}=SALTMARSH_GEOMETRY.prepare({width,height,twoEndLanding:true,detailLevel:'mobile'});
      expect(layout).toEqual(SALTMARSH_GATEWAY_DEFINITION.prepare({width,height,twoEndLanding:true,detailLevel:'mobile'}).layout);
      const rotor=layout.landingZones.find(zone=>zone.accepts==='rotor')!;
      expect(layout.helipad.center).toEqual(rotor.position);
      expect(layout.apronMarkings?.stands.length).toBeGreaterThan(0);
      expect(Object.keys(layout.groundRoutes ?? {}).length).toBeGreaterThan(0);
      expect(layout.landingZones.filter(zone=>zone.approach).length).toBe(4);
    }
  });
  it('accounts texture mip chains including non-square and non-power-of-two sizes', () => {
    expect(rgbaTextureBytes(2048, 2048)).toBe(16_777_216);
    expect(rgbaTextureBytes(4, 2, true)).toBe(44);
    expect(rgbaTextureBytes(3, 1, true)).toBe(16);
    expect(() => rgbaTextureBytes(0, 5)).toThrow(RangeError);
  });
  it('replaces and releases resources without losing the peak or double-counting', () => {
    const ledger = new MemoryLedger();
    ledger.set('atlas', 100, 200);
    ledger.set('atlas', 0, 200);
    ledger.set('frame', 0, 400);
    expect(ledger.snapshot()).toEqual({ cpu: 0, gpu: 600, total: 600, peak: 600 });
    ledger.delete('frame');
    ledger.delete('frame');
    expect(ledger.snapshot()).toEqual({ cpu: 0, gpu: 200, total: 200, peak: 600 });
    expect(ledger.canAllocate(24_000_000 - 200)).toBe(false);
    expect(() => ledger.set('bad', NaN, 0)).toThrow(RangeError);
  });
  it('reports interval rates without accumulating pause time or lifetime call counts', () => {
    const metrics = new FrameMetrics();
    metrics.frame(0, 5);
    for (let frame = 1; frame <= 30; frame++) {
      metrics.record('simulation', 2);
      metrics.frame(frame * 1000 / 60, 5);
    }
    const sample = metrics.sample(500);
    expect(sample.fps).toBeCloseTo(60);
    expect(sample.systems[0].callsPerSecond).toBe(60);
    expect(sample.cpuPerFrame).toBe(2);
    expect(sample.drawCalls).toBe(5);
    metrics.reset();
    metrics.frame(30_000);
    metrics.frame(30_050);
    const resumed = metrics.sample(30_050);
    expect(resumed.fps).toBe(20);
    expect(resumed.slowFrames).toBe(1);
    expect(resumed.systems[0].callsPerSecond).toBe(0);
  });
});

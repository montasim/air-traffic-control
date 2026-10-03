import { expect, it } from 'vitest';
import { MAP_DEFINITIONS } from '../../src/game/maps/registry';
import { Simulation } from '../../src/core/Simulation';

for (const map of MAP_DEFINITIONS) for (const [width, height] of [[900,1600],[1600,900],[900,900],[1948,900]]) {
  it(`${map.id} ${width}x${height}: defaults to one end, enables both, and cannot land on a disabled end`, () => {
    const input = { width, height, detailLevel: 'desktop' as const };
    const single = map.prepare(input).layout;
    const both = map.prepare({ ...input, twoEndLanding: true }).layout;
    expect(map.prepare({ ...input, twoEndLanding: false }).layout).toEqual(single);
    expect(single.landingZones).toEqual(both.landingZones.filter(z => z.approach?.end !== 1));
    expect(single.guidanceSurfaces.map(s => s.zoneId)).toEqual(single.landingZones.map(z => z.id));
    expect(single.landingZones.filter(z => z.approach).every(z => z.approach?.end === 0)).toBe(true);
    for (const zone of both.landingZones.filter(z => z.approach)) {
      const sim = new Simulation(single.landingZones, { width, height });
      sim.start(11);
      const plane = sim.snapshot().aircraft[0];
      Object.assign(plane, { type: zone.accepts, position: { ...zone.position }, heading: zone.angle + Math.PI / 2, speed: 0, hasEntered: true });
      sim.drainEvents();
      sim.update(1/60);
      if (zone.approach?.end === 1) {
        expect(plane.state).not.toBe('landing');
      } else {
        expect(plane.state).toBe('landing');
        for (let i=0; i<60; i++) sim.update(1/60);
        expect(sim.snapshot().score).toBe(1);
      }
    }
  });
}

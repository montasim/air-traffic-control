import { expect, it } from 'vitest';
import { Simulation } from '../../src/core/Simulation';
import { MAP_DEFINITIONS } from '../../src/game/maps/registry';

const layout = MAP_DEFINITIONS.find(map => map.id === 'saltmarsh-gateway')!
  .prepare({ width: 1909, height: 929, detailLevel: 'desktop', twoEndLanding: true }).layout;

for (const zone of layout.landingZones.filter(zone => zone.approach)) {
  it(`Saltmarsh ${zone.label}: lands from sideways and aligned entries`, () => {
    for (const sideways of [true, false]) {
      const simulation = new Simulation(layout.landingZones, { width: 1909, height: 929 });
      simulation.start(11);
      const aircraft = simulation.snapshot().aircraft[0];
      const heading = sideways ? Math.PI / 2 : zone.angle;
      const start = {
        x: zone.position.x - Math.cos(heading) * zone.captureRadius * 1.5,
        y: zone.position.y - Math.sin(heading) * zone.captureRadius * 1.5,
      };
      Object.assign(aircraft, { type: zone.accepts, position: start, heading,
        speed: 100, state: 'flying', hasEntered: true });
      expect(simulation.assignRoute(aircraft.id, [start, zone.position], zone.id).accepted).toBe(true);
      simulation.drainEvents();
      for (let frame = 0; frame < 90; frame++) simulation.update(1 / 60);
      const events = simulation.drainEvents();
      expect(events).toContainEqual({ type: 'landing-started', aircraftId: aircraft.id, zoneId: zone.id });
      expect(simulation.snapshot().score).toBe(1);
    }
  });
}

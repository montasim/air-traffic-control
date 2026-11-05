import { describe, expect, it } from 'vitest';
import { Simulation } from '../../src/core/Simulation';
import { applyDifficulty, DIFFICULTIES } from '../../src/core/difficulty';
import { resolveTrafficProfile } from '../../src/core/trafficProfile';
import { MAP_DEFINITIONS } from '../../src/game/maps/registry';
import { trafficProfileById } from '../../src/game/maps/trafficProfiles';
import { profileForSize, worldSizeForViewport } from '../../src/game/viewport';

/**
 * Every map must be playable on large, medium and small screens, upright and on its side: each
 * landing area lies on screen and clear of the on-screen panels, every aircraft type the map flies
 * has somewhere to land, and an aircraft sent to each landing area actually lands there.
 */
const DEVICES = [
  ['large desktop', 1920, 1080], ['laptop', 1366, 768],
  ['tablet landscape', 1024, 768], ['tablet portrait', 768, 1024],
  ['phone portrait', 390, 844], ['phone landscape', 844, 390],
  ['iPhone SE portrait', 375, 667], ['iPhone SE landscape', 667, 375],
] as const;

describe('playable on every device size', () => {
  for (const map of MAP_DEFINITIONS) for (const [device, screenWidth, screenHeight] of DEVICES) for (const twoEndLanding of [false, true]) {
    it(`${map.id} on a ${device} (${screenWidth}x${screenHeight})${twoEndLanding ? ', both ends' : ''}`, () => {
      // The game fits each screen to its portrait or landscape world, as createGame does.
      const { width, height } = worldSizeForViewport(screenWidth, screenHeight);
      const layout = map.prepare({ width, height, detailLevel: profileForSize(screenWidth, screenHeight).detailLevel, twoEndLanding }).layout;
      for (const zone of layout.landingZones) {
        // On screen, with room for its capture ring.
        expect(zone.position.x, `${zone.id} x`).toBeGreaterThan(zone.captureRadius * 0.5);
        expect(zone.position.x, `${zone.id} x`).toBeLessThan(width - zone.captureRadius * 0.5);
        expect(zone.position.y, `${zone.id} y`).toBeGreaterThan(zone.captureRadius * 0.5);
        expect(zone.position.y, `${zone.id} y`).toBeLessThan(height - zone.captureRadius * 0.5);
        for (const hud of layout.hudExclusionZones) {
          const under = zone.position.x > hud.x && zone.position.x < hud.x + hud.width && zone.position.y > hud.y && zone.position.y < hud.y + hud.height;
          expect(under, `${zone.id} under the ${hud.id} panel`).toBe(false);
        }
      }
      for (const mode of DIFFICULTIES) {
        for (const { type } of applyDifficulty(trafficProfileById(map.trafficProfileId), mode).aircraftTypeWeights) {
          expect(layout.landingZones.some((zone) => zone.accepts === type), `a ${type} landing area on ${mode}`).toBe(true);
        }
      }
      for (const zone of layout.landingZones) {
        const profile = resolveTrafficProfile({ ...applyDifficulty(trafficProfileById(map.trafficProfileId), 'medium'), openingSpawns: [{ at: 0, type: zone.accepts }], spawnIntervalStages: [{ at: 0, interval: 999 }] });
        const simulation = new Simulation(layout.landingZones, { width, height }, profile);
        simulation.start(41);
        // The opening aircraft waits for a safe gap at the edge, as it does in play.
        for (let i = 0; i < 600 && simulation.snapshot().aircraft.length === 0; i += 1) simulation.update(1 / 60);
        const plane = simulation.snapshot().aircraft[0];
        expect(plane, `a ${zone.accepts} spawns for ${zone.id}`).toBeDefined();
        plane.position = { x: zone.position.x - Math.cos(zone.angle) * 90, y: zone.position.y - Math.sin(zone.angle) * 90 };
        plane.heading = zone.angle;
        plane.hasEntered = true;
        plane.state = 'flying';
        expect(simulation.assignRoute(plane.id, [{ ...plane.position }, { ...zone.position }], zone.id).accepted, `${zone.id} route`).toBe(true);
        for (let i = 0; i < 600 && simulation.snapshot().score === 0; i += 1) simulation.update(1 / 60);
        expect(simulation.snapshot().score, `${zone.id} landing`).toBe(1);
      }
    });
  }
});

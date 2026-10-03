import { describe, expect, it } from 'vitest';
import { Simulation } from '../../src/core/Simulation';
import { applyDifficulty, DIFFICULTIES } from '../../src/core/difficulty';
import { resolveTrafficProfile } from '../../src/core/trafficProfile';
import type { Vector2 } from '../../src/core/types';
import { FRONTIER_MAP_IDS } from '../../src/game/maps/mapIds';
import { MAP_DEFINITIONS } from '../../src/game/maps/registry';
import { pointInPolygon, rectsOverlap } from '../../src/game/maps/shared/apronLayout';
import type { Carrier } from '../../src/game/maps/shared/carrier';
import type { MapRunway } from '../../src/game/maps/shared/airfield';
import { trafficProfileById } from '../../src/game/maps/trafficProfiles';
import { runwayCorners } from '../../src/game/rendering/shared-map/geometry';

const SHAPES = [[1600, 900], [900, 1600], [900, 900], [844, 390], [1280, 720], [1600, 1520]] as const;
const definition = (id: string) => MAP_DEFINITIONS.find((map) => map.id === id)!;
// Each map's rich layout carries runways, and the carrier maps a carrier.
type FrontierLayout = { runways: MapRunway[]; carrier?: Carrier; hudExclusionZones: { x: number; y: number; width: number; height: number }[] };

describe('frontier maps', () => {
  for (const id of FRONTIER_MAP_IDS) for (const [width, height] of SHAPES) {
    it(`${id} ${width}x${height}: runways on screen and clear of the HUD; every traffic type has a destination`, () => {
      const layout = definition(id).prepare({ width, height, detailLevel: 'mobile' }).layout;
      const rich = layout as unknown as FrontierLayout;
      for (const runway of rich.runways) {
        for (const corner of runwayCorners(runway)) {
          expect(corner.x).toBeGreaterThan(0);
          expect(corner.x).toBeLessThan(width);
          expect(corner.y).toBeGreaterThan(0);
          expect(corner.y).toBeLessThan(height);
          for (const hud of rich.hudExclusionZones) {
            const inside = corner.x > hud.x && corner.x < hud.x + hud.width && corner.y > hud.y && corner.y < hud.y + hud.height;
            expect(inside, `${runway.id} under ${id} HUD`).toBe(false);
          }
        }
      }
      for (const zone of layout.landingZones) {
        expect(zone.position.x).toBeGreaterThan(0);
        expect(zone.position.x).toBeLessThan(width);
        expect(zone.position.y).toBeGreaterThan(0);
        expect(zone.position.y).toBeLessThan(height);
      }
      for (const mode of DIFFICULTIES) {
        for (const { type } of applyDifficulty(trafficProfileById(id), mode).aircraftTypeWeights) {
          expect(layout.landingZones.some((zone) => zone.accepts === type), `${id} has a ${type} destination`).toBe(true);
        }
      }
    });
  }

  for (const id of FRONTIER_MAP_IDS) for (const mode of DIFFICULTIES) for (const [width, height] of [[1600, 900], [900, 1600]] as const) {
    it(`${id} completes every landing destination on ${mode} at ${width}x${height}`, () => {
      const layout = definition(id).prepare({ width, height, detailLevel: 'desktop' }).layout;
      for (const zone of layout.landingZones) {
        const profile = resolveTrafficProfile({ ...applyDifficulty(trafficProfileById(id), mode), openingSpawns: [{ at: 0, type: zone.accepts }], spawnIntervalStages: [{ at: 0, interval: 999 }] });
        const simulation = new Simulation(layout.landingZones, { width, height }, profile);
        simulation.start(73);
        const plane = simulation.snapshot().aircraft[0];
        plane.position = { x: zone.position.x - Math.cos(zone.angle) * 100, y: zone.position.y - Math.sin(zone.angle) * 100 };
        plane.heading = zone.angle;
        plane.hasEntered = true;
        plane.state = 'flying';
        expect(simulation.assignRoute(plane.id, [{ ...plane.position }, { ...zone.position }], zone.id).accepted).toBe(true);
        for (let i = 0; i < 600 && simulation.snapshot().score === 0; i += 1) simulation.update(1 / 60);
        expect(simulation.snapshot().score, `${zone.id}`).toBe(1);
      }
    });
  }

  it('Frost Crossing runways cross each other, and the apron stays clear of both', () => {
    for (const [width, height] of SHAPES) {
      const layout = definition('frost-crossing').prepare({ width, height, detailLevel: 'desktop' }).layout as unknown as FrontierLayout & { apron: Vector2[] };
      const [liner, commuter] = layout.runways;
      const rect = (runway: MapRunway) => ({ center: runway.center, width: runway.length, height: runway.width, angle: runway.angle });
      expect(rectsOverlap(rect(liner), rect(commuter), 0)).toBe(true);
      for (const runway of layout.runways) for (const corner of layout.apron) {
        const dx = corner.x - runway.center.x;
        const dy = corner.y - runway.center.y;
        const along = Math.abs(dx * Math.cos(runway.angle) + dy * Math.sin(runway.angle));
        const across = Math.abs(-dx * Math.sin(runway.angle) + dy * Math.cos(runway.angle));
        if (along < runway.length / 2) expect(across).toBeGreaterThan(runway.width / 2);
      }
    }
  });

  for (const id of ['carrier-coast', 'blue-water'] as const) {
    it(`${id}: deck lanes, pads, and the island lie on the deck; the island keeps clear of every lane and pad`, () => {
      for (const [width, height] of SHAPES) {
        const { carrier } = definition(id).prepare({ width, height, detailLevel: 'desktop' }).layout as unknown as FrontierLayout;
        expect(carrier).toBeDefined();
        const deck = carrier!.deck;
        for (const runway of carrier!.runways) {
          expect(pointInPolygon(runway.center, deck)).toBe(true);
          const stern = { x: runway.center.x - Math.cos(runway.angle) * runway.length * 0.45, y: runway.center.y - Math.sin(runway.angle) * runway.length * 0.45 };
          expect(pointInPolygon(stern, deck)).toBe(true);
          expect(rectsOverlap(carrier!.island, { center: runway.center, width: runway.length, height: runway.width, angle: runway.angle }, 2)).toBe(false);
        }
        for (const pad of carrier!.helipads) {
          expect(pointInPolygon(pad.center, deck)).toBe(true);
          expect(rectsOverlap(carrier!.island, { center: pad.center, width: pad.radius * 2, height: pad.radius * 2, angle: 0 }, 0)).toBe(false);
        }
        expect(pointInPolygon(carrier!.island.center, deck)).toBe(true);
      }
    });
  }

  it('Blue Water has no liner destination and never spawns liners', () => {
    const layout = definition('blue-water').prepare({ width: 900, height: 1600, detailLevel: 'desktop' }).layout;
    expect(layout.landingZones.some((zone) => zone.accepts === 'liner')).toBe(false);
    for (const mode of DIFFICULTIES) {
      const simulation = new Simulation(layout.landingZones, { width: 900, height: 1600 }, applyDifficulty(trafficProfileById('blue-water'), mode));
      simulation.start(5);
      for (let i = 0; i < 60 * 90; i += 1) {
        simulation.update(1 / 60);
        expect(simulation.snapshot().aircraft.some((plane) => plane.type === 'liner')).toBe(false);
        if (simulation.snapshot().phase !== 'running') break;
      }
    }
  });
});

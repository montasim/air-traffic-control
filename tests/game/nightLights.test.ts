import { describe, expect, it } from 'vitest';
import { MAP_IDS } from '../../src/game/maps/mapIds';
import { mapDefinitionById } from '../../src/game/maps/registry';
import type { GuidanceSurface } from '../../src/game/maps/shared/guidance';
import { NIGHT_LIGHT_COLORS, nightLightPoints } from '../../src/game/rendering/NightRenderer';

const runway: GuidanceSurface = { kind: 'runway', runwayId: 'r', designators: ['09', '27'], zoneId: 'z', center: { x: 500, y: 300 }, angle: 0, length: 400, width: 30 };
const layout = (guidanceSurfaces: GuidanceSurface[]) => ({ width: 1000, height: 600, guidanceSurfaces });
const near = (x: number, y: number, color: number) => (light: { x: number; y: number; color: number }) =>
  light.color === color && Math.hypot(light.x - x, light.y - y) < 1;

describe('night lights', () => {
  it('lights the landing end green with an approach bar and the far end red', () => {
    const lights = nightLightPoints(layout([runway]));
    expect(lights.some(near(300, 300, NIGHT_LIGHT_COLORS.landing))).toBe(true);
    expect(lights.some(near(700, 300, NIGHT_LIGHT_COLORS.stop))).toBe(true);
    expect(lights.some((l) => l.color === NIGHT_LIGHT_COLORS.approach && l.x < 300)).toBe(true);
    expect(lights.some((l) => l.color === NIGHT_LIGHT_COLORS.approach && l.x > 700)).toBe(false);
  });

  it('lights both ends green once when the runway is landed from both ends', () => {
    const reverse: GuidanceSurface = { ...runway, zoneId: 'z-reverse', angle: Math.PI };
    const both = nightLightPoints(layout([runway, reverse]));
    expect(both.some(near(700, 300, NIGHT_LIGHT_COLORS.landing))).toBe(true);
    expect(both.some((l) => l.color === NIGHT_LIGHT_COLORS.stop)).toBe(false);
    const edges = (lights: typeof both) => lights.filter((l) => l.color === NIGHT_LIGHT_COLORS.edge).length;
    expect(edges(both)).toBe(edges(nightLightPoints(layout([runway]))));
  });

  it('rings a helipad at its radius', () => {
    const ring = nightLightPoints(layout([{ kind: 'pad', zoneId: 'h', center: { x: 100, y: 100 }, angle: 0, radius: 20 }]));
    expect(ring.length).toBe(10);
    for (const light of ring) expect(Math.hypot(light.x - 100, light.y - 100)).toBeCloseTo(20);
  });

  it.each(MAP_IDS)('puts a green threshold at the touchdown end of every runway on %s', (mapId) => {
    for (const twoEndLanding of [false, true]) {
      const { layout: map } = mapDefinitionById(mapId).prepare({ width: 1280, height: 720, detailLevel: 'desktop', twoEndLanding });
      const lights = nightLightPoints(map);
      for (const surface of map.guidanceSurfaces) {
        if (surface.kind !== 'runway') continue;
        const end = { x: surface.center.x - Math.cos(surface.angle) * surface.length / 2, y: surface.center.y - Math.sin(surface.angle) * surface.length / 2 };
        expect(lights.some((l) => l.color === NIGHT_LIGHT_COLORS.landing && Math.hypot(l.x - end.x, l.y - end.y) <= surface.width / 2 + 1)).toBe(true);
      }
    }
  });
});

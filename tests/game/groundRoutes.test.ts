import { describe, expect, it } from 'vitest';
import type { LandingZone, Vector2 } from '../../src/core/types';
import { MAP_DEFINITIONS } from '../../src/game/maps/registry';
import { createGroundRoutes, filletCorners, groundObstacles, PIVOT_TURN, segmentEntry, type GroundNetwork } from '../../src/game/maps/shared/groundRoutes';
import { DECK_LANE_CLEARANCE, deckRunwayIds, rectsOverlap, runwayApronGap } from '../../src/game/maps/shared/apronLayout';

const SHAPES = [[900, 1600], [1600, 900], [900, 900], [1948, 900], [1600, 1520], [1280, 720], [800, 1000]] as const;
const pathLength = (points: readonly Vector2[]) => points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
const insideRect = (point: Vector2, rect: { x: number; y: number; width: number; height: number }) =>
  point.x > rect.x && point.x < rect.x + rect.width && point.y > rect.y && point.y < rect.y + rect.height;

describe('ground routes on every playable map', () => {
  for (const map of MAP_DEFINITIONS) for (const [width, height] of SHAPES) for (const twoEndLanding of [false, true]) {
    it(`${map.id} ${width}x${height}${twoEndLanding ? ' both ends' : ''}: every runway end taxis to a reachable parking spot`, () => {
      const layout = map.prepare({ width, height, detailLevel: 'desktop', twoEndLanding }).layout;
      const routes = layout.groundRoutes ?? {};
      for (const zone of layout.landingZones.filter((item) => item.approach)) {
        const route = routes[zone.id];
        expect(route, `${zone.id} has a route`).toBeDefined();
        expect(route.points[0]).toEqual(zone.position);
        expect(route.rolloutLength).toBeGreaterThan(0);
        expect(route.rolloutLength).toBeLessThanOrEqual(pathLength(route.points) + 1);
        for (const point of route.points) {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(width);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThanOrEqual(height);
        }
        expect(route.stands.length).toBeGreaterThan(0);
        for (const stand of route.stands) {
          for (const hud of layout.hudExclusionZones) expect(insideRect(stand.position, hud), `${zone.id} stand ${stand.id} under ${hud.id}`).toBe(false);
        }
      }
      // Helipads keep settling in place.
      for (const zone of layout.landingZones.filter((item) => item.accepts === 'rotor')) expect(routes[zone.id]).toBeUndefined();
    });

    it(`${map.id} ${width}x${height}${twoEndLanding ? ' both ends' : ''}: typed stands that never overlap, in separate groups`, () => {
      const layout = map.prepare({ width, height, detailLevel: 'desktop', twoEndLanding }).layout;
      const markings = layout.apronMarkings!;
      expect(markings).toBeDefined();
      const types = new Set(layout.landingZones.filter((zone) => zone.approach).map((zone) => zone.accepts));
      for (const type of types) expect(markings.stands.some((stand) => stand.accepts === type), `${type} has a stand`).toBe(true);
      // Every route offers only stands of its own type.
      for (const zone of layout.landingZones.filter((item) => item.approach)) {
        for (const stand of layout.groundRoutes![zone.id].stands) expect(stand.accepts).toBe(zone.accepts);
      }
      const footprint = (stand: (typeof markings.stands)[number]) => ({ center: stand.position, width: stand.length, height: stand.width, angle: stand.angle });
      for (const [i, a] of markings.stands.entries()) {
        for (const b of markings.stands.slice(i + 1)) {
          // Same-type neighbours may not touch; the other type's group keeps a wider gap.
          const margin = a.accepts === b.accepts ? 0 : a.width * 0.25;
          expect(rectsOverlap(footprint(a), footprint(b), margin), `${a.id} vs ${b.id}`).toBe(false);
        }
      }
      // Every stand has a taxilane: no aircraft parks on a taxiway end.
      for (const lane of markings.taxilanes) expect(lane.path.length, `${lane.id} is a real taxilane`).toBeGreaterThan(1);
      // Each stand's guide path flows smoothly, never doubling back.
      for (const route of Object.values(layout.groundRoutes!)) {
        for (const stand of route.stands) {
          const points = stand.approach ?? [];
          for (let i = 2; i < points.length; i += 1) {
            const before = Math.atan2(points[i - 1].y - points[i - 2].y, points[i - 1].x - points[i - 2].x);
            const after = Math.atan2(points[i].y - points[i - 1].y, points[i].x - points[i - 1].x);
            expect(Math.abs(Math.atan2(Math.sin(after - before), Math.cos(after - before))), `${stand.id} turn ${i}`).toBeLessThan(PIVOT_TURN);
          }
        }
      }
    });

    it(`${map.id} ${width}x${height}${twoEndLanding ? ' both ends' : ''}: a realistic site with square connectors and nothing on runways or helipads`, () => {
      const layout = map.prepare({ width, height, detailLevel: 'desktop', twoEndLanding }).layout as any;
      const unit = Math.min(width, height);
      const gap = runwayApronGap(unit);
      const decks = deckRunwayIds(layout);
      const runways = layout.runways.map((runway: any) => ({ id: runway.id, center: runway.center, width: runway.length, height: runway.width, angle: runway.angle }));
      // Stands keep the grass strip beside every runway, or the foul line beside a carrier deck lane.
      for (const stand of layout.apronMarkings.stands) {
        for (const runway of runways) {
          const clearance = decks.has(runway.id) ? DECK_LANE_CLEARANCE : gap;
          expect(rectsOverlap({ center: stand.position, width: stand.length, height: stand.width, angle: stand.angle }, runway, clearance / 2), `${stand.id} near ${runway.id}`).toBe(false);
        }
      }
      // Runway connectors leave their runway at a right angle (carrier deck taxi lines are authored).
      for (const taxiway of layout.taxiways) {
        const runway = layout.runways.find((item: any) => taxiway.connects.includes(item.id));
        if (!runway || decks.has(runway.id) || taxiway.path.length !== 2) continue;
        const [a, b] = taxiway.path;
        const along = Math.abs(((b.x - a.x) * Math.cos(runway.angle) + (b.y - a.y) * Math.sin(runway.angle)) / Math.hypot(b.x - a.x, b.y - a.y));
        expect(along, `${taxiway.id} is square to ${runway.id}`).toBeLessThan(0.02);
      }
      // Buildings stay off runways and helipads.
      const pads = layout.landingZones.filter((zone: any) => zone.accepts === 'rotor');
      for (const [index, building] of groundObstacles(layout).entries()) {
        for (const runway of runways) expect(rectsOverlap(building, runway, 0), `building ${index} on ${runway.id}`).toBe(false);
        for (const pad of pads) {
          const dx = pad.position.x - building.center.x;
          const dy = pad.position.y - building.center.y;
          const localX = Math.abs(dx * Math.cos(building.angle) + dy * Math.sin(building.angle)) - building.width / 2;
          const localY = Math.abs(-dx * Math.sin(building.angle) + dy * Math.cos(building.angle)) - building.height / 2;
          expect(Math.hypot(Math.max(0, localX), Math.max(0, localY)), `building ${index} on ${pad.id}`).toBeGreaterThan(pad.captureRadius * 0.7);
        }
      }
    });
  }
});

const zone = (id: string, x: number, angle: number): LandingZone => ({ id, label: id, accepts: 'liner', position: { x, y: 500 }, angle, captureRadius: 40, color: 0, approach: { runwayId: 'strip', end: angle === 0 ? 0 : 1 } });
const network = (junctionX: number): GroundNetwork => ({
  runways: [{ id: 'strip', center: { x: 500, y: 500 }, length: 600, width: 30, angle: 0 }],
  taxiways: [{ path: [{ x: junctionX, y: 500 }, { x: junctionX, y: 650 }], connects: ['strip', 'apron'] }],
  parkingStands: [{ id: 'stand-1', position: { x: junctionX + 40, y: 680 }, angle: -Math.PI / 2 }],
});

describe('ground route geometry', () => {
  it('rolls out in the landing direction and leaves by the first exit far enough ahead', () => {
    const routes = createGroundRoutes([zone('west', 300, 0)], network(560), 900);
    const route = routes.west;
    expect(route.points[0]).toEqual({ x: 300, y: 500 });
    expect(route.rolloutLength).toBeCloseTo(260);
    expect(route.points[route.points.length - 1]).toEqual({ x: 560, y: 650 });
    expect(route.stands.map((stand) => stand.id)).toEqual(['stand-1']);
  });

  it('rolls on, pivots, and back-taxis when the exit is behind the touchdown point', () => {
    const route = createGroundRoutes([zone('east', 700, Math.PI)], network(760), 900).east;
    // Rolls west past the exit, stops near the far end, then reverses toward x=760.
    const stop = route.points.find((point, index) => index > 0 && point.x < 700);
    expect(stop!.x).toBeLessThan(300);
    expect(route.points.some((point) => Math.abs(point.x - 760) < 1)).toBe(true);
  });

  it('parks at the route end when no stand is reachable without crossing the runway', () => {
    const blocked = { ...network(560), parkingStands: [{ id: 'across', position: { x: 560, y: 400 }, angle: 0 }] };
    const route = createGroundRoutes([zone('west', 300, 0)], blocked, 900).west;
    expect(route.stands).toHaveLength(1);
    expect(route.stands[0].position).toEqual({ x: 560, y: 650 });
    expect(route.stands[0].angle).toBeCloseTo(Math.PI / 2);
  });

  it('stops short of a building in the taxi path', () => {
    const route = createGroundRoutes([zone('west', 300, 0)], network(560), 900, [{ center: { x: 560, y: 640 }, width: 60, height: 40, angle: 0 }]).west;
    const end = route.points[route.points.length - 1];
    expect(end.y).toBeLessThan(620);
    expect(end.y).toBeGreaterThan(500);
  });

  it('rounds ordinary corners but keeps reversals sharp for a pivot', () => {
    const rounded = filletCorners([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 20);
    expect(rounded.length).toBeGreaterThan(3);
    expect(rounded.some((point) => point.x === 100 && point.y === 0)).toBe(false);
    const reversal = filletCorners([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 20, y: 5 }], 20);
    expect(reversal).toHaveLength(3);
    expect(PIVOT_TURN).toBeGreaterThan(Math.PI / 2);
  });

  it('finds where a segment enters a rotated rectangle', () => {
    const rect = { center: { x: 50, y: 0 }, width: 20, height: 20, angle: 0 };
    expect(segmentEntry({ x: 0, y: 0 }, { x: 100, y: 0 }, rect)).toBeCloseTo(0.4);
    expect(segmentEntry({ x: 0, y: 30 }, { x: 100, y: 30 }, rect)).toBeUndefined();
  });
});

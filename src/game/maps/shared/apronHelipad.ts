import type { Vector2 } from '../../../core/types';
import type { PlayableMapLayout } from '../types';
import { apronPolygons, pointInPolygon, rectCorners, rectsOverlap, runwayApronGap, segmentHitsRect, standFootprint } from './apronLayout';
import { groundObstacles, type GroundNetwork, type GroundObstacle } from './groundRoutes';

type Pad = { readonly center: Vector2; readonly radius: number; readonly zoneId: string };
type WithPads = PlayableMapLayout & GroundNetwork & {
  readonly helipad?: Pad;
  readonly helipads?: readonly Pad[];
};

/**
 * Sets each helipad down on the apron, as on Saltmarsh Gateway, so helicopters need no taxi link.
 * It runs once buildings and stands are placed, taking the free spot nearest the apron's middle that
 * is clear of stands, taxi lines, buildings, taxiways, runways and the HUD, so it never costs a
 * stand. A pad with no room anywhere keeps its authored place.
 */
export function settleHelipadsOnApron<T extends WithPads>(layout: T, unit: number): T {
  if (!layout.helipadsOnApron) return layout;
  const pads = layout.helipads ?? (layout.helipad ? [layout.helipad] : []);
  const aprons = apronPolygons(layout, 'land');
  const markings = layout.apronMarkings;
  const blockers: GroundObstacle[] = [
    ...groundObstacles(layout),
    ...(markings?.stands ?? []).map(standFootprint),
    ...layout.hudExclusionZones.map((zone) => ({ center: { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 }, width: zone.width, height: zone.height, angle: 0 })),
  ];
  const runways = layout.runways.map((runway) => ({ center: runway.center, width: runway.length, height: runway.width, angle: runway.angle }));
  const lines = [
    ...(markings?.taxilanes ?? []).map((lane) => ({ path: lane.path, half: unit * 0.006 })),
    ...layout.taxiways.map((taxiway) => ({ path: taxiway.path, half: ((taxiway as { width?: number }).width ?? unit * 0.017) / 2 })),
  ];
  const open = (rect: GroundObstacle) => !blockers.some((other) => rectsOverlap(rect, other, unit * 0.004));
  const paveable = (rect: GroundObstacle) =>
    !runways.some((other) => rectsOverlap(rect, other, runwayApronGap(unit) / 2))
    && !lines.some(({ path, half }) => path.some((a, i) => i > 0 && segmentHitsRect(path[i - 1], a, rect, half)))
    && rectCorners(rect).every((corner) => corner.x >= 4 && corner.y >= 4 && corner.x <= layout.width - 4 && corner.y <= layout.height - 4);
  const clear = (rect: GroundObstacle) => open(rect) && paveable(rect);
  const settled = new Map<string, Vector2>();
  let pocket: Vector2[] | undefined;
  const step = unit * 0.01;
  for (const pad of pads) {
    // The painted ring is 1.14× the pad; a little more keeps it off its neighbours.
    const reach = pad.radius * 1.14 + unit * 0.008;
    const apart = (center: Vector2) => [...settled.values()].every((other) => Math.hypot(other.x - center.x, other.y - center.y) >= reach * 2);
    let best: { center: Vector2; score: number; pocket?: Vector2[] } | undefined;
    for (const apron of aprons) {
      const middle = apron.reduce((sum, p) => ({ x: sum.x + p.x / apron.length, y: sum.y + p.y / apron.length }), { x: 0, y: 0 });
      const xs = apron.map((p) => p.x);
      const ys = apron.map((p) => p.y);
      for (let x = Math.min(...xs) + reach; x <= Math.max(...xs) - reach; x += step) {
        for (let y = Math.min(...ys) + reach; y <= Math.max(...ys) - reach; y += step) {
          const center = { x, y };
          const score = Math.hypot(x - middle.x, y - middle.y);
          if (best && score >= best.score) continue;
          const square: GroundObstacle = { center, width: reach * 2, height: reach * 2, angle: 0 };
          if (!rectCorners(square).every((corner) => pointInPolygon(corner, apron)) || !clear(square) || !apart(center)) continue;
          best = { center, score };
        }
      }
    }
    // A full apron: set the pad just past an edge and pave a pocket out to it, as Gateway's longer
    // apron does, so it still reads as part of the apron. One pocket per map.
    if (!best && !pocket) {
      for (const apron of aprons) {
        const middle = apron.reduce((sum, p) => ({ x: sum.x + p.x / apron.length, y: sum.y + p.y / apron.length }), { x: 0, y: 0 });
        apron.forEach((a, i) => {
          const b = apron[(i + 1) % apron.length];
          const length = Math.hypot(b.x - a.x, b.y - a.y);
          if (length < reach) return;
          const along = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
          let out = { x: -along.y, y: along.x };
          if ((middle.x - a.x) * out.x + (middle.y - a.y) * out.y > 0) out = { x: -out.x, y: -out.y };
          // A short edge (an apron's end) can still take a pocket centred on it.
          const first = Math.min(reach, length / 2);
          for (let s = first; s <= Math.max(first, length - reach); s += step) {
            for (const off of [reach * 0.7, reach, reach * 1.3, reach * 1.8, reach * 2.5]) {
              const base = { x: a.x + along.x * s, y: a.y + along.y * s };
              const center = { x: base.x + out.x * off, y: base.y + out.y * off };
              const score = unit + Math.hypot(center.x - middle.x, center.y - middle.y);
              if (best && score >= best.score) continue;
              const angle = Math.atan2(along.y, along.x);
              const band = (from: number, to: number): GroundObstacle => ({ center: { x: base.x + out.x * (from + to) / 2, y: base.y + out.y * (from + to) / 2 }, width: reach * 2, height: to - from, angle });
              // The pocket only has to stay off runways, taxi lines and the screen edge: buildings and
              // stands are drawn on top of it, so it may run under one at the apron's end. The pad
              // itself must be clear of everything.
              const pad = { center, width: reach * 2, height: reach * 2, angle };
              if (!paveable(band(unit * 0.008, off + reach)) || !open(pad) || !apart(center)) continue;
              best = { center, score, pocket: rectCorners(band(-reach * 0.2, off + reach)) };
            }
          }
        });
      }
    }
    if (best) settled.set(pad.zoneId, best.center);
    if (best?.pocket) pocket = best.pocket;
  }
  if (!settled.size) return layout;
  const move = <P extends Pad>(pad: P): P => (settled.has(pad.zoneId) ? { ...pad, center: settled.get(pad.zoneId)! } : pad);
  return {
    ...layout,
    // Ends in "Apron", so painters and stand checks treat it as apron.
    ...(pocket ? { helipadApron: pocket } : {}),
    ...(layout.helipad ? { helipad: move(layout.helipad) } : {}),
    ...(layout.helipads ? { helipads: layout.helipads.map(move) } : {}),
    landingZones: layout.landingZones.map((zone) => (settled.has(zone.id) ? { ...zone, position: settled.get(zone.id)! } : zone)),
    guidanceSurfaces: layout.guidanceSurfaces.map((surface) =>
      surface.zoneId && settled.has(surface.zoneId) && 'center' in surface ? { ...surface, center: settled.get(surface.zoneId)! } : surface),
  };
}

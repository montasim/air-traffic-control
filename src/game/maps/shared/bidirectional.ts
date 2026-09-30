import type { PlayableMapLayout } from '../types';

/** Expand authored thresholds once, at the map boundary; scenery keeps its original geometry. */
export function withBidirectionalApproaches<T extends PlayableMapLayout>(layout: T): T {
  const landingZones = layout.landingZones.flatMap(zone => {
    const surface = layout.guidanceSurfaces.find(s => s.zoneId === zone.id);
    if (surface?.kind !== 'runway' || !surface.runwayId || !surface.designators) return [zone];
    const approach = { runwayId: surface.runwayId, end: 0 as const };
    return [
      { ...zone, label: surface.designators[0], approach },
      { ...zone, id: `${zone.id}-reverse`, label: surface.designators[1],
        position: { x: 2 * surface.center.x - zone.position.x, y: 2 * surface.center.y - zone.position.y },
        angle: Math.atan2(Math.sin(zone.angle + Math.PI), Math.cos(zone.angle + Math.PI)),
        approach: { ...approach, end: 1 as const } }
    ];
  });
  const guidanceSurfaces = layout.guidanceSurfaces.flatMap(surface =>
    surface.kind === 'runway' && surface.runwayId && surface.designators
      ? [surface, { ...surface, zoneId: `${surface.zoneId}-reverse`, angle: Math.atan2(Math.sin(surface.angle + Math.PI), Math.cos(surface.angle + Math.PI)) }]
      : [surface]);
  return { ...layout, landingZones, guidanceSurfaces };
}

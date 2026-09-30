import type { Aircraft, LandingZone, Vector2 } from './types';

/** Reserve nearby runway space without imposing a heading requirement. */
export function onFinal(plane: Aircraft, zone: LandingZone): boolean {
  return Math.hypot(plane.position.x - zone.position.x, plane.position.y - zone.position.y) <= 2 * zone.captureRadius;
}

/** Normal proximity landing, including a capture area crossed between steps. */
export function crossesCapture(previous: Vector2, plane: Aircraft, zone: LandingZone): boolean {
  const dx = plane.position.x - previous.x, dy = plane.position.y - previous.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1,
    ((zone.position.x - previous.x) * dx + (zone.position.y - previous.y) * dy) / length)) : 0;
  return Math.hypot(previous.x + t * dx - zone.position.x, previous.y + t * dy - zone.position.y) <= zone.captureRadius;
}
export interface RunwayReservation { runwayId: string; aircraftId: number; zoneId: string }
export interface ApproachWarning { aircraftId: number; zoneId: string; reason: 'busy' }

export class RunwayTraffic {
  readonly reservations = new Map<string, RunwayReservation>();
  warnings: ApproachWarning[] = [];
  clear(): void { this.reservations.clear(); this.warnings = []; }
  release(aircraftId: number): void {
    for (const [id, r] of this.reservations) if (r.aircraftId === aircraftId) this.reservations.delete(id);
  }
  update(planes: readonly Aircraft[], zones: readonly LandingZone[], previous: ReadonlyMap<number, Vector2>): void {
    const eligible = (p: Aircraft, z: LandingZone) => z.accepts === p.type && (!(p.approachZoneId ?? p.route?.destinationZoneId) || (p.approachZoneId ?? p.route?.destinationZoneId) === z.id);
    for (const [id, r] of this.reservations) {
      const p = planes.find(p => p.id === r.aircraftId), z = zones.find(z => z.id === r.zoneId);
      if (!p || !z || (p.state !== 'landing' && (!eligible(p, z) || (!onFinal(p, z) && !crossesCapture(previous.get(p.id) ?? p.position, p, z))))) this.reservations.delete(id);
    }
    const candidates = planes.filter(p => p.state !== 'landing').flatMap(p => zones.filter(z => z.approach && eligible(p, z) && (onFinal(p, z) || crossesCapture(previous.get(p.id) ?? p.position, p, z))).map(z => ({ p, z, distance: Math.hypot(p.position.x-z.position.x,p.position.y-z.position.y) })));
    candidates.sort((a,b) => {
      const distanceDifference = a.distance - b.distance;
      return (Math.abs(distanceDifference) > 1e-8 ? distanceDifference : 0) || a.p.id-b.p.id || a.z.id.localeCompare(b.z.id);
    });
    for (const {p,z} of candidates) {
      const runwayId = z.approach!.runwayId;
      if (!this.reservations.has(runwayId) && ![...this.reservations.values()].some(r => r.aircraftId === p.id)) this.reservations.set(runwayId,{ runwayId, aircraftId:p.id, zoneId:z.id });
    }
    this.warnings = [];
    for (const p of planes.filter(p => p.state !== 'landing')) {
      for (const z of zones.filter(z => z.approach && eligible(p,z))) {
        if (Math.hypot(p.position.x-z.position.x,p.position.y-z.position.y) > z.captureRadius * 4) continue;
        const owner = this.reservations.get(z.approach!.runwayId);
        if (owner && owner.aircraftId !== p.id) this.warnings.push({aircraftId:p.id,zoneId:z.id,reason:'busy'});
      }
    }
  }
}

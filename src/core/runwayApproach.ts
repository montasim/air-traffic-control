import type { Aircraft, LandingZone, Vector2 } from './types';

export const APPROACH_ANGLE_TOLERANCE = Math.PI / 6;
export function aligned(heading: number, zone: LandingZone): boolean {
  return Math.abs(Math.atan2(Math.sin(heading - zone.angle), Math.cos(heading - zone.angle))) <= APPROACH_ANGLE_TOLERANCE + 1e-9;
}
export function approachCoordinates(point: Vector2, zone: LandingZone) {
  const dx = point.x - zone.position.x, dy = point.y - zone.position.y;
  return { along: dx * Math.cos(zone.angle) + dy * Math.sin(zone.angle), across: -dx * Math.sin(zone.angle) + dy * Math.cos(zone.angle) };
}
export function onFinal(plane: Aircraft, zone: LandingZone): boolean {
  const p = approachCoordinates(plane.position, zone);
  return aligned(plane.heading, zone) && p.along >= -2 * zone.captureRadius && p.along <= 0 && Math.abs(p.across) <= zone.captureRadius;
}
export function crossesCapture(previous: Vector2, plane: Aircraft, zone: LandingZone): boolean {
  if (!aligned(plane.heading, zone)) return false;
  const start = approachCoordinates(previous, zone), end = approachCoordinates(plane.position, zone);
  // Only an inward entry from the outside half can capture, including swept steps.
  if (start.along > 0 || end.along < start.along) return false;
  const dx = end.along - start.along, dy = end.across - start.across;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, -(start.along * dx + start.across * dy) / length)) : 0;
  return Math.hypot(start.along + t * dx, start.across + t * dy) <= zone.captureRadius;
}
export interface RunwayReservation { runwayId: string; aircraftId: number; zoneId: string }
export interface ApproachWarning { aircraftId: number; zoneId: string; reason: 'busy' | 'alignment' }

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
        const local = approachCoordinates(p.position,z);
        if (Math.hypot(local.along,local.across) > z.captureRadius * 4) continue;
        const owner = this.reservations.get(z.approach!.runwayId);
        if (owner && owner.aircraftId !== p.id) this.warnings.push({aircraftId:p.id,zoneId:z.id,reason:'busy'});
        else if ((p.approachZoneId ?? p.route?.destinationZoneId) === z.id && (!aligned(p.heading,z) || local.along > 0)) this.warnings.push({aircraftId:p.id,zoneId:z.id,reason:'alignment'});
      }
    }
  }
}

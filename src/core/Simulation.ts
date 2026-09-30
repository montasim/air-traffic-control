import { RunwayTraffic, crossesCapture } from './runwayApproach';
import { aircraftWarningDistance, airframesOverlap, DEFAULT_COLLISION_SCALES, type AircraftCollisionScales } from './aircraftCollision';
import { distance, simplifyPoints, smoothPath } from './geometry';
import {
  aircraftTypeAt,
  aircraftSpeed,
  AIRCRAFT_PHYSICS,
  spawnIntervalAt,
  trafficLimitAt
} from './pacing';
import {
  DEFAULT_TRAFFIC_PROFILE,
  type ResolvedSpawnCorridor,
  type ResolvedTrafficProfile,
  type SpawnEdge
} from './trafficProfile';
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Aircraft,
  type AircraftType,
  type GameOverReason,
  type LandingZone,
  type RouteAssignmentResult,
  type SimulationEvent,
  type SimulationSnapshot,
  type Vector2
} from './types';

const FIXED_STEP = 1 / 60;

// The shared heading drives both the visible airframe and its collision polygon.
function turnToward(current: number, target: number, delta: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  const limit = 4 * delta;
  return current + Math.max(-limit, Math.min(limit, difference));
}
const MAX_FRAME_DELTA = 0.1;
const MIN_SPAWN_SEPARATION = 180;
const MIN_DESTINATION_DISTANCE = 480;
const SAFE_SPAWN_HORIZON = 8;
const SAFE_PREDICTED_SEPARATION = 120;
const SPAWN_ATTEMPTS = 24;

interface SimulationBounds {
  width: number;
  height: number;
}

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x1_0000_0000;
  }

  between(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  pick<T>(values: readonly T[]): T {
    return values[Math.floor(this.next() * values.length)];
  }
}

export class Simulation {
  private readonly zones: readonly LandingZone[];
  private readonly bounds: SimulationBounds;
  private readonly trafficProfile: ResolvedTrafficProfile;
  private random = new SeededRandom(1);
  private accumulator = 0;
  private nextSpawnAt = Number.POSITIVE_INFINITY;
  private openingSpawnIndex = 0;
  private nextAircraftId = 1;
  private events: SimulationEvent[] = [];
  private runwayTraffic = new RunwayTraffic();
  private approachWarningKeys = new Set<string>();
  private activeWarnings = new Set<string>();

  private phase: SimulationSnapshot['phase'] = 'idle';
  private elapsed = 0;
  private score = 0;
  private aircraft: Aircraft[] = [];

  constructor(
    zones: readonly LandingZone[],
    bounds: SimulationBounds = { width: WORLD_WIDTH, height: WORLD_HEIGHT },
    trafficProfile: ResolvedTrafficProfile = DEFAULT_TRAFFIC_PROFILE,
    private readonly collisionScales: AircraftCollisionScales = DEFAULT_COLLISION_SCALES
  ) {
    this.zones = zones;
    this.bounds = { ...bounds };
    this.trafficProfile = trafficProfile;
  }

  start(seed = Date.now()): void {
    this.random = new SeededRandom(seed);
    this.accumulator = 0;
    this.nextSpawnAt = Number.POSITIVE_INFINITY;
    this.openingSpawnIndex = 0;
    this.nextAircraftId = 1;
    this.events = [];
    this.activeWarnings.clear();
    this.runwayTraffic.clear();
    this.approachWarningKeys.clear();
    this.phase = 'running';
    this.elapsed = 0;
    this.score = 0;
    this.aircraft = [];
    const firstOpening = this.trafficProfile.openingSpawns[0];
    if (firstOpening?.at === 0 && this.spawnAircraft(firstOpening.type)) {
      this.openingSpawnIndex = 1;
    }
    this.nextSpawnAt = this.trafficProfile.openingSpawns[this.openingSpawnIndex]?.at ??
      spawnIntervalAt(0, this.trafficProfile);
  }

  pause(): void {
    if (this.phase === 'running') this.phase = 'paused';
  }

  resume(): void {
    if (this.phase === 'paused') this.phase = 'running';
  }

  update(deltaSeconds: number): void {
    if (this.phase !== 'running') return;

    this.accumulator += Math.min(deltaSeconds, MAX_FRAME_DELTA);
    while (this.accumulator >= FIXED_STEP && this.phase === 'running') {
      this.step(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
  }

  assignRoute(
    aircraftId: number,
    drawnPoints: readonly Vector2[],
    destinationZoneId?: string
  ): RouteAssignmentResult {
    if (this.phase !== 'running') {
      return { accepted: false, aircraftId, reason: 'simulation-inactive', destinationZoneId };
    }
    const target = this.aircraft.find((item) => item.id === aircraftId);
    if (!target) {
      return { accepted: false, aircraftId, reason: 'aircraft-not-found', destinationZoneId };
    }
    if (target.state === 'landing') {
      return { accepted: false, aircraftId, reason: 'aircraft-landing', destinationZoneId };
    }
    if (drawnPoints.length < 2) {
      return { accepted: false, aircraftId, reason: 'insufficient-points', destinationZoneId };
    }

    const destination = destinationZoneId
      ? this.zones.find((zone) => zone.id === destinationZoneId)
      : undefined;
    if (destinationZoneId && !destination) {
      return { accepted: false, aircraftId, reason: 'destination-not-found', destinationZoneId };
    }
    if (destination && destination.accepts !== target.type) {
      return { accepted: false, aircraftId, reason: 'wrong-destination', destinationZoneId };
    }

    const routePoints = drawnPoints.map((point) => ({ ...point }));
    if (destination) routePoints[routePoints.length - 1] = { ...destination.position };

    const points = simplifyPoints([{ ...target.position }, ...routePoints.slice(1)], 10);
    if (points.length < 2 || distance(points[0], points[points.length - 1]) < 24) {
      return { accepted: false, aircraftId, reason: 'route-too-short', destinationZoneId };
    }

    if ((target.approachZoneId ?? target.route?.destinationZoneId) !== destinationZoneId) this.runwayTraffic.release(target.id);
    target.approachZoneId = destinationZoneId;
    target.route = {
      points: smoothPath(points, 2),
      segmentIndex: 1,
      destinationZoneId
    };
    return { accepted: true, aircraftId, destinationZoneId };
  }

  snapshot(): SimulationSnapshot {
    return {
      phase: this.phase,
      elapsed: this.elapsed,
      score: this.score,
      runwayReservations: [...this.runwayTraffic.reservations.values()],
      approachWarnings: this.runwayTraffic.warnings,
      aircraft: this.aircraft
    };
  }

  drainEvents(): SimulationEvent[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }

  private step(delta: number): void {
    this.elapsed += delta;

    if (this.elapsed + 1e-9 >= this.nextSpawnAt) this.processScheduledSpawn();

    const previous = new Map(this.aircraft.map(p => [p.id, { ...p.position }]));
    const destinations = new Map(this.aircraft.map(p => [p.id, p.approachZoneId ?? p.route?.destinationZoneId]));
    for (const aircraft of [...this.aircraft]) {
      if (aircraft.state === 'landing') this.advanceLanding(aircraft, delta);
      else this.advanceAircraft(aircraft, delta);
    }
    this.runwayTraffic.update(this.aircraft, this.zones, previous);
    const warningKeys = new Set<string>();
    for (const warning of this.runwayTraffic.warnings) {
      const key = `${warning.aircraftId}:${warning.zoneId}:${warning.reason}`;
      warningKeys.add(key);
      if (!this.approachWarningKeys.has(key)) this.events.push({ type: 'approach-warning', ...warning });
    }
    this.approachWarningKeys = warningKeys;
    for (const aircraft of this.aircraft) {
      if (aircraft.state === 'landing') continue;
      this.detectLanding(aircraft, previous.get(aircraft.id) ?? aircraft.position, destinations.get(aircraft.id));
      this.detectAirspaceExit(aircraft);
      if (this.phase !== 'running') return;
    }

    this.detectSeparation();
  }

  private advanceAircraft(aircraft: Aircraft, delta: number): void {
    let remaining = aircraft.speed * delta;
    let routeHeading = aircraft.heading;

    while (remaining > 0 && aircraft.route) {
      const target = aircraft.route.points[aircraft.route.segmentIndex];
      if (!target) {
        aircraft.route = undefined;
        break;
      }

      const dx = target.x - aircraft.position.x;
      const dy = target.y - aircraft.position.y;
      const segmentDistance = Math.hypot(dx, dy);

      if (segmentDistance < 0.001) {
        aircraft.route.segmentIndex += 1;
        continue;
      }

      routeHeading = Math.atan2(dy, dx);
      if (segmentDistance <= remaining) {
        aircraft.position.x = target.x;
        aircraft.position.y = target.y;
        remaining -= segmentDistance;
        aircraft.route.segmentIndex += 1;
      } else {
        const ratio = remaining / segmentDistance;
        aircraft.position.x += dx * ratio;
        aircraft.position.y += dy * ratio;
        remaining = 0;
      }
    }

    if (!aircraft.route && remaining > 0) {
      aircraft.position.x += Math.cos(routeHeading) * remaining;
      aircraft.position.y += Math.sin(routeHeading) * remaining;
    }

    aircraft.heading = turnToward(aircraft.heading, routeHeading, delta);

    if (
      aircraft.position.x >= 0 &&
      aircraft.position.x <= this.bounds.width &&
      aircraft.position.y >= 0 &&
      aircraft.position.y <= this.bounds.height
    ) {
      aircraft.hasEntered = true;
      if (aircraft.state === 'entering') aircraft.state = 'flying';
    }
  }

  private advanceLanding(aircraft: Aircraft, delta: number): void {
    const zone = this.zones.find((item) => item.id === aircraft.landingZoneId);
    if (!zone) return;

    aircraft.landingProgress += delta / 0.72;
    const pull = Math.min(1, delta * 5);
    aircraft.position.x += (zone.position.x - aircraft.position.x) * pull;
    aircraft.position.y += (zone.position.y - aircraft.position.y) * pull;
    aircraft.heading = turnToward(aircraft.heading, zone.angle, delta);

    if (aircraft.landingProgress >= 1) {
      this.aircraft = this.aircraft.filter((item) => item.id !== aircraft.id);
      this.runwayTraffic.release(aircraft.id);
      this.score += 1;
      this.events.push({ type: 'landed', aircraftId: aircraft.id, aircraftType: aircraft.type, score: this.score });
    }
  }

  private detectLanding(aircraft: Aircraft, previous: Vector2, destinationId?: string): void {
    for (const zone of this.zones) {
      if (zone.accepts !== aircraft.type) continue;
      if (destinationId && zone.id !== destinationId) continue;
      if (zone.approach) {
        if (!crossesCapture(previous, aircraft, zone)) continue;
        const owner = this.runwayTraffic.reservations.get(zone.approach.runwayId);
        if (owner?.aircraftId !== aircraft.id || owner.zoneId !== zone.id) continue;
      } else if (distance(aircraft.position, zone.position) > zone.captureRadius) continue;

      aircraft.state = 'landing';
      aircraft.route = undefined;
      aircraft.landingZoneId = zone.id;
      aircraft.landingProgress = 0;
      this.events.push({ type: 'landing-started', aircraftId: aircraft.id, zoneId: zone.id });
      return;
    }
  }

  private detectAirspaceExit(aircraft: Aircraft): void {
    if (!aircraft.hasEntered) return;
    const margin = 82;
    if (
      aircraft.position.x < -margin ||
      aircraft.position.x > this.bounds.width + margin ||
      aircraft.position.y < -margin ||
      aircraft.position.y > this.bounds.height + margin
    ) {
      this.endGame('airspace', undefined, { ...aircraft.position });
    }
  }

  private detectSeparation(): void {
    const nextWarnings = new Set<string>();

    for (let firstIndex = 0; firstIndex < this.aircraft.length; firstIndex += 1) {
      const first = this.aircraft[firstIndex];
      if (first.state === 'landing') continue;

      for (let secondIndex = firstIndex + 1; secondIndex < this.aircraft.length; secondIndex += 1) {
        const second = this.aircraft[secondIndex];
        if (second.state === 'landing') continue;

        const separation = distance(first.position, second.position);
        if (airframesOverlap(first, second, this.collisionScales)) {
          this.endGame('collision', [first.id, second.id]);
          return;
        }

        if (separation < aircraftWarningDistance(first, second, this.collisionScales)) {
          const pair = [first.id, second.id].sort((a, b) => a - b) as [number, number];
          const key = pair.join(':');
          nextWarnings.add(key);
          if (!this.activeWarnings.has(key)) {
            this.events.push({ type: 'warning', aircraftIds: pair });
          }
        }
      }
    }

    this.activeWarnings = nextWarnings;
  }

  private processScheduledSpawn(): void {
    const opening = this.trafficProfile.openingSpawns[this.openingSpawnIndex];
    if (opening) {
      if (this.spawnAircraft(opening.type)) this.openingSpawnIndex += 1;
      this.nextSpawnAt = this.trafficProfile.openingSpawns[this.openingSpawnIndex]?.at ??
        this.elapsed + spawnIntervalAt(this.elapsed, this.trafficProfile);
      return;
    }

    this.spawnAircraft();
    this.nextSpawnAt = this.elapsed + spawnIntervalAt(this.elapsed, this.trafficProfile);
  }

  private spawnAircraft(scriptedType?: AircraftType): boolean {
    if (this.aircraft.length >= trafficLimitAt(this.elapsed, this.trafficProfile)) return false;

    const type = scriptedType ?? aircraftTypeAt(this.random.next(), this.trafficProfile);
    const physics = AIRCRAFT_PHYSICS[type];
    const speed = aircraftSpeed(
      physics.baseSpeed,
      this.random.next(),
      this.trafficProfile.speedMultipliers[type]
    );

    for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt += 1) {
      const corridor = this.pickSpawnCorridor();
      const position = corridor
        ? this.spawnPosition(corridor.edge, corridor.from, corridor.to)
        : this.spawnPosition(Math.floor(this.random.next() * 4));

      const region = this.trafficProfile.inwardTargetRegion ?? {
        minX: 0.25,
        maxX: 0.75,
        minY: 0.25,
        maxY: 0.68
      };
      const inwardTarget = {
        x: this.random.between(this.bounds.width * region.minX, this.bounds.width * region.maxX),
        y: this.random.between(this.bounds.height * region.minY, this.bounds.height * region.maxY)
      };
      const heading = Math.atan2(inwardTarget.y - position.y, inwardTarget.x - position.x);
      if (!this.isSafeSpawn(type, position, heading, speed, physics.collisionRadius)) continue;

      const aircraft: Aircraft = {
        id: this.nextAircraftId,
        type,
        position,
        heading,
        speed,
        collisionRadius: physics.collisionRadius,
        state: 'entering',
        hasEntered: false,
        landingProgress: 0
      };

      this.nextAircraftId += 1;
      this.aircraft.push(aircraft);
      this.events.push({ type: 'spawned', aircraftId: aircraft.id });
      return true;
    }

    return false;
  }

  private pickSpawnCorridor(): ResolvedSpawnCorridor | undefined {
    const corridors = this.trafficProfile.spawnCorridors;
    if (!corridors) return undefined;

    const unit = this.random.next();
    let cumulativeWeight = 0;
    for (const corridor of corridors) {
      cumulativeWeight += corridor.weight;
      if (unit < cumulativeWeight) return corridor;
    }
    return corridors[corridors.length - 1];
  }

  private spawnPosition(edge: number | SpawnEdge, from?: number, to?: number): Vector2 {
    const margin = 42;
    if (typeof edge === 'string') {
      const start = from ?? 0;
      const end = to ?? 1;
      if (edge === 'top') {
        return { x: this.random.between(this.bounds.width * start, this.bounds.width * end), y: -margin };
      }
      if (edge === 'right') {
        return { x: this.bounds.width + margin, y: this.random.between(this.bounds.height * start, this.bounds.height * end) };
      }
      if (edge === 'bottom') {
        return { x: this.random.between(this.bounds.width * start, this.bounds.width * end), y: this.bounds.height + margin };
      }
      return { x: -margin, y: this.random.between(this.bounds.height * start, this.bounds.height * end) };
    }
    if (edge === 0) return { x: this.random.between(80, this.bounds.width - 80), y: -margin };
    if (edge === 1) {
      return { x: this.bounds.width + margin, y: this.random.between(160, this.bounds.height - 160) };
    }
    if (edge === 2) {
      return { x: this.random.between(80, this.bounds.width - 80), y: this.bounds.height + margin };
    }
    return { x: -margin, y: this.random.between(160, this.bounds.height - 160) };
  }

  private isSafeSpawn(
    type: AircraftType,
    position: Vector2,
    heading: number,
    speed: number,
    collisionRadius: number
  ): boolean {
    if (this.zones.some(zone => zone.accepts === type && distance(position, zone.position) < MIN_DESTINATION_DISTANCE)) return false;

    const velocity = { x: Math.cos(heading) * speed, y: Math.sin(heading) * speed };
    for (const existing of this.aircraft) {
      if (distance(existing.position, position) < MIN_SPAWN_SEPARATION) return false;

      const existingVelocity = {
        x: Math.cos(existing.heading) * existing.speed,
        y: Math.sin(existing.heading) * existing.speed
      };
      const relativePosition = {
        x: position.x - existing.position.x,
        y: position.y - existing.position.y
      };
      const relativeVelocity = {
        x: velocity.x - existingVelocity.x,
        y: velocity.y - existingVelocity.y
      };
      const velocitySquared =
        relativeVelocity.x * relativeVelocity.x + relativeVelocity.y * relativeVelocity.y;
      const closestTime = velocitySquared < 0.001
        ? 0
        : Math.min(
            SAFE_SPAWN_HORIZON,
            Math.max(
              0,
              -(
                relativePosition.x * relativeVelocity.x +
                relativePosition.y * relativeVelocity.y
              ) / velocitySquared
            )
          );
      const closestDistance = Math.hypot(
        relativePosition.x + relativeVelocity.x * closestTime,
        relativePosition.y + relativeVelocity.y * closestTime
      );
      const requiredSeparation = Math.max(
        SAFE_PREDICTED_SEPARATION,
        collisionRadius + existing.collisionRadius + 48
      );
      if (closestDistance < requiredSeparation) return false;
    }

    return true;
  }

  private endGame(reason: GameOverReason, aircraftIds?: [number, number], exitPosition?: Vector2): void {
    if (this.phase !== 'running') return;
    this.phase = 'over';
    this.runwayTraffic.clear();
    this.events.push({ type: 'gameover', reason, aircraftIds, ...(exitPosition ? {exitPosition} : {}) });
  }
}

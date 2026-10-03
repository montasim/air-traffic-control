import type { AircraftType, Vector2 } from '../../core/types';
import { PIVOT_TURN } from '../maps/shared/groundRoutes';
import type { GroundRoute, GroundStand } from '../maps/types';

/** Fade duration when a parked aircraft is replaced, a helicopter leaves, or (reduced motion) one appears. */
export const FADE_SECONDS = 0.6;
/** Helicopters have no taxi; they settle on the pad this long before fading. */
export const SETTLE_SECONDS = 1.2;

export type GroundPhase = 'rolling' | 'taxiing' | 'pivoting' | 'parked' | 'appearing' | 'fading';

export interface GroundAircraftState {
  readonly id: number;
  readonly type: AircraftType;
  readonly position: Vector2;
  readonly heading: number;
  readonly alpha: number;
  readonly phase: GroundPhase;
}

export interface GroundArrival {
  readonly id: number;
  readonly type: AircraftType;
  readonly position: Vector2;
  readonly heading: number;
  readonly speed: number;
}

/** An aircraft shown parked from the start of a shift, so the apron is never empty. */
export interface GroundSeed {
  readonly id: number;
  readonly type: AircraftType;
  readonly stand: GroundStand;
}

export interface GroundTrafficOptions {
  /** Map unit (min of width and height) so speeds read the same at every viewport. */
  readonly unit: number;
  /** Minimum nose-to-tail spacing; a follower closer than this waits. */
  readonly gap: number;
}

interface Mover {
  readonly id: number;
  readonly type: AircraftType;
  readonly points: readonly Vector2[];
  readonly cumulative: readonly number[];
  readonly pivots: number[];
  readonly rolloutLength: number;
  readonly decel: number;
  readonly finalHeading: number;
  readonly standId?: string;
  /** Shared-route identity and the length of that shared part (before the stand leg). */
  readonly routeKey?: string;
  readonly routeLength: number;
  position: Vector2;
  heading: number;
  distance: number;
  speed: number;
  phase: GroundPhase;
  pivotTarget: number;
  /** Seconds left to rest; Infinity for parked fixed-wing aircraft, which wait to be replaced. */
  timer: number;
  alpha: number;
  parkedAt: number;
}

const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const turnToward = (from: number, to: number, maxStep: number) => {
  const diff = wrap(to - from);
  return Math.abs(diff) <= maxStep ? to : from + Math.sign(diff) * maxStep;
};
const headingOf = (a: Vector2, b: Vector2) => Math.atan2(b.y - a.y, b.x - a.x);

/** A mover that stands still at one point (seeded, settling, or appearing aircraft). */
function stationary(id: number, type: AircraftType, at: Vector2, heading: number, clock: number): Omit<Mover, 'phase' | 'timer' | 'alpha'> {
  return {
    id, type, position: { ...at }, heading, parkedAt: clock, pivotTarget: 0,
    points: [at], cumulative: [0], pivots: [], rolloutLength: 0, routeLength: 0, decel: 0,
    finalHeading: heading, distance: 0, speed: 0,
  };
}

/**
 * Presentation-only traffic for landed aircraft: decelerating rollout, taxi with
 * queueing behind the aircraft ahead, and parking at a stand of the aircraft's
 * type. Exactly one parked aircraft of each fixed-wing type stays on the apron:
 * when a newer one parks, the previous one fades out. Helicopters settle on their
 * pad and fade. It never affects collisions, scoring, or runway use.
 */
export class GroundTraffic {
  private readonly movers = new Map<number, Mover>();
  private readonly standOwners = new Map<string, number>();
  private clock = 0;

  constructor(
    private readonly routes: Readonly<Record<string, GroundRoute>>,
    private readonly options: GroundTrafficOptions,
  ) {}

  get taxiSpeed(): number {
    return this.options.unit * 0.11;
  }

  get aircraft(): GroundAircraftState[] {
    return [...this.movers.values()].map(({ id, type, position, heading, alpha, phase }) => ({ id, type, position: { ...position }, heading, alpha, phase }));
  }

  has(id: number): boolean {
    return this.movers.has(id);
  }

  clear(): void {
    this.movers.clear();
    this.standOwners.clear();
  }

  /** Park one aircraft per type at the start of a shift (ids are the caller's, kept clear of simulation ids). */
  seed(seeds: readonly GroundSeed[]): void {
    for (const { id, type, stand } of seeds) {
      this.movers.set(id, { ...stationary(id, type, stand.position, stand.angle, this.clock), standId: stand.id, phase: 'parked', timer: Infinity, alpha: 1 });
      this.standOwners.set(stand.id, id);
    }
  }

  /** Hand over a just-landed aircraft. Without a route (helipads) it settles in place. */
  add(arrival: GroundArrival, zoneId: string | undefined, reducedMotion = false): void {
    const route = zoneId ? this.routes[zoneId] : undefined;
    if (!route) {
      // Helicopters (and anything without a ground route) settle in place, then fade.
      this.movers.set(arrival.id, {
        ...stationary(arrival.id, arrival.type, arrival.position, arrival.heading, this.clock),
        phase: reducedMotion ? 'fading' : 'parked',
        timer: reducedMotion ? 0 : SETTLE_SECONDS,
        alpha: 1,
      });
      return;
    }
    const stand = this.claimStand(route.stands, arrival.id);
    if (reducedMotion) {
      // No motion: the aircraft fades in at its stand and replaces the one parked there.
      this.movers.set(arrival.id, { ...stationary(arrival.id, arrival.type, stand.position, stand.angle, this.clock), standId: stand.id, phase: 'appearing', timer: Infinity, alpha: 0 });
      this.vacate(stand.id, arrival.id);
      return;
    }
    const end = route.points[route.points.length - 1];
    const before = route.points[route.points.length - 2];
    // Typed stands carry their taxilane and lead-in; untyped stands are reached in a straight line.
    const approach = stand.approach ?? (Math.hypot(stand.position.x - end.x, stand.position.y - end.y) > 1 ? [end, stand.position] : [end]);
    // An approach that starts on the taxiway's last stretch rounds the turn at its end, replacing that corner.
    const rounds = before && Math.hypot(approach[0].x - before.x, approach[0].y - before.y) < 0.5;
    const points = rounds ? [...route.points.slice(0, -1), ...approach.slice(1)] : [...route.points, ...approach.slice(1)];
    const cumulative = [0];
    for (let i = 1; i < points.length; i += 1) cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    const pivots: number[] = [];
    for (let i = 1; i < points.length - 1; i += 1) {
      const turn = Math.abs(wrap(headingOf(points[i], points[i + 1]) - headingOf(points[i - 1], points[i])));
      if (turn >= PIVOT_TURN) pivots.push(i);
    }
    // A stand marks a line, not a nose direction: park along it whichever way is closer to the arrival heading.
    const arrivalHeading = headingOf(points[points.length - 2] ?? points[0], points[points.length - 1]);
    const parkedHeading = Math.abs(wrap(stand.angle - arrivalHeading)) <= Math.PI / 2 ? stand.angle : wrap(stand.angle + Math.PI);
    const taxi = this.taxiSpeed;
    const entrySpeed = Math.max(arrival.speed, taxi * 2.6);
    const rolloutLength = Math.max(1, route.rolloutLength);
    this.movers.set(arrival.id, {
      id: arrival.id,
      type: arrival.type,
      position: { ...arrival.position },
      heading: arrival.heading,
      alpha: 1,
      parkedAt: this.clock,
      pivotTarget: 0,
      points,
      cumulative,
      pivots,
      rolloutLength,
      routeKey: zoneId,
      routeLength: cumulative[route.points.length - 1],
      decel: Math.max(0, (entrySpeed * entrySpeed - taxi * taxi) / (2 * rolloutLength)),
      finalHeading: parkedHeading,
      standId: stand.id,
      distance: 0,
      speed: entrySpeed,
      phase: 'rolling',
      timer: Infinity,
    });
  }

  update(dt: number): void {
    this.clock += dt;
    for (const mover of [...this.movers.values()]) {
      switch (mover.phase) {
        case 'fading':
          mover.alpha = Math.max(0, mover.alpha - dt / FADE_SECONDS);
          if (mover.alpha <= 0) this.remove(mover);
          break;
        case 'appearing':
          mover.alpha = Math.min(1, mover.alpha + dt / FADE_SECONDS);
          if (mover.alpha >= 1) this.park(mover);
          break;
        case 'parked':
          mover.heading = turnToward(mover.heading, mover.finalHeading, 3 * dt);
          // Only settling helicopters have a finite rest; parked fixed-wing aircraft wait to be replaced.
          mover.timer -= dt;
          if (mover.timer <= 0) mover.phase = 'fading';
          break;
        case 'pivoting':
          mover.heading = turnToward(mover.heading, mover.pivotTarget, 2.4 * dt);
          if (Math.abs(wrap(mover.pivotTarget - mover.heading)) < 0.01) mover.phase = 'taxiing';
          break;
        default:
          this.advance(mover, dt);
      }
    }
  }

  private advance(mover: Mover, dt: number): void {
    const taxi = this.taxiSpeed;
    const total = mover.cumulative[mover.cumulative.length - 1];
    // Nearing an occupied stand, the aircraft parked there leaves so this one can take its place.
    if (mover.standId && total - mover.distance < this.options.gap * 2) this.vacate(mover.standId, mover.id);
    if (this.isBlocked(mover)) {
      mover.speed = 0;
      return;
    }
    if (mover.distance < mover.rolloutLength) mover.speed = Math.max(taxi, mover.speed - mover.decel * dt);
    else {
      mover.phase = 'taxiing';
      mover.speed = mover.speed > taxi ? Math.max(taxi, mover.speed - taxi * 3 * dt) : Math.min(taxi, mover.speed + taxi * 2 * dt);
    }
    let next = mover.distance + mover.speed * dt;
    // Reversals stop on the vertex and turn in place before continuing.
    const pivot = mover.pivots[0];
    if (pivot !== undefined && next >= mover.cumulative[pivot]) {
      next = mover.cumulative[pivot];
      mover.pivots.shift();
      mover.phase = 'pivoting';
      mover.speed = 0;
      mover.pivotTarget = headingOf(mover.points[pivot], mover.points[pivot + 1]);
    }
    let parked = false;
    if (next >= total) {
      next = total;
      parked = true;
    }
    mover.distance = next;
    const { position, heading } = this.sample(mover, next);
    mover.position = position;
    if (mover.phase !== 'pivoting') mover.heading = turnToward(mover.heading, heading, 6 * dt);
    if (parked) this.park(mover);
  }

  private sample(mover: Mover, distance: number): { position: Vector2; heading: number } {
    const { points, cumulative } = mover;
    if (points.length === 1) return { position: { ...points[0] }, heading: mover.heading };
    let i = 1;
    while (i < cumulative.length - 1 && cumulative[i] < distance) i += 1;
    const span = cumulative[i] - cumulative[i - 1] || 1;
    const t = Math.min(1, Math.max(0, (distance - cumulative[i - 1]) / span));
    const a = points[i - 1];
    const b = points[i];
    return { position: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, heading: headingOf(a, b) };
  }

  /**
   * A follower waits when another aircraft is just ahead. On the same route the gap
   * is measured along the path, so it holds around bends; otherwise (other routes,
   * stand legs) it waits for anything just ahead of its nose going the same way.
   */
  private isBlocked(mover: Mover): boolean {
    const forward = { x: Math.cos(mover.heading), y: Math.sin(mover.heading) };
    for (const other of this.movers.values()) {
      // Parked aircraft sit on stands beside the lanes (and leave as a newcomer claims theirs), so they never block.
      if (other === mover || other.phase === 'fading' || other.phase === 'appearing' || other.phase === 'parked') continue;
      if (mover.routeKey && other.routeKey === mover.routeKey && other.distance <= other.routeLength) {
        const ahead = other.distance - mover.distance;
        if (ahead > 0 && ahead < this.options.gap) return true;
        continue;
      }
      const dx = other.position.x - mover.position.x;
      const dy = other.position.y - mover.position.y;
      const along = dx * forward.x + dy * forward.y;
      const lateral = Math.abs(dx * forward.y - dy * forward.x);
      if (along <= 0 || along >= this.options.gap || lateral >= this.options.gap * 0.35) continue;
      if (Math.cos(other.heading - mover.heading) > 0.2) return true;
    }
    return false;
  }

  /** Stop at the stand; any other parked aircraft of the same type then fades, keeping one per type. */
  private park(mover: Mover): void {
    mover.phase = 'parked';
    mover.speed = 0;
    mover.alpha = 1;
    mover.parkedAt = this.clock;
    mover.timer = Infinity;
    for (const other of this.movers.values()) {
      if (other !== mover && other.type === mover.type && other.phase === 'parked' && other.timer === Infinity) other.phase = 'fading';
    }
  }

  /** The aircraft parked on `standId` (other than `id`) starts fading out. */
  private vacate(standId: string, id: number): void {
    for (const other of this.movers.values()) {
      if (other.id !== id && other.standId === standId && other.phase === 'parked') other.phase = 'fading';
    }
  }

  /**
   * A free stand first. When all are taken, the stand held longest is claimed;
   * its aircraft stays until this one approaches, so the apron never goes empty.
   */
  private claimStand(stands: readonly GroundStand[], id: number): GroundStand {
    const occupant = (stand: GroundStand) => {
      const owner = this.standOwners.get(stand.id);
      return owner === undefined ? undefined : this.movers.get(owner);
    };
    let chosen = stands.find((stand) => !occupant(stand));
    if (!chosen) {
      chosen = [...stands]
        .filter((stand) => occupant(stand)?.phase === 'parked')
        .sort((a, b) => occupant(a)!.parkedAt - occupant(b)!.parkedAt)[0] ?? stands[0];
    }
    this.standOwners.set(chosen.id, id);
    return chosen;
  }

  private remove(mover: Mover): void {
    this.movers.delete(mover.id);
    if (mover.standId && this.standOwners.get(mover.standId) === mover.id) this.standOwners.delete(mover.standId);
  }
}

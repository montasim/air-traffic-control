import { Simulation } from '../../core/Simulation';
import { applyDifficulty, type DifficultyId } from '../../core/difficulty';
import type { AircraftCollisionScales } from '../../core/aircraftCollision';
import type { LandingZone } from '../../core/types';
import type { ResolvedTrafficProfile } from '../../core/trafficProfile';
import { ShiftTracker } from '../../progression/achievements';
import type { SavedSession } from './types';

export interface SessionOptions {
  zones: readonly LandingZone[];
  world: { width: number; height: number };
  traffic: ResolvedTrafficProfile;
  collisionScales: AircraftCollisionScales;
}

/** Simulation ownership and save/progression continuity shared by rendering backends. */
export class SessionController {
  simulation: Simulation;
  private tracker = new ShiftTracker();
  runId = '';

  constructor(private readonly options: SessionOptions) {
    this.simulation = this.createSimulation();
  }

  private createSimulation(difficulty?: DifficultyId): Simulation {
    const { zones, world, traffic, collisionScales } = this.options;
    return new Simulation(zones, world, difficulty ? applyDifficulty(traffic, difficulty) : traffic, collisionScales);
  }

  start(difficulty: DifficultyId = 'medium', runId = '', seed = Date.now()): void {
    this.runId = runId;
    this.tracker = new ShiftTracker();
    this.simulation = this.createSimulation(difficulty);
    this.simulation.start(seed);
  }

  get evidence() { return this.tracker.evidence; }

  drainEvents() {
    const events = this.simulation.drainEvents();
    for (const event of events) this.tracker.accept(event);
    return events;
  }

  exportState(): SavedSession {
    return { runId: this.runId, simulation: this.simulation.exportState(), tracker: this.tracker.exportState() };
  }

  canRestore(shift: SavedSession): boolean {
    const zones = new Set(this.options.zones.map(zone => zone.id));
    const known = (id?: string) => id === undefined || zones.has(id);
    return shift.simulation.aircraft.every(aircraft => known(aircraft.landingZoneId)
      && known(aircraft.approachZoneId) && known(aircraft.route?.destinationZoneId));
  }

  restore(difficulty: DifficultyId, shift: SavedSession): boolean {
    if (!this.canRestore(shift)) return false;
    this.start(difficulty, shift.runId);
    this.simulation.restore(shift.simulation);
    this.tracker.restore(shift.tracker);
    return true;
  }
}

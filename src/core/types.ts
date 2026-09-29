export const WORLD_WIDTH = 900;
export const WORLD_HEIGHT = 1600;

export type AircraftType = 'liner' | 'commuter' | 'rotor';
export type AircraftState = 'entering' | 'flying' | 'landing';
export type GamePhase = 'idle' | 'running' | 'paused' | 'over';
export type GameOverReason = 'collision' | 'airspace';

export interface Vector2 {
  x: number;
  y: number;
}

export interface Route {
  points: Vector2[];
  segmentIndex: number;
  destinationZoneId?: string;
}

export interface Aircraft {
  id: number;
  type: AircraftType;
  position: Vector2;
  heading: number;
  speed: number;
  collisionRadius: number;
  state: AircraftState;
  route?: Route;
  hasEntered: boolean;
  landingZoneId?: string;
  landingProgress: number;
}

export interface LandingZone {
  id: string;
  label: string;
  accepts: AircraftType;
  position: Vector2;
  angle: number;
  captureRadius: number;
  color: number;
}

export type RouteRejectionReason =
  | 'simulation-inactive'
  | 'aircraft-not-found'
  | 'aircraft-landing'
  | 'insufficient-points'
  | 'route-too-short'
  | 'destination-not-found'
  | 'wrong-destination';

export type RouteAssignmentResult =
  | {
      accepted: true;
      aircraftId: number;
      destinationZoneId?: string;
    }
  | {
      accepted: false;
      aircraftId: number;
      reason: RouteRejectionReason;
      destinationZoneId?: string;
    };

export type SimulationEvent =
  | { type: 'spawned'; aircraftId: number }
  | { type: 'landing-started'; aircraftId: number; zoneId: string }
  | { type: 'landed'; aircraftId: number; aircraftType: AircraftType; score: number }
  | { type: 'warning'; aircraftIds: [number, number] }
  | { type: 'gameover'; reason: GameOverReason; aircraftIds?: [number, number]; exitPosition?: Vector2 };

export interface SimulationSnapshot {
  phase: GamePhase;
  elapsed: number;
  score: number;
  aircraft: readonly Aircraft[];
}

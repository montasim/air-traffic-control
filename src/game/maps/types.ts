import type { AirportCategory } from './categories';
import type Phaser from 'phaser';
import type { AircraftType, LandingZone, Vector2 } from '../../core/types';
import type { RankId } from '../../progression/ranks';
import type { WorldDetailLevel } from '../palette';
import type { MapId } from './mapIds';
import type { GuidanceSurface } from './shared/guidance';

export type MapLayoutVariant = 'portrait' | 'landscape' | 'square';

export interface HudExclusionZone {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface MapMetadata {
  readonly name: string;
  readonly description: string;
  readonly category: AirportCategory;
  readonly layoutLabel: string;
  readonly unlockRankId: RankId;
}

export interface MapPreparationInput {
  readonly twoEndLanding?: boolean;
  readonly width: number;
  readonly height: number;
  readonly detailLevel: WorldDetailLevel;
}

/** A parking spot a landed aircraft can taxi to. `angle` is its parked heading. */
export interface GroundStand {
  readonly id: string;
  readonly position: Vector2;
  readonly angle: number;
  /** Fixed-wing type this stand is marked for; untyped stands accept any. */
  readonly accepts?: Exclude<AircraftType, 'rotor'>;
  /** Path from the route's apron end along the taxilane and lead-in to the stop position. */
  readonly approach?: readonly Vector2[];
  /** Painted stand length; parked aircraft are scaled to fit inside it. */
  readonly length?: number;
}

/** A marked parking stand on the apron, reached from a taxilane by a curved lead-in line. */
export interface ApronStand {
  readonly id: string;
  readonly label: string;
  readonly accepts: Exclude<AircraftType, 'rotor'>;
  readonly position: Vector2;
  /** Nose heading when parked. */
  readonly angle: number;
  readonly length: number;
  readonly width: number;
  /** Where the lead-in leaves the taxilane. */
  readonly entry: Vector2;
  readonly laneId: string;
}

/** The painted guide line across the apron; `path[0]` is where the taxiway reaches the apron. */
export interface ApronTaxilane {
  readonly id: string;
  readonly path: readonly Vector2[];
}

/** Typed stands, their taxilanes, and the dividers that separate liner and commuter groups. */
export interface ApronMarkings {
  readonly stands: readonly ApronStand[];
  readonly taxilanes: readonly ApronTaxilane[];
  readonly dividers: readonly (readonly [Vector2, Vector2])[];
}

/**
 * Presentation-only path a landed aircraft follows: touchdown, rollout along the
 * runway, then the taxiway to the apron. It never affects gameplay.
 */
export interface GroundRoute {
  readonly points: readonly Vector2[];
  /** Distance along `points` covered by the decelerating rollout. */
  readonly rolloutLength: number;
  /** Stands reachable from the route's apron end, nearest first. */
  readonly stands: readonly GroundStand[];
}

/**
 * The complete map surface understood by gameplay code. Map-specific scenery
 * and rendering data stays behind the MapDefinition seam.
 */
export interface PlayableMapLayout {
  readonly width: number;
  readonly height: number;
  readonly variant: MapLayoutVariant;
  readonly landingZones: readonly LandingZone[];
  readonly guidanceSurfaces: readonly GuidanceSurface[];
  readonly hudExclusionZones: readonly HudExclusionZone[];
  /** Ground routes keyed by fixed-wing landing zone id; absent zones settle in place. */
  readonly groundRoutes?: Readonly<Record<string, GroundRoute>>;
  /** Typed parking stands and taxilanes generated for the apron. */
  readonly apronMarkings?: ApronMarkings;
}

/** A viewport-resolved map whose private layout is retained by its definition. */
export interface PreparedMap {
  readonly mapId: MapId;
  readonly detailLevel: WorldDetailLevel;
  readonly layout: PlayableMapLayout;
}

/**
 * The single runtime seam for every playable map. Callers prepare a map for a
 * viewport, then give that exact result back to the same definition to render.
 */
export interface MapDefinition {
  readonly id: MapId;
  readonly metadata: MapMetadata;
  readonly trafficProfileId: string;
  prepare(input: MapPreparationInput): PreparedMap;
  render(scene: Phaser.Scene, map: PreparedMap): void;
}


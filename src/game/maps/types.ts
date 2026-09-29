import type { AirportCategory } from './categories';
import type Phaser from 'phaser';
import type { LandingZone } from '../../core/types';
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
  readonly width: number;
  readonly height: number;
  readonly detailLevel: WorldDetailLevel;
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


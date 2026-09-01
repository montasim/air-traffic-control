import type { AircraftType, Vector2 } from '../../../core/types';

export type AirfieldPropKind =
  | 'windsock'
  | 'hangar'
  | 'service'
  | 'fuel'
  | 'fence'
  | 'utility';

export interface MapRunway<
  RunwayId extends string = string,
  RunwayDesignator extends string = string
> {
  readonly id: RunwayId;
  readonly accepts: Exclude<AircraftType, 'rotor'>;
  readonly center: Vector2;
  readonly length: number;
  readonly width: number;
  readonly angle: number;
  readonly zoneId: string;
  /** Designators at the negative and positive ends of the runway axis. */
  readonly designators: readonly [RunwayDesignator, RunwayDesignator];
}

export interface MapTaxiway<
  TaxiwayId extends string = string,
  ConnectionId extends string = string
> {
  readonly id: TaxiwayId;
  readonly path: readonly Vector2[];
  readonly width: number;
  readonly connects: readonly [ConnectionId, ConnectionId];
}

export interface HoldShortMarker<
  RunwayId extends string = string,
  TaxiwayId extends string = string
> {
  readonly id: string;
  readonly position: Vector2;
  readonly angle: number;
  readonly width: number;
  readonly runwayId: RunwayId;
  readonly taxiwayId: TaxiwayId;
}

export interface ParkingStand {
  readonly id: string;
  readonly label: string;
  readonly position: Vector2;
  readonly angle: number;
  readonly length: number;
}

export interface AirfieldPropAnchor {
  readonly id: string;
  readonly kind: AirfieldPropKind;
  readonly label: string;
  readonly position: Vector2;
  readonly angle: number;
  readonly size: number;
}

export interface AirfieldSign {
  readonly id: string;
  readonly kind: 'taxiway' | 'facility';
  readonly label: string;
  readonly position: Vector2;
  readonly angle: number;
}

export interface MapHelipad {
  readonly center: Vector2;
  readonly radius: number;
  readonly zoneId: string;
}

/**
 * Shared civil-airfield geometry. A multi-airport map keeps one of these per
 * airport inside its private rich layout.
 */
export interface AirfieldLayout<
  RunwayId extends string = string,
  RunwayDesignator extends string = string,
  TaxiwayId extends string = string,
  ConnectionId extends string = string
> {
  readonly runways: readonly MapRunway<RunwayId, RunwayDesignator>[];
  readonly taxiways: readonly MapTaxiway<TaxiwayId, ConnectionId>[];
  readonly holdShortMarkers: readonly HoldShortMarker<RunwayId, TaxiwayId>[];
  readonly parkingStands: readonly ParkingStand[];
  readonly propAnchors: readonly AirfieldPropAnchor[];
  readonly signs: readonly AirfieldSign[];
  readonly helipad?: MapHelipad;
  readonly apron: readonly Vector2[];
}


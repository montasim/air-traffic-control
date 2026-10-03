import { FALCON_AIR_BASE_DEFINITION } from './falcon-air-base';
import { EXECUTIVE_POINT_DEFINITION } from './executive-point';
import { METRO_INTERNATIONAL_DEFINITION } from './metro-international';
import { FREIGHT_JUNCTION_DEFINITION } from './freight-junction';
import { ISLAND_RESCUE_DEFINITION } from './island-rescue';
import { FROST_CROSSING_DEFINITION } from './frost-crossing';
import { CARRIER_COAST_DEFINITION } from './carrier-coast';
import { BLUE_WATER_DEFINITION } from './blue-water';
import { DEFAULT_MAP_ID, MAP_IDS, type MapId } from './mapIds';
import type { MapDefinition } from './types';
import { SALTMARSH_GATEWAY_DEFINITION } from './saltmarsh-gateway';
import { RIVER_BEND_DEFINITION } from './river-bend';
import { DESERT_PARALLEL_DEFINITION } from './desert-parallel';
import { TWIN_BANKS_DEFINITION } from './twin-banks';

export const MAP_DEFINITIONS: readonly MapDefinition[] = [
  SALTMARSH_GATEWAY_DEFINITION,
  RIVER_BEND_DEFINITION,
  DESERT_PARALLEL_DEFINITION,
  TWIN_BANKS_DEFINITION,
  FALCON_AIR_BASE_DEFINITION,
  EXECUTIVE_POINT_DEFINITION,
  METRO_INTERNATIONAL_DEFINITION,
  FREIGHT_JUNCTION_DEFINITION,
  ISLAND_RESCUE_DEFINITION,
  FROST_CROSSING_DEFINITION,
  CARRIER_COAST_DEFINITION,
  BLUE_WATER_DEFINITION
];

const DEFINITIONS_BY_ID = new Map<MapId, MapDefinition>(
  MAP_DEFINITIONS.map((definition) => [definition.id, definition])
);

if (MAP_DEFINITIONS.length !== MAP_IDS.length || MAP_IDS.some((id) => !DEFINITIONS_BY_ID.has(id))) {
  throw new Error('Map registry must contain exactly one definition for every MapId');
}

export function mapDefinitionById(mapId: MapId): MapDefinition {
  return DEFINITIONS_BY_ID.get(mapId) ?? DEFINITIONS_BY_ID.get(DEFAULT_MAP_ID)!;
}

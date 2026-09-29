export const MAP_IDS = [
  'saltmarsh-gateway',
  'river-bend',
  'desert-parallel',
  'twin-banks',
  'falcon-air-base',
  'executive-point',
  'metro-international',
  'freight-junction',
  'island-rescue'
] as const;

export type MapId = (typeof MAP_IDS)[number];

export const DEFAULT_MAP_ID: MapId = 'saltmarsh-gateway';

export function isMapId(value: unknown): value is MapId {
  return typeof value === 'string' && MAP_IDS.includes(value as MapId);
}

export const ORIGINAL_MAP_IDS = ['saltmarsh-gateway', 'river-bend', 'desert-parallel', 'twin-banks'] as const;
export const EXPANSION_MAP_IDS = ['falcon-air-base', 'executive-point', 'metro-international', 'freight-junction', 'island-rescue'] as const;

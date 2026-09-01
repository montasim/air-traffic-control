export const MAP_IDS = [
  'saltmarsh-gateway',
  'river-bend',
  'desert-parallel',
  'twin-banks'
] as const;

export type MapId = (typeof MAP_IDS)[number];

export const DEFAULT_MAP_ID: MapId = 'saltmarsh-gateway';

export function isMapId(value: unknown): value is MapId {
  return typeof value === 'string' && MAP_IDS.includes(value as MapId);
}

import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_ID, MAP_IDS } from '../../src/game/maps/mapIds';
import { MAP_DEFINITIONS, mapDefinitionById } from '../../src/game/maps/registry';

describe('map registry', () => {
  it('contains each stable map id exactly once in selection order', () => {
    expect(MAP_DEFINITIONS.map(({ id }) => id)).toEqual(MAP_IDS);
    expect(new Set(MAP_DEFINITIONS.map(({ id }) => id)).size).toBe(MAP_IDS.length);
  });

  it('resolves every selectable definition', () => {
    for (const mapId of MAP_IDS) expect(mapDefinitionById(mapId).id).toBe(mapId);
    expect(mapDefinitionById(DEFAULT_MAP_ID).metadata.category).toBe('regional');
  });
});

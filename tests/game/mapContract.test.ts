import { describe, expect, it, vi } from 'vitest';
import type { LandingZone } from '../../src/core/types';
import { MAP_IDS, type MapId } from '../../src/game/maps/mapIds';
import { createSaltmarshLayout } from '../../src/game/maps/saltmarsh';
import { defineMap } from '../../src/game/maps/shared/definition';
import type { GuidanceSurface } from '../../src/game/maps/shared/guidance';
import type {
  MapLayoutVariant,
  PlayableMapLayout
} from '../../src/game/maps/types';

interface TestLayout extends PlayableMapLayout {
  readonly privateLandmark: string;
}

const zone: LandingZone = {
  id: 'test-runway',
  label: '09',
  accepts: 'liner',
  position: { x: 320, y: 180 },
  angle: 0,
  captureRadius: 40,
  color: 0xffffff
};

const surface: GuidanceSurface = {
  kind: 'runway',
  zoneId: zone.id,
  center: { x: 420, y: 180 },
  angle: 0,
  length: 360,
  width: 34
};

function variantFor(width: number, height: number): MapLayoutVariant {
  const aspect = width / height;
  if (aspect >= 1.18) return 'landscape';
  if (aspect <= 0.85) return 'portrait';
  return 'square';
}

function testDefinition(id: MapId) {
  return defineMap<TestLayout>({
    id,
    metadata: {
      name: id,
      description: `${id} test map`,
      category: 'regional', layoutLabel: 'Test layout',
      unlockRankId: 'control-trainee'
    },
    trafficProfileId: 'legacy',
    createLayout: ({ width, height }) => ({
      width,
      height,
      variant: variantFor(width, height),
      landingZones: [zone],
      guidanceSurfaces: [surface],
      hudExclusionZones: [
        { id: 'score', x: 0, y: 0, width: 120, height: 70 }
      ],
      privateLandmark: `${id}-landmark`
    }),
  });
}

describe('map contract', () => {
  it('accepts every frozen map id through one geometry preparation interface', () => {
    for (const id of MAP_IDS) {
      const definition = testDefinition(id);
      const prepared = definition.prepare({
        width: 1600,
        height: 900,
        detailLevel: 'tablet'
      });

      expect(definition.id).toBe(id);
      expect(prepared.mapId).toBe(id);
      expect(prepared.layout.variant).toBe('landscape');
      expect(prepared.layout.landingZones).toEqual([zone]);
    }
  });

  it.each([
    [900, 1600, 'portrait'],
    [1600, 900, 'landscape'],
    [900, 900, 'square']
  ] as const)('preserves a map-authored %s x %s responsive variant', (width, height, variant) => {
    const prepared = testDefinition('river-bend').prepare({
      width,
      height,
      detailLevel: 'desktop'
    });

    expect(prepared.layout).toMatchObject({ width, height, variant });
  });

  it('rejects invalid viewport dimensions and incomplete guidance', () => {
    const definition = testDefinition('desert-parallel');
    expect(() => definition.prepare({ width: 0, height: 900, detailLevel: 'desktop' }))
      .toThrow('Map width must be a positive finite number');

    const incomplete = defineMap<TestLayout>({
      id: 'twin-banks',
      metadata: {
        name: 'Twin Banks',
        description: 'Test map',
        category: 'regional', layoutLabel: 'Test layout',
        unlockRankId: 'tower-controller'
      },
      trafficProfileId: 'expert',
      createLayout: ({ width, height }) => ({
        width,
        height,
        variant: 'landscape',
        landingZones: [zone],
        guidanceSurfaces: [],
        hudExclusionZones: [],
        privateLandmark: 'river'
      }),
    });

    expect(() => incomplete.prepare({ width: 1600, height: 900, detailLevel: 'desktop' }))
      .toThrow('twin-banks is missing guidance for zone test-runway');
  });
});

describe('Saltmarsh shared contract', () => {
  it.each([
    [900, 1600, 'portrait'],
    [1600, 900, 'landscape'],
    [900, 900, 'square']
  ] as const)('resolves authoritative guidance surfaces in %s x %s %s', (width, height, variant) => {
    const layout = createSaltmarshLayout(width, height);

    expect(layout.variant).toBe(variant);
    expect(layout.guidanceSurfaces.map(({ zoneId, kind }) => ({ zoneId, kind }))).toEqual([
      { zoneId: 'runway-main', kind: 'runway' },
      { zoneId: 'runway-crosswind', kind: 'runway' },
      { zoneId: 'helipad', kind: 'pad' }
    ]);
    expect(layout.guidanceSurfaces.map(({ zoneId }) => zoneId)).toEqual(
      layout.landingZones.map(({ id }) => id)
    );
  });
});

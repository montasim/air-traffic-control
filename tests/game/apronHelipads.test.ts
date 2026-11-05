import { describe, expect, it } from 'vitest';
import { MAP_DEFINITIONS } from '../../src/game/maps/registry';
import { apronPolygons, pointInPolygon } from '../../src/game/maps/shared/apronLayout';

const VIEWPORTS = [[1600, 900], [900, 1600], [900, 900], [844, 390], [390, 844]] as const;
const ON_APRON = MAP_DEFINITIONS.filter((map) => map.prepare({ width: 1600, height: 900, detailLevel: 'desktop', twoEndLanding: false }).layout.helipadsOnApron);

describe('helipads on the apron', () => {
  it('covers the land maps that asked for it', () => {
    expect(ON_APRON.map((map) => map.id).sort()).toEqual(
      ['desert-parallel', 'executive-point', 'falcon-air-base', 'freight-junction', 'metro-international', 'river-bend', 'twin-banks'],
    );
  });

  it.each(ON_APRON.flatMap((map) => VIEWPORTS.map(([width, height]) => ({ map, width, height }))))(
    '$map.id sets its helipad down on the apron at $width×$height, with no taxi link',
    ({ map, width, height }) => {
      const { layout } = map.prepare({ width, height, detailLevel: 'desktop', twoEndLanding: false });
      const aprons = apronPolygons(layout, 'land');
      const pads = layout.landingZones.filter((zone) => zone.accepts === 'rotor');
      for (const pad of pads) expect(aprons.some((apron) => pointInPolygon(pad.position, apron))).toBe(true);
      const taxiways = (layout as unknown as { taxiways: { connects: readonly string[] }[] }).taxiways;
      expect(taxiways.some(({ connects }) => connects.some((id) => /helipad|pad/.test(id)))).toBe(false);
    },
  );
});

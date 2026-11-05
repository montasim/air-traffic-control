import { describe, expect, it } from 'vitest';
import { mapDefinitionById } from '../../src/game/maps/registry';
import type { MapId } from '../../src/game/maps/mapIds';

const VIEWPORTS = [[1600, 900], [900, 1600], [900, 900], [844, 390], [390, 844]] as const;

// Stands each map had before the change, per viewport; the new placement must not lose any.
// `ends` checks two buildings at opposite ends; it is off where a screen is too tight for that
// (it keeps the usual placement) and on maps with a single building.
const CASES = [
  ...VIEWPORTS.map(([width, height]) => ({ map: 'saltmarsh-gateway' as MapId, width, height, stands: 4, ends: true })),
  ...VIEWPORTS.map(([width, height], i) => ({ map: 'river-bend' as MapId, width, height, stands: [4, 4, 3, 2, 4][i], ends: i !== 3 })),
  ...VIEWPORTS.map(([width, height], i) => ({ map: 'freight-junction' as MapId, width, height, stands: [4, 4, 4, 3, 4][i], ends: i < 3 })),
  ...VIEWPORTS.map(([width, height], i) => ({ map: 'metro-international' as MapId, width, height, stands: [4, 4, 4, 4, 4][i], ends: false })),
  ...VIEWPORTS.map(([width, height], i) => ({ map: 'falcon-air-base' as MapId, width, height, stands: [4, 4, 4, 3, 4][i], ends: false })),
  ...VIEWPORTS.map(([width, height], i) => ({ map: 'executive-point' as MapId, width, height, stands: [4, 4, 2, 2, 3][i], ends: false })),
];

describe('buildings at the apron ends', () => {
  it.each(CASES)('$map keeps at least $stands stands (buildings at opposite ends: $ends) at $width×$height', ({ map, width, height, stands, ends }) => {
    const { layout } = mapDefinitionById(map).prepare({ width, height, detailLevel: 'desktop', twoEndLanding: false });
    const rich = layout as typeof layout & { apron: { x: number; y: number }[]; buildings: { center: { x: number; y: number } }[]; runways: { angle: number }[] };
    expect(layout.apronMarkings?.stands.length).toBeGreaterThanOrEqual(stands);
    const middle = rich.apron.reduce((sum, p) => ({ x: sum.x + p.x / rich.apron.length, y: sum.y + p.y / rich.apron.length }), { x: 0, y: 0 });
    const axis = { x: Math.cos(rich.runways[0].angle), y: Math.sin(rich.runways[0].angle) };
    const along = rich.buildings.map(({ center }) => (center.x - middle.x) * axis.x + (center.y - middle.y) * axis.y);
    if (!ends) return;
    expect(along).toHaveLength(2);
    expect(Math.sign(along[0])).toBe(-Math.sign(along[1]));
  });
});

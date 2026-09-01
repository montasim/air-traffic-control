import { describe, expect, it } from 'vitest';
import {
  AIRCRAFT_TARGET_CSS_MAJOR_AXIS,
  AIRCRAFT_SILHOUETTES,
  AIRCRAFT_VISUAL_TOKENS,
  aircraftPresentationScale,
  contrastRatio
} from '../../src/game/rendering/aircraft/visualTokens';
import {
  COMMUTER_SILHOUETTE,
  LINER_SILHOUETTE
} from '../../src/game/rendering/aircraft/silhouettes';

describe('aircraft visual system', () => {
  it('uses a high-contrast two-tone keyline and selection halo', () => {
    expect(contrastRatio(
      AIRCRAFT_VISUAL_TOKENS.body,
      AIRCRAFT_VISUAL_TOKENS.keyline
    )).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(
      AIRCRAFT_VISUAL_TOKENS.selectionLight,
      AIRCRAFT_VISUAL_TOKENS.keyline
    )).toBeGreaterThanOrEqual(4.5);
    expect(AIRCRAFT_VISUAL_TOKENS.selectionOuterWidth).toBeGreaterThan(
      AIRCRAFT_VISUAL_TOKENS.selectionInnerWidth
    );
  });

  it('preserves a readable CSS footprint when the logical world is scaled down', () => {
    const logical = { width: 900, height: 1600 };
    const rendered = { width: 390, height: 844 };
    for (const type of ['liner', 'commuter', 'rotor'] as const) {
      const scale = aircraftPresentationScale(type, rendered, logical);
      const displayScale = Math.min(rendered.width / logical.width, rendered.height / logical.height);
      const cssMajorAxis = AIRCRAFT_SILHOUETTES[type].majorAxis * scale * displayScale;
      expect(cssMajorAxis).toBeCloseTo(AIRCRAFT_TARGET_CSS_MAJOR_AXIS[type], 5);
      expect(scale).toBeGreaterThan(1);
    }
  });

  it('does not enlarge an aircraft when the logical world renders at full size', () => {
    expect(aircraftPresentationScale(
      'liner',
      { width: 1600, height: 900 },
      { width: 1600, height: 900 }
    )).toBeCloseTo(74 / AIRCRAFT_SILHOUETTES.liner.majorAxis, 5);
  });

  it('keeps class color subordinate to the neutral aircraft body', () => {
    expect(AIRCRAFT_VISUAL_TOKENS.maximumAccentCoverage).toBeLessThanOrEqual(0.35);
    expect(AIRCRAFT_VISUAL_TOKENS.maximumAccentCoverage).toBeGreaterThan(0);
  });

  it('uses a restrained southeast runtime shadow', () => {
    expect(AIRCRAFT_VISUAL_TOKENS.shadowAlpha).toBeLessThanOrEqual(0.22);
    expect(AIRCRAFT_VISUAL_TOKENS.shadowOffset.x).toBeGreaterThan(0);
    expect(AIRCRAFT_VISUAL_TOKENS.shadowOffset.y).toBeGreaterThan(0);
  });

  it('assigns a distinct silhouette grammar to every class', () => {
    const ids = Object.values(AIRCRAFT_SILHOUETTES).map(({ id }) => id);
    expect(new Set(ids).size).toBe(3);
    expect(AIRCRAFT_SILHOUETTES.liner.majorAxis).toBeGreaterThan(
      AIRCRAFT_SILHOUETTES.commuter.majorAxis
    );
    expect(AIRCRAFT_SILHOUETTES.rotor.halfSpan).toBeGreaterThan(
      AIRCRAFT_SILHOUETTES.liner.halfSpan
    );
  });

  it('keeps the liner swept and the commuter wing visibly rectangular', () => {
    const linerWingRoot = LINER_SILHOUETTE.find(({ x, y }) => x === -3 && y === -25);
    const commuterOuterWing = COMMUTER_SILHOUETTE.find(
      ({ x, y }) => x === -8 && y === -22
    );
    const commuterInnerWing = COMMUTER_SILHOUETTE.find(
      ({ x, y }) => x === 1 && y === -22
    );

    expect(linerWingRoot).toBeDefined();
    expect(commuterOuterWing).toBeDefined();
    expect(commuterInnerWing).toBeDefined();
  });
});

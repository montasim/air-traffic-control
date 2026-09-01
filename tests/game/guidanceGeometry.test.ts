import { describe, expect, it } from 'vitest';
import {
  createGuidanceGeometry,
  guidanceStrokeMetrics,
  guidanceTransientDuration
} from '../../src/game/rendering/guidanceGeometry';

describe('guidance geometry', () => {
  it('defaults metadata-free targets to a bounded nondirectional pad', () => {
    const geometry = createGuidanceGeometry({
      x: 42,
      y: 84,
      captureRadius: 10
    });

    expect(geometry.kind).toBe('pad');
    expect(geometry.captureRadius).toBe(16);
    expect(geometry.inwardX).toBe(1);
    expect(geometry.inwardY).toBe(0);
    expect(geometry.outwardX).toBe(-1);
    expect(geometry.outwardY).toBeCloseTo(0, 10);
  });

  it('aligns runway approach geometry with the supplied centerline', () => {
    const geometry = createGuidanceGeometry({
      x: 120,
      y: 80,
      captureRadius: 40,
      kind: 'runway',
      angle: Math.PI / 2,
      runwayLength: 600,
      runwayWidth: 50
    });

    expect(geometry.inwardX).toBeCloseTo(0, 10);
    expect(geometry.inwardY).toBeCloseTo(1, 10);
    expect(geometry.outwardX).toBeCloseTo(0, 10);
    expect(geometry.outwardY).toBeCloseTo(-1, 10);
    expect(geometry.normalX).toBeCloseTo(-1, 10);
    expect(geometry.normalY).toBeCloseTo(0, 10);
    expect(geometry.approachLength).toBe(180);
    expect(geometry.approachNearHalfWidth).toBe(28);
    expect(geometry.approachFarHalfWidth).toBe(54);
    expect(geometry.runwayHalfWidth).toBe(26);
  });

  it('infers runway intent from physical dimensions and clamps bad input', () => {
    const inferred = createGuidanceGeometry({
      x: Number.POSITIVE_INFINITY,
      y: 12,
      captureRadius: Number.NaN,
      angle: Number.NaN,
      runwayLength: 120
    });

    expect(inferred.kind).toBe('runway');
    expect(inferred.x).toBe(0);
    expect(inferred.y).toBe(12);
    expect(inferred.captureRadius).toBe(16);
    expect(inferred.angle).toBe(0);
    expect(inferred.approachLength).toBeGreaterThan(inferred.captureRadius * 2.5);
    expect(inferred.approachFarHalfWidth).toBeGreaterThan(
      inferred.approachNearHalfWidth
    );
  });

  it('keeps the semantic color core inside a wider neutral casing', () => {
    const compatible = guidanceStrokeMetrics(40, 'compatible');
    const locked = guidanceStrokeMetrics(40, 'locked');
    const transient = guidanceStrokeMetrics(40, 'transient');

    for (const stroke of [compatible, locked, transient]) {
      expect(stroke.casingWidth).toBeGreaterThan(stroke.coreWidth);
      expect(stroke.casingAlpha).toBeGreaterThan(0);
      expect(stroke.coreAlpha).toBeGreaterThan(stroke.casingAlpha);
    }
    expect(compatible.coreWidth).toBeLessThan(locked.coreWidth);
    expect(compatible.coreAlpha).toBeLessThan(locked.coreAlpha);
  });

  it('preserves the established transient guidance durations', () => {
    expect(guidanceTransientDuration('confirmed')).toBe(360);
    expect(guidanceTransientDuration('landing-started')).toBe(820);
  });
});

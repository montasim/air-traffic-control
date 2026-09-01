import { describe, expect, it } from 'vitest';
import {
  initialRotorPhase,
  MAX_ROTOR_DELTA_MILLISECONDS,
  normalizeRotorAngle,
  ROTOR_RADIANS_PER_SECOND,
  rotorMotion
} from '../../src/game/animation/rotorMotion';

const TAU = Math.PI * 2;

describe('rotorMotion', () => {
  it('advances at 0.9 revolutions per second from delta time', () => {
    const angle = rotorMotion(0, 50, true);

    expect(angle).toBeCloseTo(ROTOR_RADIANS_PER_SECOND * 0.05, 10);
  });

  it('clamps unusually long frames to 100 milliseconds', () => {
    const longFrame = rotorMotion(0, 900, true);
    const cappedFrame = rotorMotion(0, MAX_ROTOR_DELTA_MILLISECONDS, true);

    expect(longFrame).toBeCloseTo(cappedFrame, 12);
  });

  it('freezes while the game is not running and resumes from the same phase', () => {
    const beforePause = rotorMotion(1.25, 40, true);
    const duringPause = rotorMotion(beforePause, 80, false);
    const afterResume = rotorMotion(duringPause, 40, true);

    expect(duringPause).toBe(beforePause);
    expect(afterResume).toBeCloseTo(
      beforePause + ROTOR_RADIANS_PER_SECOND * 0.04,
      10
    );
  });

  it('normalizes wrapped, negative, and invalid angles', () => {
    expect(normalizeRotorAngle(TAU + 0.4)).toBeCloseTo(0.4, 12);
    expect(normalizeRotorAngle(-0.4)).toBeCloseTo(TAU - 0.4, 12);
    expect(normalizeRotorAngle(Number.NaN)).toBe(0);
    expect(rotorMotion(TAU - 0.1, 100, true)).toBeGreaterThanOrEqual(0);
    expect(rotorMotion(TAU - 0.1, 100, true)).toBeLessThan(TAU);
  });

  it('uses a deterministic, distributed initial phase for each aircraft ID', () => {
    expect(initialRotorPhase(17)).toBe(initialRotorPhase(17));
    expect(initialRotorPhase(17)).not.toBe(initialRotorPhase(18));
    expect(initialRotorPhase(17)).toBeGreaterThanOrEqual(0);
    expect(initialRotorPhase(17)).toBeLessThan(TAU);
  });

  it('ignores negative and non-finite elapsed time', () => {
    expect(rotorMotion(1.1, -16, true)).toBe(1.1);
    expect(rotorMotion(1.1, Number.POSITIVE_INFINITY, true)).toBe(1.1);
  });
});

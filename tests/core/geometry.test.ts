import { describe, expect, it } from 'vitest';
import { simplifyPoints, smoothPath } from '../../src/core/geometry';

describe('route geometry', () => {
  it('removes samples that are too close while preserving endpoints', () => {
    const result = simplifyPoints(
      [
        { x: 0, y: 0 },
        { x: 2, y: 2 },
        { x: 20, y: 0 },
        { x: 40, y: 0 }
      ],
      10
    );

    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 40, y: 0 }
    ]);
  });

  it('smooths a route without moving its endpoints', () => {
    const result = smoothPath(
      [
        { x: 0, y: 0 },
        { x: 40, y: 80 },
        { x: 100, y: 100 }
      ],
      2
    );

    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[result.length - 1]).toEqual({ x: 100, y: 100 });
    expect(result.length).toBeGreaterThan(3);
  });
});

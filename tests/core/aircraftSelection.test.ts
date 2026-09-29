import { describe, expect, it } from 'vitest';
import { aircraftSelectionRadius } from '../../src/core/aircraftSelection';
import { AIRCRAFT_OUTLINES } from '../../src/core/aircraftCollision';
import { aircraftPresentationScale } from '../../src/game/rendering/aircraft/visualTokens';

describe('visible aircraft selection', () => {
  for (const width of [320, 360, 390, 430, 900]) {
    for (const type of ['liner', 'commuter', 'rotor'] as const) {
      it(`includes every ${type} airframe point at ${width}px, before and after a display resize`, () => {
        const scale = aircraftPresentationScale(type, { width, height: width * 16 / 9 }, { width: 900, height: 1600 });
        for (const display of [width / 900, width / 900 * .85]) {
          for (const coarse of [false, true]) {
            const radius = aircraftSelectionRadius(type, scale, display, coarse);
            for (const [x, y] of AIRCRAFT_OUTLINES[type]) {
              expect(radius).toBeGreaterThan(Math.hypot(x, y) * scale);
            }
            if (coarse) expect(radius * display * 2).toBeGreaterThanOrEqual(44);
          }
        }
      });
    }
  }
});

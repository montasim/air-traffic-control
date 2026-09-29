import { describe, expect, it } from 'vitest';
import { Simulation } from '../../src/core/Simulation';

function routedAircraft(heading = 0) {
  const sim = new Simulation([], { width: 1600, height: 900 });
  sim.start(42);
  const aircraft = sim.snapshot().aircraft[0];
  aircraft.position = { x: 500, y: 500 };
  aircraft.heading = heading;
  aircraft.hasEntered = true;
  aircraft.state = 'flying';
  aircraft.route = { points: [{ x: 500, y: 500 }, { x: 500, y: 800 }], segmentIndex: 1 };
  return { sim, aircraft };
}

describe('aircraft heading continuity', () => {
  it('turns into a newly drawn route without a one-frame quarter-turn', () => {
    const { sim, aircraft } = routedAircraft();
    sim.update(1 / 60);
    expect(aircraft.heading).toBeGreaterThan(0);
    expect(aircraft.heading).toBeLessThanOrEqual(4 / 60 + 1e-9);
    for (let frame = 0; frame < 30; frame++) sim.update(1 / 60);
    expect(aircraft.heading).toBeCloseTo(Math.PI / 2);
    expect(aircraft.position.x).toBe(500);
    expect(aircraft.position.y).toBeGreaterThan(500);
  });
  it('takes the short turn across the minus-pi boundary', () => {
    const { sim, aircraft } = routedAircraft(Math.PI - 0.02);
    aircraft.route!.points[1] = { x: 200, y: 490 };
    const before = aircraft.heading;
    sim.update(1 / 60);
    expect(Math.abs(aircraft.heading - before)).toBeLessThanOrEqual(4 / 60 + 1e-9);
    expect(aircraft.heading).toBeGreaterThan(before);
  });
});

import { describe, expect, it } from "vitest";
import { Simulation } from "../../src/core/Simulation";
import { airframesOverlap } from "../../src/core/aircraftCollision";
import type { Aircraft } from "../../src/core/types";

function pair(dx: number, dy: number, heading = 0) {
  const sim = new Simulation([], { width: 1600, height: 900 });
  sim.start(42);
  const aircraft = sim.snapshot().aircraft as Aircraft[];
  const first: Aircraft = {
    ...aircraft[0],
    id: 1,
    type: "liner",
    position: { x: 500, y: 500 },
    heading: 0,
    speed: 0,
    collisionRadius: 22,
    state: "flying",
    hasEntered: true,
  };
  const second: Aircraft = {
    ...first,
    id: 2,
    position: { x: 500 + dx, y: 500 + dy },
    heading,
  };
  aircraft.splice(0, aircraft.length, first, second);
  return sim;
}

describe("visible aircraft collision", () => {
  it("allows diagonally separated airframes inside the old circular separation boundary", () => {
    const sim = pair(12, 42);
    sim.update(1 / 60);
    expect(sim.snapshot().phase).toBe("running");
  });
  it("uses heading, rather than an axis-aligned or circular hitbox", () => {
    const sim = pair(12, 42);
    const [first, second] = sim.snapshot().aircraft;
    expect(airframesOverlap(first, second)).toBe(false);
    second.heading = Math.PI / 2;
    expect(airframesOverlap(first, second)).toBe(true);
  });
  it("matches the enlarged display footprint on small screens", () => {
    const sim = pair(90, 0);
    const [first, second] = sim.snapshot().aircraft;
    expect(airframesOverlap(first, second)).toBe(false);
    expect(
      airframesOverlap(first, second, { liner: 2, commuter: 2, rotor: 2 }),
    ).toBe(true);
  });
  it("keeps nearby, non-touching traffic as a warning", () => {
    const sim = pair(12, 42);
    sim.update(1 / 60);
    expect(sim.drainEvents()).toContainEqual({
      type: "warning",
      aircraftIds: [1, 2],
    });
  });
  it("excludes aircraft already committed to landing", () => {
    const sim = pair(0, 0);
    sim.snapshot().aircraft[1].state = "landing";
    sim.update(1 / 60);
    expect(sim.snapshot().phase).toBe("running");
  });
  it("still ends the shift when aircraft bodies overlap", () => {
    const sim = pair(10, 0);
    sim.update(1 / 60);
    expect(sim.snapshot().phase).toBe("over");
    expect(sim.drainEvents()).toContainEqual(
      expect.objectContaining({ type: "gameover", reason: "collision" }),
    );
  });
});

import { describe, expect, it } from 'vitest';
import { HOLD_RADIUS, Simulation } from '../../src/core/Simulation';
import { DEFAULT_TRAFFIC_PROFILE, resolveTrafficProfile } from '../../src/core/trafficProfile';
import type { Aircraft, LandingZone } from '../../src/core/types';

const LANDING_ZONES: LandingZone[] = [
  {
    id: 'liner-runway',
    label: 'L',
    accepts: 'liner',
    position: { x: 284, y: 1180 },
    angle: -Math.PI / 2,
    captureRadius: 42,
    color: 0xffffff
  },
  {
    id: 'commuter-runway',
    label: 'C',
    accepts: 'commuter',
    position: { x: 646, y: 1050 },
    angle: -0.7,
    captureRadius: 38,
    color: 0xffffff
  },
  {
    id: 'rotor-pad',
    label: 'H',
    accepts: 'rotor',
    position: { x: 700, y: 1322 },
    angle: 0,
    captureRadius: 42,
    color: 0xffffff
  }
];

const advanceFrames = (simulation: Simulation, count: number): void => {
  for (let frame = 0; frame < count; frame += 1) simulation.update(1 / 60);
};

describe('Simulation', () => {
  it('is deterministic for a seed', () => {
    const first = new Simulation(LANDING_ZONES);
    const second = new Simulation(LANDING_ZONES);
    first.start(42);
    second.start(42);

    advanceFrames(first, 120);
    advanceFrames(second, 120);

    expect(second.snapshot()).toEqual(first.snapshot());
  });

  it('keeps the implicit and explicit default profiles deterministic', () => {
    const implicit = new Simulation(LANDING_ZONES);
    const explicit = new Simulation(LANDING_ZONES, undefined, DEFAULT_TRAFFIC_PROFILE);
    implicit.start(73);
    explicit.start(73);

    advanceFrames(implicit, 1_440);
    advanceFrames(explicit, 1_440);

    expect(explicit.snapshot()).toEqual(implicit.snapshot());
    expect(explicit.drainEvents()).toEqual(implicit.drainEvents());
  });

  it('can assign a smoothed route to an active aircraft', () => {
    const simulation = new Simulation(LANDING_ZONES);
    simulation.start(11);
    const aircraft = simulation.snapshot().aircraft[0];

    const result = simulation.assignRoute(aircraft.id, [
      { ...aircraft.position },
      { x: 450, y: 500 },
      { x: 284, y: 1180 }
    ]);

    expect(result).toEqual({ accepted: true, aircraftId: aircraft.id });
    expect(simulation.snapshot().aircraft[0].route?.points.length).toBeGreaterThan(3);
  });

  it('snaps an accepted destination route to the exact zone center after smoothing', () => {
    const simulation = new Simulation(LANDING_ZONES);
    simulation.start(11);
    const aircraft = simulation.snapshot().aircraft[0];
    const zone = LANDING_ZONES.find((candidate) => candidate.accepts === aircraft.type)!;

    const result = simulation.assignRoute(
      aircraft.id,
      [
        { ...aircraft.position },
        { x: 450, y: 500 },
        { x: zone.position.x + 19, y: zone.position.y - 14 }
      ],
      zone.id
    );

    expect(result).toEqual({
      accepted: true,
      aircraftId: aircraft.id,
      destinationZoneId: zone.id
    });
    const route = simulation.snapshot().aircraft[0].route!;
    expect(route.destinationZoneId).toBe(zone.id);
    expect(route.points[route.points.length - 1]).toEqual(zone.position);
  });

  it('rejects a wrong destination without replacing the existing route', () => {
    const simulation = new Simulation(LANDING_ZONES);
    simulation.start(11);
    const aircraft = simulation.snapshot().aircraft[0];
    simulation.assignRoute(aircraft.id, [
      { ...aircraft.position },
      { x: 450, y: 500 }
    ]);
    const previousRoute = simulation.snapshot().aircraft[0].route;
    const wrongZone = LANDING_ZONES.find((zone) => zone.accepts !== aircraft.type)!;

    const result = simulation.assignRoute(
      aircraft.id,
      [{ ...aircraft.position }, { ...wrongZone.position }],
      wrongZone.id
    );

    expect(result).toEqual({
      accepted: false,
      aircraftId: aircraft.id,
      reason: 'wrong-destination',
      destinationZoneId: wrongZone.id
    });
    expect(simulation.snapshot().aircraft[0].route).toBe(previousRoute);
  });

  it('reports stable reasons for unavailable route assignments', () => {
    const simulation = new Simulation(LANDING_ZONES);
    expect(simulation.assignRoute(9, [{ x: 0, y: 0 }, { x: 30, y: 30 }])).toEqual({
      accepted: false,
      aircraftId: 9,
      reason: 'simulation-inactive',
      destinationZoneId: undefined
    });

    simulation.start(11);
    const aircraft = simulation.snapshot().aircraft[0];
    expect(simulation.assignRoute(
      aircraft.id,
      [{ ...aircraft.position }, { x: 400, y: 400 }],
      'missing-zone'
    )).toEqual({
      accepted: false,
      aircraftId: aircraft.id,
      reason: 'destination-not-found',
      destinationZoneId: 'missing-zone'
    });
  });

  it('emits landing-started before landed with aircraft and zone identities', () => {
    const simulation = new Simulation(LANDING_ZONES);
    simulation.start(11);
    simulation.drainEvents();
    const aircraft = simulation.snapshot().aircraft[0];
    const zone = LANDING_ZONES.find((candidate) => candidate.accepts === aircraft.type)!;
    aircraft.position = { ...zone.position };
    aircraft.heading = 0;

    advanceFrames(simulation, 1);
    expect(simulation.drainEvents()).toEqual([
      { type: 'landing-started', aircraftId: aircraft.id, zoneId: zone.id }
    ]);

    advanceFrames(simulation, 60);
    expect(simulation.drainEvents()).toEqual([
      { type: 'landed', aircraftId: aircraft.id, aircraftType: 'commuter', score: 1 }
    ]);
  });

  it('starts with one commuter and does not double-spawn on the first tick', () => {
    const simulation = new Simulation([], { width: 10_000, height: 10_000 });
    simulation.start(7);

    expect(simulation.snapshot().aircraft).toHaveLength(1);
    expect(simulation.snapshot().aircraft[0].type).toBe('commuter');

    advanceFrames(simulation, 1);

    expect(simulation.snapshot().aircraft).toHaveLength(1);
  });

  it('uses the scripted opening at 0, 12, and 24 seconds', () => {
    const simulation = new Simulation([], { width: 10_000, height: 10_000 });
    simulation.start(19);

    advanceFrames(simulation, 719);
    expect(simulation.snapshot().elapsed).toBeLessThan(12);
    expect(simulation.snapshot().aircraft.map((aircraft) => aircraft.type)).toEqual(['commuter']);

    advanceFrames(simulation, 1);
    expect(simulation.snapshot().elapsed).toBeCloseTo(12, 8);
    expect(simulation.snapshot().aircraft.map((aircraft) => aircraft.type)).toEqual([
      'commuter',
      'liner'
    ]);

    advanceFrames(simulation, 719);
    expect(simulation.snapshot().elapsed).toBeLessThan(24);
    expect(simulation.snapshot().aircraft).toHaveLength(2);

    advanceFrames(simulation, 1);
    expect(simulation.snapshot().elapsed).toBeCloseTo(24, 8);
    expect(simulation.snapshot().aircraft.map((aircraft) => aircraft.type)).toEqual([
      'commuter',
      'liner',
      'rotor'
    ]);
  });

  it('applies the slower speed scale with no more than three percent variance', () => {
    const simulation = new Simulation([], { width: 10_000, height: 10_000 });
    simulation.start(31);
    advanceFrames(simulation, 1_440);

    const baseSpeeds = { commuter: 92, liner: 118, rotor: 72 } as const;
    for (const aircraft of simulation.snapshot().aircraft) {
      const scaledBase = baseSpeeds[aircraft.type] * 0.52;
      expect(aircraft.speed).toBeGreaterThanOrEqual(scaledBase * 0.97);
      expect(aircraft.speed).toBeLessThanOrEqual(scaledBase * 1.03);
    }
  });

  it('uses supplied landscape bounds for edge spawning', () => {
    const simulation = new Simulation([], { width: 1600, height: 900 });
    simulation.start(5);
    const { position } = simulation.snapshot().aircraft[0];

    const isOnLandscapeEdge =
      position.x === -42 || position.x === 1642 || position.y === -42 || position.y === 942;
    expect(isOnLandscapeEdge).toBe(true);
    expect(position.x).not.toBe(942);
  });

  it('uses a resolved profile for opening type, speed, and normalized spawn geometry', () => {
    const profile = resolveTrafficProfile({
      ...DEFAULT_TRAFFIC_PROFILE,
      openingSpawns: [{ at: 0, type: 'liner' }],
      speedMultipliers: { liner: 0.25, commuter: 0.52, rotor: 0.52 },
      spawnCorridors: [{ edge: 'top', from: 0.1, to: 0.1 }],
      inwardTargetRegion: { minX: 0.5, maxX: 0.5, minY: 0.5, maxY: 0.5 }
    });
    const simulation = new Simulation([], { width: 10_000, height: 8_000 }, profile);
    simulation.start(5);

    const aircraft = simulation.snapshot().aircraft[0];
    expect(aircraft.type).toBe('liner');
    expect(aircraft.position).toEqual({ x: 1_000, y: -42 });
    expect(aircraft.heading).toBeCloseTo(Math.atan2(4_042, 4_000), 10);
    expect(aircraft.speed).toBeGreaterThanOrEqual(118 * 0.25 * 0.97);
    expect(aircraft.speed).toBeLessThanOrEqual(118 * 0.25 * 1.03);
  });

  it('uses profile aircraft weights for non-opening spawns', () => {
    const profile = resolveTrafficProfile({
      ...DEFAULT_TRAFFIC_PROFILE,
      openingSpawns: [],
      aircraftTypeWeights: [{ type: 'rotor', weight: 1 }],
      spawnIntervalStages: [{ at: 0, interval: 0.1 }],
      trafficLimitStages: [{ at: 0, limit: 2 }]
    });
    const simulation = new Simulation([], { width: 10_000, height: 10_000 }, profile);
    simulation.start(17);

    expect(simulation.snapshot().aircraft).toHaveLength(0);
    advanceFrames(simulation, 6);
    expect(simulation.snapshot().aircraft.map((aircraft) => aircraft.type)).toEqual(['rotor']);
  });
});

it('preserves routed aircraft and scheduling across a long resize pause', () => {
  const control = new Simulation(LANDING_ZONES);
  const resized = new Simulation(LANDING_ZONES);
  for (const simulation of [control, resized]) {
    simulation.start(11);
    const plane = simulation.snapshot().aircraft[0];
    expect(simulation.assignRoute(plane.id, [{ ...plane.position }, { x: 450, y: 500 }, { x: 284, y: 1180 }]).accepted).toBe(true);
    advanceFrames(simulation, 30);
  }
  resized.pause();
  const paused = structuredClone(resized.snapshot());
  advanceFrames(resized, 3600);
  expect(resized.snapshot()).toEqual(paused);
  resized.resume();
  advanceFrames(control, 600);
  advanceFrames(resized, 600);
  expect(resized.snapshot()).toEqual(control.snapshot());
  expect(resized.drainEvents()).toEqual(control.drainEvents());
});

describe('Simulation holding', () => {
  const heldAircraft = (setup: (aircraft: Aircraft) => void = () => {}) => {
    const simulation = new Simulation(LANDING_ZONES);
    simulation.start(11);
    const aircraft = simulation.snapshot().aircraft[0];
    aircraft.position = { x: 450, y: 500 };
    aircraft.heading = 0;
    aircraft.hasEntered = true;
    aircraft.state = 'flying';
    setup(aircraft);
    simulation.drainEvents();
    return { simulation, aircraft };
  };

  it('circles within its hold for ten seconds', () => {
    const { simulation, aircraft } = heldAircraft();
    const start = { ...aircraft.position };
    expect(simulation.holdAircraft(aircraft.id)).toBe(true);
    let farthest = 0;
    for (let frame = 0; frame < 600; frame += 1) {
      simulation.update(1 / 60);
      farthest = Math.max(farthest, Math.hypot(aircraft.position.x - start.x, aircraft.position.y - start.y));
    }
    expect(farthest).toBeLessThanOrEqual(2 * HOLD_RADIUS + 0.5);
    expect(simulation.drainEvents().some((event) => event.type === 'gameover')).toBe(false);
  });

  it('never leaves the airspace when held just inside an edge, heading out or along it', () => {
    for (const [position, heading] of [[{ x: 4, y: 800 }, Math.PI], [{ x: 896, y: 800 }, 0], [{ x: 450, y: 4 }, -Math.PI / 2], [{ x: 450, y: 1596 }, Math.PI / 2], [{ x: 4, y: 800 }, Math.PI / 2], [{ x: 4, y: 800 }, -Math.PI / 2], [{ x: 896, y: 800 }, Math.PI / 2], [{ x: 450, y: 4 }, 0], [{ x: 450, y: 4 }, Math.PI]] as const) {
      const { simulation, aircraft } = heldAircraft((item) => { item.position = { ...position }; item.heading = heading; });
      simulation.holdAircraft(aircraft.id);
      advanceFrames(simulation, 600);
      expect(simulation.drainEvents().some((event) => event.type === 'gameover')).toBe(false);
    }
  });

  it('refuses aircraft that are landing or have not entered', () => {
    const landing = heldAircraft((item) => { item.state = 'landing'; });
    expect(landing.simulation.holdAircraft(landing.aircraft.id)).toBe(false);
    const entering = heldAircraft((item) => { item.hasEntered = false; item.state = 'entering'; });
    expect(entering.simulation.holdAircraft(entering.aircraft.id)).toBe(false);
  });

  it('drops the route to hold, and a new route releases the hold', () => {
    const { simulation, aircraft } = heldAircraft();
    simulation.assignRoute(aircraft.id, [{ ...aircraft.position }, { x: 450, y: 900 }]);
    simulation.holdAircraft(aircraft.id);
    expect(aircraft.route).toBeUndefined();
    expect(aircraft.holding).toBeDefined();
    expect(simulation.assignRoute(aircraft.id, [{ ...aircraft.position }, { x: 300, y: 900 }]).accepted).toBe(true);
    expect(aircraft.holding).toBeUndefined();
    expect(aircraft.route).toBeDefined();
  });
});

describe('Simulation save and restore', () => {
  it('continues a JSON round-tripped shift exactly like an uninterrupted one', () => {
    const play = (simulation: Simulation, from: number, to: number) => {
      for (let frame = from; frame < to; frame += 1) {
        if (frame === 120) {
          const first = simulation.snapshot().aircraft[0];
          simulation.assignRoute(first.id, [{ ...first.position }, { x: 450, y: 700 }, LANDING_ZONES[1].position], 'commuter-runway');
        }
        if (frame === 800) {
          const flying = simulation.snapshot().aircraft.find((item) => item.state === 'flying');
          if (flying) simulation.holdAircraft(flying.id);
        }
        simulation.update(1 / 60);
      }
    };
    const control = new Simulation(LANDING_ZONES);
    control.start(7);
    play(control, 0, 1800);

    const first = new Simulation(LANDING_ZONES);
    first.start(7);
    play(first, 0, 900);
    first.pause();
    const saved = JSON.parse(JSON.stringify(first.exportState()));
    const resumed = new Simulation(LANDING_ZONES);
    resumed.restore(saved);
    expect(resumed.snapshot().phase).toBe('paused');
    resumed.resume();
    play(resumed, 900, 1800);

    expect(resumed.snapshot()).toEqual(control.snapshot());
  });
});

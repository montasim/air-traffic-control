import { describe, expect, it } from 'vitest';
import { FADE_SECONDS, GroundTraffic, SETTLE_SECONDS } from '../../src/game/ground/groundTraffic';
import type { GroundRoute, GroundStand } from '../../src/game/maps/types';

// A straight runway rollout (0→400) then a taxiway north to an apron with two liner stands.
const STANDS: GroundStand[] = [
  { id: 'a', position: { x: 440, y: 260 }, angle: 0, accepts: 'liner' },
  { id: 'b', position: { x: 360, y: 260 }, angle: Math.PI, accepts: 'liner' },
];
const route = (stands = 2): GroundRoute => ({
  points: [{ x: 0, y: 500 }, { x: 400, y: 500 }, { x: 400, y: 300 }],
  rolloutLength: 400,
  stands: STANDS.slice(0, stands),
});
const traffic = (stands = 2) => new GroundTraffic({ runway: route(stands) }, { unit: 900, gap: 80 });
const arrival = (id: number) => ({ id, type: 'liner' as const, position: { x: 0, y: 500 }, heading: 0, speed: 120 });
const run = (ground: GroundTraffic, seconds: number, onStep?: () => void) => {
  for (let t = 0; t < seconds; t += 1 / 60) { ground.update(1 / 60); onStep?.(); }
};
const state = (ground: GroundTraffic, id: number) => ground.aircraft.find((plane) => plane.id === id);
const runUntilParked = (ground: GroundTraffic, id: number) => {
  for (let t = 0; t < 30 && state(ground, id)?.phase !== 'parked'; t += 1 / 60) ground.update(1 / 60);
};

describe('ground traffic', () => {
  it('rolls out decelerating, taxis, and parks, then stays parked', () => {
    const ground = traffic();
    ground.add(arrival(1), 'runway');
    const xs: number[] = [];
    run(ground, 1, () => xs.push(state(ground, 1)!.position.x));
    expect(xs[59] - xs[30]).toBeLessThan(xs[29] - xs[0]);
    runUntilParked(ground, 1);
    run(ground, 30);
    // No timer: a parked fixed-wing aircraft waits to be replaced.
    expect(state(ground, 1)?.phase).toBe('parked');
    expect(state(ground, 1)?.alpha).toBe(1);
  });

  it('keeps one parked aircraft per type: the previous one fades once the newcomer parks', () => {
    const ground = traffic();
    ground.add(arrival(1), 'runway');
    runUntilParked(ground, 1);
    ground.add(arrival(2), 'runway');
    // While the newcomer taxis to the other stand, the first stays parked.
    run(ground, 1);
    expect(state(ground, 1)?.phase).toBe('parked');
    runUntilParked(ground, 2);
    expect(state(ground, 1)?.phase).toBe('fading');
    run(ground, FADE_SECONDS + 0.05);
    expect(state(ground, 1)).toBeUndefined();
    expect(state(ground, 2)?.phase).toBe('parked');
  });

  it('with every stand taken, the parked aircraft leaves only as the newcomer approaches', () => {
    const ground = traffic(1);
    ground.add(arrival(1), 'runway');
    runUntilParked(ground, 1);
    ground.add(arrival(2), 'runway');
    run(ground, 1);
    // Still parked while the newcomer is far away: the apron is never empty.
    expect(state(ground, 1)?.phase).toBe('parked');
    let fadedNear = Infinity;
    run(ground, 12, () => {
      if (fadedNear === Infinity && state(ground, 1)?.phase === 'fading') {
        const b = state(ground, 2)!;
        fadedNear = Math.hypot(b.position.x - 440, b.position.y - 260);
      }
    });
    expect(fadedNear).toBeLessThan(80 * 2 + 1);
    expect(state(ground, 2)?.phase).toBe('parked');
  });

  it('follows the taxilane and lead-in of a typed stand', () => {
    const lane = [{ x: 400, y: 300 }, { x: 400, y: 200 }, { x: 440, y: 200 }];
    const typed: GroundStand = { id: 't', position: { x: 440, y: 160 }, angle: -Math.PI / 2, accepts: 'liner', approach: [...lane, { x: 440, y: 160 }] };
    const ground = new GroundTraffic({ runway: { ...route(), stands: [typed] } }, { unit: 900, gap: 80 });
    ground.add(arrival(4), 'runway');
    let passedLane = false;
    run(ground, 20, () => { const p = state(ground, 4)!.position; if (Math.abs(p.y - 200) < 2 && p.x > 410 && p.x < 430) passedLane = true; });
    expect(passedLane).toBe(true);
    expect(state(ground, 4)?.position).toEqual({ x: 440, y: 160 });
  });

  it('makes a follower wait behind the aircraft ahead instead of overlapping', () => {
    const ground = traffic();
    ground.add(arrival(1), 'runway');
    run(ground, 0.4);
    ground.add(arrival(2), 'runway');
    let closest = Infinity;
    let waited = false;
    run(ground, 12, () => {
      const [a, b] = [state(ground, 1), state(ground, 2)];
      if (!a || !b || a.phase === 'fading') return;
      // Spacing applies on the shared path; at the apron they park at neighbouring stands.
      if (a.position.y > 301 && b.position.y > 301) closest = Math.min(closest, Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y));
      if (b.phase !== 'parked' && b.phase !== 'fading') {
        const before = b.position;
        ground.update(0);
        if (state(ground, 2)!.position.x === before.x && state(ground, 2)!.position.y === before.y) waited = true;
      }
    });
    expect(closest).toBeGreaterThan(80 * 0.8);
    expect(waited).toBe(true);
  });

  it('seeds one parked aircraft, which a landed aircraft of the same type replaces', () => {
    const ground = traffic();
    ground.seed([{ id: -1, type: 'liner', stand: STANDS[0] }]);
    expect(state(ground, -1)).toMatchObject({ phase: 'parked', position: STANDS[0].position });
    ground.add(arrival(1), 'runway');
    runUntilParked(ground, 1);
    // The seeded aircraft held stand a, so the newcomer used the free stand b and then replaced it.
    expect(state(ground, 1)?.position).toEqual(STANDS[1].position);
    expect(state(ground, -1)?.phase).toBe('fading');
  });

  it('passes an aircraft parked on a neighbouring stand in line with the lane', () => {
    // The seeded aircraft sits on stand b, straight ahead of the lane toward stand a.
    const inLine: GroundStand[] = [
      { id: 'a', position: { x: 400, y: 240 }, angle: -Math.PI / 2, accepts: 'liner' },
      { id: 'b', position: { x: 400, y: 200 }, angle: -Math.PI / 2, accepts: 'liner' },
    ];
    const ground = new GroundTraffic({ runway: { ...route(), stands: inLine } }, { unit: 900, gap: 80 });
    ground.seed([{ id: -1, type: 'liner', stand: inLine[1] }]);
    ground.add(arrival(1), 'runway');
    runUntilParked(ground, 1);
    expect(state(ground, 1)?.position).toEqual(inLine[0].position);
  });

  it('settles helicopters in place, then fades them', () => {
    const ground = traffic();
    ground.add({ ...arrival(5), type: 'rotor', position: { x: 50, y: 50 } }, 'pad-without-route');
    expect(state(ground, 5)?.phase).toBe('parked');
    run(ground, SETTLE_SECONDS + 0.05);
    expect(state(ground, 5)?.phase).toBe('fading');
    expect(state(ground, 5)?.position).toEqual({ x: 50, y: 50 });
    run(ground, FADE_SECONDS + 0.05);
    expect(state(ground, 5)).toBeUndefined();
  });

  it('with reduced motion, fades the landed aircraft in at its stand and replaces the previous one', () => {
    const ground = traffic(1);
    ground.seed([{ id: -1, type: 'liner', stand: STANDS[0] }]);
    ground.add(arrival(7), 'runway', true);
    expect(state(ground, 7)).toMatchObject({ phase: 'appearing', alpha: 0, position: STANDS[0].position });
    expect(state(ground, -1)?.phase).toBe('fading');
    run(ground, FADE_SECONDS + 0.05);
    expect(state(ground, 7)?.phase).toBe('parked');
    expect(state(ground, -1)).toBeUndefined();
  });

  it('parks along the stand line facing the way it arrived, without spinning around', () => {
    // Stand marked at angle π; the aircraft arrives heading north-east, so it parks facing 0 instead.
    const ground = new GroundTraffic({ runway: { ...route(), stands: [{ id: 'a', position: { x: 440, y: 260 }, angle: Math.PI }] } }, { unit: 900, gap: 80 });
    ground.add(arrival(3), 'runway');
    let worstTurn = 0;
    let previous: number | undefined;
    let finalHeading = NaN;
    run(ground, 12, () => {
      const plane = state(ground, 3);
      if (plane?.phase !== 'parked') return;
      previous ??= plane.heading;
      finalHeading = plane.heading;
      worstTurn = Math.max(worstTurn, Math.abs(Math.atan2(Math.sin(plane.heading - previous), Math.cos(plane.heading - previous))));
      previous = plane.heading;
    });
    expect(Math.abs(Math.atan2(Math.sin(finalHeading), Math.cos(finalHeading)))).toBeLessThan(0.05);
    expect(worstTurn).toBeLessThan(0.2);
  });

  it('pivots in place at a reversal instead of curving through it', () => {
    const ground = new GroundTraffic({
      back: { points: [{ x: 0, y: 500 }, { x: 400, y: 500 }, { x: 200, y: 500 }, { x: 200, y: 300 }], rolloutLength: 400, stands: [{ id: 's', position: { x: 200, y: 260 }, angle: 0 }] },
    }, { unit: 900, gap: 80 });
    ground.add(arrival(9), 'back');
    let pivoted = false;
    run(ground, 15, () => { const plane = state(ground, 9); if (plane?.phase === 'pivoting') { pivoted = true; expect(plane.position.x).toBeCloseTo(400); } });
    expect(pivoted).toBe(true);
  });
});

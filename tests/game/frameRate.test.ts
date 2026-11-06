import { describe, expect, it } from 'vitest';
import { capFrameRate } from '../../src/game/frameRate';

const run = (hz: number, seconds: number, fullRate = () => false) => {
  const steps: number[] = [];
  const loop = { callback: (_time: number, delta: number) => { steps.push(delta); } };
  capFrameRate(loop, fullRate);
  for (let frame = 1; frame <= hz * seconds; frame += 1) loop.callback(frame * 1000 / hz, 1000 / hz);
  return steps;
};
const total = (steps: number[]) => steps.reduce((sum, delta) => sum + delta, 0);

describe('capFrameRate', () => {
  it.each([60, 120])('steps about 30 times a second on a %i Hz screen, keeping real time', (hz) => {
    const steps = run(hz, 10);
    expect(steps.length).toBe(300);
    expect(total(steps)).toBeCloseTo(10_000, 0);
  });

  it('steps every frame while drawing', () => {
    expect(run(60, 1, () => true)).toHaveLength(60);
  });
});

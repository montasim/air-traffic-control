import { describe, it, expect } from 'vitest';
import { applyDifficulty } from '../../src/core/difficulty';
import { MAP_TRAFFIC_PROFILES } from '../../src/game/maps/trafficProfiles';
import { Simulation } from '../../src/core/Simulation';

describe('difficulty pacing', () => {
  for (const [map, base] of Object.entries(MAP_TRAFFIC_PROFILES)) {
    it(`preserves Medium and bounds traffic on ${map}`, () => {
      const before = JSON.stringify(base);
      expect(applyDifficulty(base, 'medium')).toBe(base);
      const easy = applyDifficulty(base, 'easy');
      const hard = applyDifficulty(base, 'hard');
      expect(easy.spawnIntervalStages[0].interval).toBeGreaterThan(base.spawnIntervalStages[0].interval);
      expect(hard.spawnIntervalStages[0].interval).toBeLessThan(base.spawnIntervalStages[0].interval);
      expect(easy.speedMultipliers.liner).toBeLessThan(hard.speedMultipliers.liner);
      expect(easy.openingSpawns[0].at).toBe(0);
      expect(Math.max(...hard.trafficLimitStages.map(s => s.limit))).toBeLessThanOrEqual(11);
      expect(JSON.stringify(base)).toBe(before);
      const old = new Simulation([], { width: 900, height: 1600 }, base);
      const medium = new Simulation([], { width: 900, height: 1600 }, applyDifficulty(base, 'medium'));
      old.start(42); medium.start(42);
      for (let i = 0; i < 600; i++) { old.update(1 / 60); medium.update(1 / 60); }
      expect(medium.snapshot()).toEqual(old.snapshot());
    });
  }
});

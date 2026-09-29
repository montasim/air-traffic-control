import { MAP_IDS, ORIGINAL_MAP_IDS, EXPANSION_MAP_IDS } from '../game/maps/mapIds';
import type { GameSaveV3 } from '../storage/gameSave';
import type { AircraftType, SimulationEvent } from '../core/types';

export interface ShiftEvidence {
  landedTypes: Record<AircraftType, number>;
  initialSafeLandings: number;
}
export class ShiftTracker {
  private warned = false;
  readonly evidence: ShiftEvidence = { landedTypes: { liner: 0, commuter: 0, rotor: 0 }, initialSafeLandings: 0 };
  accept(event: SimulationEvent): void {
    if (event.type === 'warning') this.warned = true;
    if (event.type === 'landed') {
      this.evidence.landedTypes[event.aircraftType]++;
      if (!this.warned) this.evidence.initialSafeLandings++;
    }
  }
}
export const ACHIEVEMENTS = [
  { id: 'first-landing', name: 'First Landing', description: 'Record your first safe landing.', goal: 1, value: (s: GameSaveV3) => s.career.totalSafeLandings },
  { id: 'getting-comfortable', name: 'Getting Comfortable', description: 'Record 10 safe landings across shifts.', goal: 10, value: (s: GameSaveV3) => s.career.totalSafeLandings },
  { id: 'busy-shift', name: 'Busy Shift', description: 'Land 10 aircraft in one completed shift.', goal: 10, value: (s: GameSaveV3) => Math.max(...MAP_IDS.flatMap(id => Object.values(s.mapRecords[id].bestScores))) },
  { id: 'mixed-fleet', name: 'Mixed Fleet', description: 'Land all three aircraft types in one completed shift.', goal: 3, value: (s: GameSaveV3) => s.achievementEvidence.mixedFleetBest },
  { id: 'steady-hands', name: 'Steady Hands', description: 'Land 10 aircraft before the first warning in a completed shift.', goal: 10, value: (s: GameSaveV3) => s.achievementEvidence.initialSafeBest },
  { id: 'airfield-explorer', name: 'Airfield Explorer', description: 'Record a landing on each of the original four airfields.', goal: 4, value: (s: GameSaveV3) => ORIGINAL_MAP_IDS.filter(id => s.mapRecords[id].safeLandings > 0).length },
  { id: 'expanded-horizons', name: 'Expanded Horizons', description: 'Record a landing on each of the five specialist airfields.', goal: 5, value: (s: GameSaveV3) => EXPANSION_MAP_IDS.filter(id => s.mapRecords[id].safeLandings > 0).length },
  { id: 'under-pressure', name: 'Under Pressure', description: 'Land 10 aircraft in one completed Hard shift.', goal: 10, value: (s: GameSaveV3) => Math.max(...MAP_IDS.flatMap(id => Object.values(s.mapRecords[id].difficultyScores.hard))) },
  { id: 'veteran-controller', name: 'Veteran Controller', description: 'Record 100 safe landings across shifts.', goal: 100, value: (s: GameSaveV3) => s.career.totalSafeLandings }
] as const;
export type AchievementId = typeof ACHIEVEMENTS[number]['id'];
export type AchievementAwards = Partial<Record<AchievementId, { earnedAt: number | null }>>;
export function evaluateAchievements(save: GameSaveV3, earnedAt: number | null): { awards: AchievementAwards; newIds: AchievementId[] } {
  const awards = { ...save.achievements };
  const newIds: AchievementId[] = [];
  for (const item of ACHIEVEMENTS) {
    if (!awards[item.id] && item.value(save) >= item.goal) {
      awards[item.id] = { earnedAt };
      newIds.push(item.id);
    }
  }
  return { awards, newIds };
}

import type { SimulationState } from '../core/Simulation';
import { isDifficulty, type DifficultyId } from '../core/difficulty';
import { isMapId, type MapId } from '../game/maps/mapIds';
import type { ShiftTrackerState } from '../progression/achievements';
import { sealMatches, sealOf } from './saveSeal';

/** A paused shift kept on this device so it survives the app closing. */
export interface ActiveShift {
  version: 1;
  savedAt: number;
  runId: string;
  mapId: MapId;
  difficulty: DifficultyId;
  orientation: 'portrait' | 'landscape';
  world: { width: number; height: number };
  twoEndLanding: boolean;
  simulation: SimulationState;
  tracker: ShiftTrackerState;
}

const ACTIVE_SHIFT_KEY = 'vector-approach:active-shift';

// localStorage, not IndexedDB: the write must finish synchronously while the page is being hidden.
export function saveActiveShift(shift: ActiveShift, storage: Storage = globalThis.localStorage): void {
  try {
    storage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify({ ...shift, seal: sealOf(shift) }));
  } catch {
    // Private mode or a full disk: the shift simply is not resumable.
  }
}

export function clearActiveShift(storage: Storage = globalThis.localStorage): void {
  try {
    storage.removeItem(ACTIVE_SHIFT_KEY);
  } catch {
    // Nothing stored to clear.
  }
}

const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** The stored shift, or undefined after clearing anything unreadable, stale, or edited. */
export function loadActiveShift(storage: Storage = globalThis.localStorage): ActiveShift | undefined {
  try {
    const raw = storage.getItem(ACTIVE_SHIFT_KEY);
    if (raw === null) return undefined;
    // canonicalJson writes Infinity as null, just like JSON, so the seal survives the round trip.
    const { seal, ...shift } = JSON.parse(raw) ?? {};
    if (
      sealMatches(shift, seal) &&
      shift.version === 1 &&
      typeof shift.runId === 'string' &&
      isMapId(shift.mapId) &&
      isDifficulty(shift.difficulty) &&
      (shift.orientation === 'portrait' || shift.orientation === 'landscape') &&
      positive(shift.world?.width) && positive(shift.world?.height) &&
      typeof shift.twoEndLanding === 'boolean' &&
      Array.isArray(shift.simulation?.aircraft) &&
      typeof shift.tracker?.evidence === 'object'
    ) return shift as ActiveShift;
  } catch {
    // Malformed JSON falls through to clearing.
  }
  clearActiveShift(storage);
  return undefined;
}

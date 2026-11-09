import type { LiveryId } from '../../progression/liveries';
import type { MapDefinition } from '../maps/types';
import type { WorldDetailLevel } from '../palette';
import type { SimulationState } from '../../core/Simulation';
import type { SimulationSnapshot } from '../../core/types';
import type { DifficultyId } from '../../core/difficulty';
import type { ShiftTrackerState, ShiftEvidence } from '../../progression/achievements';
import type { PlayableMapLayout } from '../maps/types';

export interface SavedSession {
  runId: string;
  simulation: SimulationState;
  tracker: ShiftTrackerState;
}

/** Application-facing operations; neither the UI nor saved shifts depend on a render engine. */
export interface GameplaySession {
  startRun(difficulty?: DifficultyId, runId?: string): void;
  pauseRun(): void;
  resumeRun(): void;
  cancelDrawing(): void;
  exportShift(): SavedSession;
  restoreRun(difficulty: DifficultyId, shift: SavedSession): boolean;
  getPhase(): SimulationSnapshot['phase'];
  getLayout(): PlayableMapLayout;
  getShiftSnapshot(): {
    twoEndLanding: boolean;
    runId: string;
    simulation: SimulationSnapshot;
    landingZones: PlayableMapLayout['landingZones'];
    evidence: ShiftEvidence;
  };
  setTimeScale(scale: number): void;
  setNight(enabled: boolean): void;
  setWeather(enabled: boolean): void;
}

export interface RuntimeEvents {
  on(event: string, listener: (...args: any[]) => void): unknown;
  once(event: string, listener: (...args: any[]) => void): unknown;
}

export interface FrameSource {
  /** Callback runs immediately after rendering, before a WebGL drawing buffer can be discarded. */
  captureFrame(callback: (canvas: HTMLCanvasElement) => void): void;
}

export interface GameplayRuntime extends FrameSource {
  readonly events: RuntimeEvents;
  readonly world: Readonly<{ width: number; height: number }>;
  readonly running: boolean;
  getSession(): GameplaySession | undefined;
  wake(): void;
  sleep(): void;
  destroy(): void;
}

export interface RuntimeOptions {
  map: MapDefinition;
  world: { width: number; height: number };
  renderScale: number;
  twoEndLanding: boolean;
  livery: LiveryId;
  night: boolean;
  mobile: boolean;
  detailLevel?: WorldDetailLevel;
  onContextRestored: () => void;
}

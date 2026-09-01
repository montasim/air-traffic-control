export type AudioCue =
  | 'route-connected'
  | 'landing-completed'
  | 'collision'
  | 'promotion'
  | 'ui-confirm';

export interface AudioSettings {
  enabled: boolean;
  volume: number;
}

export interface AudioBackend {
  unlock(): Promise<void>;
  setVolume(volume: number): void;
  play(cue: AudioCue, priority: number): void;
  suspend(): Promise<void>;
  destroy(): Promise<void>;
}


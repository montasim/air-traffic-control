import type { AudioBackend, AudioCue } from './types';

const MAX_VOICES = 4;
const VOLUME_RAMP_SECONDS = 0.025;

interface Voice {
  readonly priority: number;
  readonly sequence: number;
  stop(): void;
}

type AudioContextConstructor = new () => AudioContext;

export class AudioUnavailableError extends Error {
  constructor(message = 'Web Audio is unavailable') {
    super(message);
    this.name = 'AudioUnavailableError';
  }
}

function contextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export class WebAudioBackend implements AudioBackend {
  private context?: AudioContext;
  private master?: GainNode;
  private targetVolume = 0.65;
  private readonly voices = new Set<Voice>();
  private voiceSequence = 0;
  private lifecycle = 0;
  private destroyed = false;
  private unlockPromise?: Promise<void>;
  private suspendPromise?: Promise<void>;
  private destroyPromise?: Promise<void>;

  unlock(): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new AudioUnavailableError('Web Audio backend was destroyed'));
    }
    if (!this.unlockPromise) {
      const lifecycle = this.lifecycle;
      const unlockPromise = this.unlockContext(lifecycle).finally(() => {
        if (this.unlockPromise === unlockPromise) this.unlockPromise = undefined;
      });
      this.unlockPromise = unlockPromise;
    }
    return this.unlockPromise;
  }

  setVolume(volume: number): void {
    this.targetVolume = clampVolume(volume);
    this.rampMasterVolume();
  }

  play(cue: AudioCue, priority: number): void {
    if (
      this.destroyed
      || !this.context
      || !this.master
      || this.context.state !== 'running'
    ) return;

    if (cue === 'route-connected') {
      this.tone(760, 620, 0.085, 'triangle', 0.18, priority);
    } else if (cue === 'landing-completed') {
      this.tone(460, 620, 0.16, 'sine', 0.2, priority);
      this.tone(650, 820, 0.18, 'sine', 0.16, priority, 0.1);
    } else if (cue === 'collision') {
      this.stopLowerPriority(priority);
      this.tone(190, 72, 0.48, 'sawtooth', 0.28, priority);
      this.tone(420, 160, 0.28, 'square', 0.12, priority, 0.04);
    } else if (cue === 'promotion') {
      this.tone(440, 560, 0.18, 'triangle', 0.17, priority);
      this.tone(560, 700, 0.2, 'triangle', 0.17, priority, 0.14);
      this.tone(700, 920, 0.28, 'sine', 0.16, priority, 0.29);
    } else {
      this.tone(410, 480, 0.045, 'triangle', 0.08, priority);
    }
  }

  suspend(): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    if (!this.suspendPromise) {
      const pendingUnlock = this.unlockPromise;
      const suspendPromise = Promise.resolve(pendingUnlock)
        .catch(() => undefined)
        .then(async () => {
          const context = this.context;
          if (!this.destroyed && context?.state === 'running') await context.suspend();
        })
        .catch(() => undefined)
        .finally(() => {
          if (this.suspendPromise === suspendPromise) this.suspendPromise = undefined;
        });
      this.suspendPromise = suspendPromise;
    }
    return this.suspendPromise;
  }

  destroy(): Promise<void> {
    if (this.destroyPromise) return this.destroyPromise;

    this.destroyed = true;
    this.lifecycle += 1;
    for (const voice of [...this.voices]) voice.stop();
    this.voices.clear();

    const context = this.context;
    const master = this.master;
    this.context = undefined;
    this.master = undefined;
    try {
      master?.disconnect();
    } catch {
      // Nodes may already be disconnected after an interrupted unlock.
    }

    const destroyPromise = Promise.resolve()
      .then(async () => {
        if (context && context.state !== 'closed') await context.close();
      })
      .catch(() => undefined);
    this.destroyPromise = destroyPromise;
    return destroyPromise;
  }

  private async unlockContext(lifecycle: number): Promise<void> {
    let context = this.context;
    if (!context) {
      const Constructor = contextConstructor();
      if (!Constructor) throw new AudioUnavailableError();

      context = new Constructor();
      const master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      this.context = context;
      this.master = master;
    }

    if (context.state === 'suspended') await context.resume();
    if (
      this.destroyed
      || lifecycle !== this.lifecycle
      || context !== this.context
      || context.state !== 'running'
    ) {
      throw new AudioUnavailableError('Web Audio context did not become playable');
    }
    this.rampMasterVolume();
  }

  private rampMasterVolume(): void {
    const context = this.context;
    const master = this.master;
    if (this.destroyed || !context || !master || context.state === 'closed') return;

    const now = context.currentTime;
    const gain = master.gain;
    gain.cancelScheduledValues(now);
    if ('cancelAndHoldAtTime' in gain && typeof gain.cancelAndHoldAtTime === 'function') {
      gain.cancelAndHoldAtTime(now);
    } else {
      gain.setValueAtTime(gain.value, now);
    }
    gain.linearRampToValueAtTime(this.targetVolume, now + VOLUME_RAMP_SECONDS);
  }

  private tone(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    wave: OscillatorType,
    level: number,
    priority: number,
    delay = 0
  ): void {
    const context = this.context;
    const master = this.master;
    if (
      this.destroyed
      || !context
      || !master
      || context.state !== 'running'
      || !this.makeVoiceRoom(priority)
    ) return;

    const start = context.currentTime + delay;
    const end = start + duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    let cleaned = false;
    let voice: Voice;

    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      try {
        oscillator.disconnect();
      } catch {
        // The oscillator may not have connected when node construction failed.
      }
      try {
        gain.disconnect();
      } catch {
        // The gain may not have connected when node construction failed.
      }
      this.voices.delete(voice);
    };

    voice = {
      priority,
      sequence: this.voiceSequence += 1,
      stop: () => {
        if (cleaned) return;
        try {
          oscillator.stop(context.currentTime);
        } catch {
          // A voice may already have completed naturally.
        }
        cleanup();
      }
    };

    try {
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(startFrequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), end);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        level,
        start + Math.min(0.018, duration * 0.25)
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(master);
      this.voices.add(voice);
      oscillator.addEventListener('ended', cleanup, { once: true });
      oscillator.start(start);
      oscillator.stop(end + 0.025);
    } catch {
      cleanup();
    }
  }

  private makeVoiceRoom(incomingPriority: number): boolean {
    while (this.voices.size >= MAX_VOICES) {
      const candidate = [...this.voices]
        .sort((left, right) => left.priority - right.priority || left.sequence - right.sequence)[0];
      if (!candidate || candidate.priority > incomingPriority) return false;
      candidate.stop();
    }
    return true;
  }

  private stopLowerPriority(priority: number): void {
    for (const voice of [...this.voices]) {
      if (voice.priority >= priority) continue;
      voice.stop();
    }
  }
}

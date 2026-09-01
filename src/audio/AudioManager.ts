import type { FeedbackEvent } from '../app/feedbackEvents';
import type { AudioBackend, AudioCue, AudioSettings } from './types';

const AUDIO_POLICY: Record<AudioCue, { priority: number; cooldown: number }> = {
  collision: { priority: 100, cooldown: 1_500 },
  promotion: { priority: 80, cooldown: 2_000 },
  'landing-completed': { priority: 60, cooldown: 250 },
  'route-connected': { priority: 40, cooldown: 120 },
  'ui-confirm': { priority: 10, cooldown: 80 }
};

const COLLISION_LOCK_MILLISECONDS = 900;

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0.65;
  return Math.min(1, Math.max(0, value));
}

function cueFor(event: FeedbackEvent): AudioCue {
  return event.type === 'landing-completed' ? 'landing-completed' : event.type;
}

export class GameAudio {
  private settings: AudioSettings;
  private unlocked = false;
  private destroyed = false;
  private lifecycle = 0;
  private unlockPromise?: Promise<void>;
  private suspendPromise?: Promise<void>;
  private destroyPromise?: Promise<void>;
  private collisionLockUntil = 0;
  private readonly lastPlayedAt = new Map<AudioCue, number>();

  constructor(
    private readonly backend: AudioBackend,
    settings: AudioSettings = { enabled: true, volume: 0.65 },
    private readonly now: () => number = () => performance.now()
  ) {
    this.settings = {
      enabled: Boolean(settings.enabled),
      volume: clampVolume(settings.volume)
    };
    this.backend.setVolume(this.settings.enabled ? this.settings.volume : 0);
  }

  prepare(): Promise<void> {
    return Promise.resolve();
  }

  async unlock(): Promise<void> {
    if (this.unlocked || this.destroyed) return;
    if (!this.unlockPromise) {
      const lifecycle = this.lifecycle;
      const unlockPromise = this.backend.unlock()
        .then(() => {
          if (this.destroyed || lifecycle !== this.lifecycle) return;
          this.unlocked = true;
          this.backend.setVolume(this.settings.enabled ? this.settings.volume : 0);
        })
        .catch(() => {
          if (lifecycle === this.lifecycle) this.unlocked = false;
        })
        .finally(() => {
          if (this.unlockPromise === unlockPromise) this.unlockPromise = undefined;
        });
      this.unlockPromise = unlockPromise;
    }
    await this.unlockPromise;
  }

  handle(event: FeedbackEvent): void {
    if (this.destroyed || !this.unlocked || !this.settings.enabled || this.settings.volume <= 0) {
      return;
    }

    const cue = cueFor(event);
    const policy = AUDIO_POLICY[cue];
    const currentTime = this.now();
    const lastPlayed = this.lastPlayedAt.get(cue) ?? Number.NEGATIVE_INFINITY;
    if (currentTime - lastPlayed < policy.cooldown) return;
    if (currentTime < this.collisionLockUntil && cue !== 'collision') return;

    if (cue === 'collision') this.collisionLockUntil = currentTime + COLLISION_LOCK_MILLISECONDS;
    this.lastPlayedAt.set(cue, currentTime);
    this.backend.play(cue, policy.priority);
  }

  setSettings(settings: AudioSettings): void {
    this.settings = {
      enabled: Boolean(settings.enabled),
      volume: clampVolume(settings.volume)
    };
    if (!this.destroyed) {
      this.backend.setVolume(this.settings.enabled ? this.settings.volume : 0);
    }
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  suspend(): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    this.lifecycle += 1;
    this.unlocked = false;
    if (!this.suspendPromise) {
      const pendingUnlock = this.unlockPromise;
      const suspendPromise = Promise.resolve(pendingUnlock)
        .then(() => this.destroyed ? undefined : this.backend.suspend())
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
    this.unlocked = false;
    this.lastPlayedAt.clear();
    this.collisionLockUntil = 0;
    this.destroyPromise = this.backend.destroy().catch(() => undefined);
    return this.destroyPromise;
  }
}

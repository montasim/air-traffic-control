import { describe, expect, it, vi } from 'vitest';
import { GameAudio } from '../../src/audio/AudioManager';
import type { AudioBackend, AudioCue } from '../../src/audio/types';

function fakeBackend(unlock: () => Promise<void> = async () => undefined) {
  const played: Array<{ cue: AudioCue; priority: number }> = [];
  const volumes: number[] = [];
  const backend: AudioBackend = {
    unlock: vi.fn(unlock),
    setVolume: vi.fn((volume) => volumes.push(volume)),
    play: vi.fn((cue, priority) => played.push({ cue, priority })),
    suspend: vi.fn(async () => undefined),
    destroy: vi.fn(async () => undefined)
  };
  return { backend, played, volumes };
}

describe('GameAudio', () => {
  it('stays silent before the user unlocks audio', () => {
    const { backend, played } = fakeBackend();
    const audio = new GameAudio(backend);
    audio.handle({ type: 'route-connected', aircraftId: 1, zoneId: 'runway' });
    expect(played).toEqual([]);
  });

  it('maps semantic feedback to prioritized cues after one unlock', async () => {
    const { backend, played } = fakeBackend();
    const audio = new GameAudio(backend);
    await Promise.all([audio.unlock(), audio.unlock()]);
    audio.handle({ type: 'route-connected', aircraftId: 1, zoneId: 'runway' });
    audio.handle({ type: 'landing-completed', aircraftId: 1, score: 4 });
    expect(backend.unlock).toHaveBeenCalledTimes(1);
    expect(played).toEqual([
      { cue: 'route-connected', priority: 40 },
      { cue: 'landing-completed', priority: 60 }
    ]);
  });

  it('does not become playable when the backend reports audio unavailable', async () => {
    const { backend, played } = fakeBackend(async () => {
      throw new Error('AudioContext unavailable');
    });
    const audio = new GameAudio(backend);

    await audio.unlock();
    audio.handle({ type: 'ui-confirm', action: 'play' });
    await audio.unlock();

    expect(backend.unlock).toHaveBeenCalledTimes(2);
    expect(played).toEqual([]);
  });

  it('applies cooldowns and lets collision suppress lower-priority cues', async () => {
    const { backend, played } = fakeBackend();
    let now = 1_000;
    const audio = new GameAudio(backend, undefined, () => now);
    await audio.unlock();
    audio.handle({ type: 'route-connected', aircraftId: 1, zoneId: 'runway' });
    now += 40;
    audio.handle({ type: 'route-connected', aircraftId: 2, zoneId: 'runway' });
    now += 200;
    audio.handle({ type: 'collision', aircraftIds: [1, 2] });
    now += 400;
    audio.handle({ type: 'landing-completed', aircraftId: 3, score: 1 });
    now += 600;
    audio.handle({ type: 'promotion', previousRankId: 'trainee', rankId: 'assistant' });
    expect(played.map(({ cue }) => cue)).toEqual([
      'route-connected',
      'collision',
      'promotion'
    ]);
  });

  it('clamps settings and mutes without losing the requested volume', async () => {
    const { backend, played, volumes } = fakeBackend();
    const audio = new GameAudio(backend, { enabled: true, volume: 4 });
    await audio.unlock();
    audio.setSettings({ enabled: false, volume: 0.72 });
    audio.handle({ type: 'ui-confirm', action: 'play' });
    expect(audio.getSettings()).toEqual({ enabled: false, volume: 0.72 });
    expect(volumes.at(-1)).toBe(0);
    expect(played).toEqual([]);
  });

  it('serializes a pending unlock before suspension and requires another unlock', async () => {
    let finishUnlock: (() => void) | undefined;
    const { backend, played } = fakeBackend(() => new Promise<void>((resolve) => {
      finishUnlock = resolve;
    }));
    const audio = new GameAudio(backend);

    const unlocking = audio.unlock();
    const suspending = audio.suspend();
    finishUnlock?.();
    await Promise.all([unlocking, suspending]);
    audio.handle({ type: 'ui-confirm', action: 'resume' });

    expect(backend.suspend).toHaveBeenCalledTimes(1);
    expect(played).toEqual([]);

    vi.mocked(backend.unlock).mockResolvedValue(undefined);
    await audio.unlock();
    audio.handle({ type: 'ui-confirm', action: 'resume' });
    expect(backend.unlock).toHaveBeenCalledTimes(2);
    expect(played.map(({ cue }) => cue)).toEqual(['ui-confirm']);
  });

  it('coalesces destruction and ignores a late unlock completion', async () => {
    let finishUnlock: (() => void) | undefined;
    const { backend, played } = fakeBackend(() => new Promise<void>((resolve) => {
      finishUnlock = resolve;
    }));
    const audio = new GameAudio(backend);

    const unlocking = audio.unlock();
    await Promise.all([audio.destroy(), audio.destroy()]);
    finishUnlock?.();
    await unlocking;
    await audio.unlock();
    audio.setSettings({ enabled: true, volume: 1 });
    audio.handle({ type: 'collision' });

    expect(backend.destroy).toHaveBeenCalledTimes(1);
    expect(backend.unlock).toHaveBeenCalledTimes(1);
    expect(played).toEqual([]);
  });
});

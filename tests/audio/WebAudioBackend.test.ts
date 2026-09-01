import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AudioUnavailableError,
  WebAudioBackend
} from '../../src/audio/WebAudioBackend';

interface ParameterCall {
  readonly method: string;
  readonly value?: number;
  readonly time: number;
}

class FakeAudioParam {
  value = 1;
  readonly calls: ParameterCall[] = [];

  cancelScheduledValues(time: number): this {
    this.calls.push({ method: 'cancel', time });
    return this;
  }

  cancelAndHoldAtTime(time: number): this {
    this.calls.push({ method: 'hold', time });
    return this;
  }

  setValueAtTime(value: number, time: number): this {
    this.value = value;
    this.calls.push({ method: 'set', value, time });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): this {
    this.value = value;
    this.calls.push({ method: 'linear', value, time });
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    this.value = value;
    this.calls.push({ method: 'exponential', value, time });
    return this;
  }
}

class FakeGainNode {
  readonly gain = new FakeAudioParam();
  disconnected = false;

  connect<T>(destination: T): T {
    return destination;
  }

  disconnect(): void {
    this.disconnected = true;
  }
}

class FakeOscillatorNode {
  type: OscillatorType = 'sine';
  readonly frequency = new FakeAudioParam();
  readonly stopTimes: number[] = [];
  readonly startTimes: number[] = [];
  disconnected = false;
  private ended?: EventListenerOrEventListenerObject;

  connect<T>(destination: T): T {
    return destination;
  }

  disconnect(): void {
    this.disconnected = true;
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void {
    if (type === 'ended') this.ended = listener;
  }

  start(time: number): void {
    this.startTimes.push(time);
  }

  stop(time: number): void {
    this.stopTimes.push(time);
  }

  finish(): void {
    if (typeof this.ended === 'function') this.ended(new Event('ended'));
    else this.ended?.handleEvent(new Event('ended'));
  }
}

class FakeAudioContext {
  static readonly instances: FakeAudioContext[] = [];
  static resumeGate: Promise<void> = Promise.resolve();

  readonly destination = {};
  readonly gains: FakeGainNode[] = [];
  readonly oscillators: FakeOscillatorNode[] = [];
  state: AudioContextState = 'suspended';
  currentTime = 4;
  resumeCalls = 0;
  suspendCalls = 0;
  closeCalls = 0;

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createGain(): FakeGainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain;
  }

  createOscillator(): FakeOscillatorNode {
    const oscillator = new FakeOscillatorNode();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  async resume(): Promise<void> {
    this.resumeCalls += 1;
    await FakeAudioContext.resumeGate;
    if (this.state !== 'closed') this.state = 'running';
  }

  async suspend(): Promise<void> {
    this.suspendCalls += 1;
    if (this.state === 'running') this.state = 'suspended';
  }

  async close(): Promise<void> {
    this.closeCalls += 1;
    this.state = 'closed';
  }
}

function installFakeAudioContext(): void {
  vi.stubGlobal('window', {
    AudioContext: FakeAudioContext as unknown as new () => AudioContext
  });
}

beforeEach(() => {
  FakeAudioContext.instances.length = 0;
  FakeAudioContext.resumeGate = Promise.resolve();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WebAudioBackend', () => {
  it('rejects unlock explicitly when the browser has no AudioContext', async () => {
    vi.stubGlobal('window', {});
    await expect(new WebAudioBackend().unlock()).rejects.toBeInstanceOf(AudioUnavailableError);
  });

  it('coalesces concurrent unlocks into one context resume', async () => {
    installFakeAudioContext();
    let finishResume: (() => void) | undefined;
    FakeAudioContext.resumeGate = new Promise<void>((resolve) => {
      finishResume = resolve;
    });
    const backend = new WebAudioBackend();

    const first = backend.unlock();
    const second = backend.unlock();
    const context = FakeAudioContext.instances[0];

    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(context.resumeCalls).toBe(1);
    finishResume?.();
    await Promise.all([first, second]);
    expect(context.gains[0].gain.calls).toContainEqual({
      method: 'linear',
      value: 0.65,
      time: 4.025
    });
  });

  it('ramps clamped volume changes instead of switching gain abruptly', async () => {
    installFakeAudioContext();
    const backend = new WebAudioBackend();
    await backend.unlock();
    const masterGain = FakeAudioContext.instances[0].gains[0].gain;
    masterGain.calls.length = 0;

    backend.setVolume(3);
    backend.setVolume(Number.NaN);

    expect(masterGain.calls.filter(({ method }) => method === 'linear'))
      .toEqual([
        { method: 'linear', value: 1, time: 4.025 },
        { method: 'linear', value: 0, time: 4.025 }
      ]);
  });

  it('bounds polyphony, removes ended voices, and preserves higher-priority voices', async () => {
    installFakeAudioContext();
    const backend = new WebAudioBackend();
    await backend.unlock();
    const context = FakeAudioContext.instances[0];

    backend.play('promotion', 80);
    backend.play('ui-confirm', 10);
    expect(context.oscillators).toHaveLength(4);

    backend.play('route-connected', 40);
    expect(context.oscillators).toHaveLength(5);
    expect(context.oscillators[3].stopTimes).toContain(context.currentTime);

    backend.play('ui-confirm', 10);
    expect(context.oscillators).toHaveLength(5);

    context.oscillators.slice(0, 5).forEach((oscillator) => oscillator.finish());
    backend.play('ui-confirm', 10);
    expect(context.oscillators).toHaveLength(6);
  });

  it('lets collision preempt every lower-priority active voice', async () => {
    installFakeAudioContext();
    const backend = new WebAudioBackend();
    await backend.unlock();
    const context = FakeAudioContext.instances[0];

    backend.play('promotion', 80);
    backend.play('route-connected', 40);
    const priorVoices = [...context.oscillators];
    backend.play('collision', 100);

    expect(priorVoices).toHaveLength(4);
    priorVoices.forEach((oscillator) => {
      expect(oscillator.stopTimes).toContain(context.currentTime);
      expect(oscillator.disconnected).toBe(true);
    });
    expect(context.oscillators).toHaveLength(6);
  });

  it('coalesces suspend and destroy, then remains safely unavailable', async () => {
    installFakeAudioContext();
    const backend = new WebAudioBackend();
    await backend.unlock();
    const context = FakeAudioContext.instances[0];
    backend.play('route-connected', 40);

    await Promise.all([backend.suspend(), backend.suspend()]);
    expect(context.suspendCalls).toBe(1);
    backend.play('route-connected', 40);
    expect(context.oscillators).toHaveLength(1);

    await Promise.all([backend.destroy(), backend.destroy()]);
    expect(context.closeCalls).toBe(1);
    expect(context.oscillators[0].disconnected).toBe(true);
    await expect(backend.unlock()).rejects.toBeInstanceOf(AudioUnavailableError);
  });

  it('does not revive a context destroyed during a pending unlock', async () => {
    installFakeAudioContext();
    let finishResume: (() => void) | undefined;
    FakeAudioContext.resumeGate = new Promise<void>((resolve) => {
      finishResume = resolve;
    });
    const backend = new WebAudioBackend();

    const unlocking = backend.unlock();
    const context = FakeAudioContext.instances[0];
    await backend.destroy();
    finishResume?.();

    await expect(unlocking).rejects.toBeInstanceOf(AudioUnavailableError);
    expect(context.state).toBe('closed');
  });
});

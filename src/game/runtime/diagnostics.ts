export const GAME_MEMORY_LIMIT = 30_000_000;
export const GAME_MEMORY_WORKING_BUDGET = 24_000_000;
export const SYSTEM_NAMES = ['simulation', 'aircraft', 'ground', 'guidance', 'routes', 'render'] as const;
export type TrackedSystem = typeof SYSTEM_NAMES[number];

/** Exact resource accounting when sizes are known; keys identify ownership, never individual frames. */
export class MemoryLedger {
  private readonly resources = new Map<string, { cpu: number; gpu: number }>();
  private cpu = 0;
  private gpu = 0;
  peak = 0;
  set(key: string, cpu: number, gpu: number): void {
    if (![cpu, gpu].every(value => Number.isSafeInteger(value) && value >= 0)) throw new RangeError('Invalid resource byte count');
    const previous = this.resources.get(key);
    this.cpu += cpu - (previous?.cpu ?? 0);
    this.gpu += gpu - (previous?.gpu ?? 0);
    this.resources.set(key, { cpu, gpu });
    this.peak = Math.max(this.peak, this.cpu + this.gpu);
  }
  delete(key: string): void {
    const previous = this.resources.get(key);
    if (!previous) return;
    this.cpu -= previous.cpu;
    this.gpu -= previous.gpu;
    this.resources.delete(key);
  }
  snapshot() { return { cpu: this.cpu, gpu: this.gpu, total: this.cpu + this.gpu, peak: this.peak }; }
  canAllocate(bytes: number): boolean {
    return Number.isSafeInteger(bytes) && bytes >= 0 && this.cpu + this.gpu + bytes < GAME_MEMORY_WORKING_BUDGET;
  }
}

export function rgbaTextureBytes(width: number, height: number, mipmaps = false): number {
  if (![width, height].every(value => Number.isSafeInteger(value) && value > 0)) throw new RangeError('Invalid texture size');
  let bytes = width * height * 4;
  while (mipmaps && (width > 1 || height > 1)) {
    width = Math.max(1, Math.floor(width / 2));
    height = Math.max(1, Math.floor(height / 2));
    bytes += width * height * 4;
  }
  return bytes;
}

/** Fixed storage; timestamps are supplied by callers so tests do not depend on a real clock. */
export class FrameMetrics {
  private readonly durations = new Float64Array(SYSTEM_NAMES.length);
  private readonly calls = new Uint32Array(SYSTEM_NAMES.length);
  private frames = 0;
  private slowFrames = 0;
  private firstFrame?: number;
  private previousFrame?: number;
  private lastSample?: number;
  private renderCalls?: number;
  record(system: TrackedSystem, milliseconds: number): void {
    const index = SYSTEM_NAMES.indexOf(system);
    this.durations[index] += Math.max(0, milliseconds);
    this.calls[index]++;
  }
  frame(now: number, drawCalls?: number): void {
    if (this.firstFrame === undefined) this.firstFrame = now;
    if (this.previousFrame !== undefined) {
      this.frames++;
      if (now - this.previousFrame > 34) this.slowFrames++;
    }
    this.previousFrame = now;
    this.renderCalls = drawCalls;
  }
  reset(): void {
    this.durations.fill(0);
    this.calls.fill(0);
    this.frames = this.slowFrames = 0;
    this.firstFrame = this.previousFrame = this.lastSample = undefined;
    this.renderCalls = undefined;
  }
  sample(now: number) {
    const elapsed = Math.max(0, now - (this.lastSample ?? this.firstFrame ?? now));
    const seconds = elapsed / 1000;
    const systems = SYSTEM_NAMES.map((name, index) => ({ name,
      callsPerSecond: seconds > 0 ? this.calls[index] / seconds : 0,
      millisecondsPerCall: this.calls[index] ? this.durations[index] / this.calls[index] : 0,
    }));
    const cpuPerFrame = this.frames ? this.durations.reduce((sum, duration) => sum + duration, 0) / this.frames : 0;
    const result = { fps: seconds > 0 ? this.frames / seconds : 0,
      frameMs: this.frames ? elapsed / this.frames : 0, cpuPerFrame,
      slowFrames: this.slowFrames, drawCalls: this.renderCalls, systems };
    this.durations.fill(0);
    this.calls.fill(0);
    this.frames = this.slowFrames = 0;
    this.lastSample = now;
    return result;
  }
}

export interface MemoryEstimate {
  /** Sampled realm heap includes app/engine and typed arrays. Do not add those allocations again. */
  heap?: number;
  externalCpu: number;
  gpu: number;
  complete: boolean;
}

export function sampledHeapBytes(): number | undefined {
  const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
  return heap !== undefined && Number.isFinite(heap) && heap >= 0 ? heap : undefined;
}

import { performanceStatsEnabled, PERFORMANCE_SETTINGS_EVENT } from './performanceSettings';
import { type FrameMetrics, type MemoryEstimate } from '../game/runtime/diagnostics';
import type { GamePhase } from '../core/types';

export interface DiagnosticsSource {
  metrics: FrameMetrics;
  phase(): GamePhase;
  sessionId(): string;
  memory(): MemoryEstimate;
  canvas(): HTMLCanvasElement;
}

/** Read-only, low-frequency DOM diagnostics. No retained traces or frame-by-frame DOM writes. */
export function mountGameDiagnostics(source: DiagnosticsSource): () => void {
  const panel = document.createElement('aside');
  panel.className = 'game-diagnostics';
  panel.setAttribute('aria-label', 'Gameplay performance diagnostics');
  const lines = Array.from({ length: 7 }, () => {
    const line = document.createElement('div');
    panel.append(line);
    return line;
  });
  panel.hidden = true;
  document.body.append(panel);
  let peak = 0;
  let previousPhase: GamePhase = 'idle';
  let previousSession = '';
  let visible = false;
  const mb = (bytes: number) => (bytes / 1_000_000).toFixed(1);
  const clearWindow = () => source.metrics.reset();
  document.addEventListener('visibilitychange', clearWindow);
  const update = () => {
    const phase = source.phase();
    const active = phase === 'running' && document.body.dataset.screen === 'play' && !document.hidden;
    const paused = phase === 'paused' && !!document.querySelector<HTMLElement>('#pause-panel:not([hidden])');
    const show = performanceStatsEnabled() && (active || paused);
    panel.hidden = !show;
    if (phase !== previousPhase || visible !== active) source.metrics.reset();
    const session = source.sessionId();
    if (session !== previousSession) {peak = 0;source.metrics.reset();previousSession=session;}
    previousPhase = phase;
    visible = active;
    if (!show) return;
    const memory = source.memory();
    const known = memory.externalCpu + memory.gpu;
    const total = memory.heap === undefined ? undefined : memory.heap + known;
    if (total !== undefined) peak = Math.max(peak, total);
    const sample = source.metrics.sample(performance.now());
    lines[0].textContent = paused ? 'Performance ? paused' : 'Performance';
    lines[1].textContent = paused ? 'FPS ? ? paused' : `${sample.fps.toFixed(0)} FPS ? ${sample.frameMs.toFixed(1)} ms/frame`;
    lines[2].textContent = `Game CPU work ${sample.cpuPerFrame.toFixed(1)} ms/frame`;
    lines[3].textContent = `Memory ${total === undefined ? 'unavailable' : '~'+mb(total)+' MB'}`;
    lines[4].textContent = `GPU ~${mb(memory.gpu)} MB ? ${sample.drawCalls ?? '?'} draws/frame`;
    lines[5].textContent = `Peak ${total === undefined ? 'unavailable' : '~'+mb(peak)+' MB'}`;
    lines[6].textContent = 'Process CPU unavailable';
  };
  document.addEventListener(PERFORMANCE_SETTINGS_EVENT, update);
  update();
  const timer = window.setInterval(update, 500);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', clearWindow);
    document.removeEventListener(PERFORMANCE_SETTINGS_EVENT, update);
    panel.remove();
  };
}

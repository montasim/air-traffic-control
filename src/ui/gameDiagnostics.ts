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
  panel.title = 'Memory and GPU values are estimates in MB; GPU shows allocated memory, not utilization.';
  panel.hidden = true;
  document.body.append(panel);
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
    if (session !== previousSession) {source.metrics.reset();previousSession=session;}
    previousPhase = phase;
    visible = active;
    if (!show) return;
    const memory = source.memory();
    const known = memory.externalCpu + memory.gpu;
    const total = memory.heap === undefined ? undefined : memory.heap + known;
    const sample = source.metrics.sample(performance.now());
    panel.textContent = `${paused ? 'paused' : sample.fps.toFixed(0) + ' FPS'} \u00b7 MEM ${total === undefined ? 'N/A' : '~' + mb(total) + ' MB'} \u00b7 GPU ~${mb(memory.gpu)} MB`;

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

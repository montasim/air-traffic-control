const STORAGE_KEY = 'vector-approach:performance-stats';
export const PERFORMANCE_SETTINGS_EVENT = 'performance-settings-changed';
let enabled = false;
try { enabled = localStorage.getItem(STORAGE_KEY) === 'on'; } catch { /* Keep the in-memory preference. */ }

export function performanceStatsEnabled(): boolean { return enabled; }

export function mountPerformanceSettings(): void {
  const button = document.querySelector<HTMLButtonElement>('#performance-toggle')!;
  const show = () => {
    button.setAttribute('aria-pressed', String(enabled));
    button.querySelector('[data-performance-label]')!.textContent = enabled ? 'Stats on' : 'Stats off';
  };
  button.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off'); } catch { /* Still works for this visit. */ }
    show();
    document.dispatchEvent(new Event(PERFORMANCE_SETTINGS_EVENT));
  });
  show();
}

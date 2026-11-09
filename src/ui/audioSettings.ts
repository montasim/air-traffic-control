import type { GameAudio } from "../audio";
import type { AudioSettings } from "../audio/types";

/** One volume control: zero mutes, and raising it enables sound again. */
export function mountAudioSettings(audio: GameAudio, persist: (patch: Partial<AudioSettings>) => Promise<AudioSettings>) {
  const sliders = [...document.querySelectorAll<HTMLInputElement>("[data-audio-volume]")];
  const readouts = [...document.querySelectorAll<HTMLOutputElement>("[data-audio-value]")];
  let saveTimer = 0;
  let revision = 0;

  function show(settings: AudioSettings): void {
    audio.setSettings(settings);
    // Existing saves with sound switched off should visibly remain muted.
    const percent = settings.enabled ? Math.round(settings.volume * 100) : 0;
    for (const output of readouts) output.value = `${percent}%`;
    for (const slider of sliders) {
      slider.value = String(percent);
      slider.style.setProperty("--volume-level", `${percent}%`);
      slider.setAttribute("aria-valuetext", percent === 0 ? "Muted" : `${percent} percent`);
    }
  }

  for (const slider of sliders) slider.addEventListener("input", () => {
    void audio.unlock();
    const volume = Math.min(1, Math.max(0, Number(slider.value) / 100));
    const settings = { enabled: volume > 0, volume };
    const change = ++revision;
    show(settings);
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(async () => {
      const saved = await persist(settings);
      if (change === revision) show(saved);
    }, 140);
  });

  return { show };
}

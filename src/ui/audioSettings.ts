import type { GameAudio } from "../audio";
import type { AudioSettings } from "../audio/types";
import { mountHugeIcon } from "./hugeicons";

/**
 * The sound controls in Settings: the on/off toggle, the volume slider and their readouts. Dragging the
 * slider changes the sound at once and saves shortly after it settles; `persist` stores a change and
 * returns the settings as saved.
 */
export function mountAudioSettings(audio: GameAudio, persist: (patch: Partial<AudioSettings>) => Promise<AudioSettings>) {
  const toggles = [...document.querySelectorAll<HTMLButtonElement>("[data-audio-toggle]")];
  const icons = [...document.querySelectorAll<HTMLElement>("[data-audio-icon]")];
  const sliders = [...document.querySelectorAll<HTMLInputElement>("[data-audio-volume]")];
  const readouts = [...document.querySelectorAll<HTMLOutputElement>("[data-audio-value]")];
  let current: AudioSettings = audio.getSettings();
  let saveTimer = 0;

  function show(settings: AudioSettings): void {
    current = settings;
    audio.setSettings(settings);
    const percent = Math.round(settings.volume * 100);
    for (const button of toggles) {
      button.setAttribute("aria-pressed", String(settings.enabled));
      button.setAttribute("aria-label", "Sound effects");
      button.querySelector<HTMLElement>("[data-audio-label]")!.textContent = settings.enabled ? "Sound on" : "Sound off";
    }
    for (const icon of icons) mountHugeIcon(icon, settings.enabled ? "volume" : "mute", 19);
    for (const output of readouts) output.value = `${percent}%`;
    for (const slider of sliders) {
      slider.value = String(percent);
      slider.style.setProperty("--volume-level", `${percent}%`);
      slider.setAttribute("aria-valuetext", `${percent} percent`);
    }
  }

  for (const button of toggles) button.addEventListener("click", async () => {
    await audio.unlock();
    const enabled = !current.enabled;
    show(await persist({ enabled }));
    if (enabled) audio.handle({ type: "ui-confirm", action: "resume" });
  });
  for (const slider of sliders) slider.addEventListener("input", () => {
    const volume = Math.min(1, Math.max(0, Number(slider.value) / 100));
    show({ ...current, volume });
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(async () => show(await persist({ volume })), 140);
  });

  return { show };
}

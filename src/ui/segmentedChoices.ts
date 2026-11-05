import { DIFFICULTIES, DIFFICULTY_LABELS } from "../core/difficulty";
import { el } from "./dom";
import { mountHugeIcon, type AppIconName } from "./hugeicons";

export interface Choice {
  readonly value: string;
  readonly label: string;
  readonly icon?: AppIconName;
}

/** Easy, Medium and Hard, from the game's own list, so every difficulty switch reads the same. */
export const DIFFICULTY_CHOICES: readonly Choice[] = DIFFICULTIES.map((value) => ({ value, label: DIFFICULTY_LABELS[value] }));

/**
 * Fills a row (or fieldset, after its legend) with one radio chip per choice: a real radio input (keyboard,
 * screen readers, form state) visually replaced by its label. Every segmented switch in the menus is
 * built here, so they share markup and behaviour.
 */
export function mountSegmentedChoices(container: HTMLElement, name: string, choices: readonly Choice[], checked?: string): void {
  container.querySelectorAll(":scope > label").forEach((label) => label.remove());
  container.append(...choices.map((choice) => {
    const input = el("input");
    input.type = "radio";
    input.name = name;
    input.value = choice.value;
    input.checked = choice.value === checked;
    const face = el("span");
    if (choice.icon) {
      const glyph = el("span", "button-icon");
      glyph.setAttribute("aria-hidden", "true");
      mountHugeIcon(glyph, choice.icon, 18);
      face.append(glyph);
    }
    face.append(choice.label);
    const label = el("label");
    label.append(input, face);
    return label;
  }));
}

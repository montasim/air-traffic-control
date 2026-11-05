import { DIFFICULTY_LABELS, type DifficultyId } from "../core/difficulty";
import { el } from "./dom";
import { mountHugeIcon, type AppIconName } from "./hugeicons";

export interface ShiftSummary {
  /** The airfield, as a leading tag, where nothing else on the card names it. */
  readonly name?: string;
  readonly difficulty: DifficultyId;
  /** The landing count, already formatted; left out where the card shows the score itself. */
  readonly landed?: string;
  readonly orientation?: string;
  readonly twoEndLanding: boolean;
}

/** The pill tags that sum up a shift, shared by the pause menu, the result card and the saved-shift offer. */
export function shiftTags(shift: ShiftSummary): HTMLUListElement {
  const tags = el("ul", "shift-tags");
  if (shift.name) tags.append(el("li", "shift-tag-name", shift.name));
  const facts: [string, AppIconName?][] = [
    [DIFFICULTY_LABELS[shift.difficulty]],
    ...(shift.landed === undefined ? [] : [[`${shift.landed} landed`, "landing"] as [string, AppIconName]]),
    ...(shift.orientation === undefined ? [] : [[shift.orientation.charAt(0).toUpperCase() + shift.orientation.slice(1)] as [string]]),
    [shift.twoEndLanding ? "Both ends" : "One end"],
  ];
  for (const [text, icon] of facts) {
    const tag = el("li");
    if (icon) {
      const glyph = el("span");
      glyph.setAttribute("aria-hidden", "true");
      mountHugeIcon(glyph, icon, 14);
      tag.append(glyph);
    }
    tag.append(text);
    tags.append(tag);
  }
  return tags;
}

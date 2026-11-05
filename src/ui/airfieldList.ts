import { DIFFICULTY_LABELS } from "../core/difficulty";
import { AIRPORT_CATEGORIES } from "../game/maps/categories";
import type { MapId } from "../game/maps/mapIds";
import { MAP_DEFINITIONS } from "../game/maps/registry";
import { isMapUnlocked, rankDefinition } from "../progression/ranks";
import type { GameSaveV3 } from "../storage/gameSave";
import { el, formatScore } from "./dom";

/** The player's best on an airfield at the selected difficulty, in either orientation. */
export function bestOnAirfield(save: GameSaveV3, mapId: MapId): number {
  const scores = save.mapRecords[mapId].difficultyScores[save.selectedDifficulty];
  return Math.max(scores.portrait, scores.landscape);
}

export interface AirfieldListState {
  readonly save: GameSaveV3;
  readonly selectedId: MapId;
  readonly pictures: ReadonlyMap<MapId, string>;
}

/**
 * The Choose airfield screen: category filters, one card per airfield (picture, best score, or the rank
 * that unlocks it), and arrow-key movement between cards. A locked card explains itself; an open one
 * calls `choose`.
 */
export function mountAirfieldList(read: () => AirfieldListState, choose: (mapId: MapId) => void) {
  const cards = document.querySelector<HTMLElement>("#map-options")!;
  const filters = document.querySelector<HTMLElement>("#category-filters")!;
  const status = document.querySelector<HTMLElement>("#airfield-selection-status")!;
  let category = "all";

  function render(): void {
    const { save, selectedId, pictures } = read();
    cards.replaceChildren(...MAP_DEFINITIONS.filter((map) => category === "all" || map.metadata.category === category).map((definition) => {
      const unlocked = isMapUnlocked(definition.id, save.career.earnedRankId);
      const selected = definition.id === selectedId;
      const unlockRank = rankDefinition(definition.metadata.unlockRankId).name;
      const button = el("button", "map-option");
      button.type = "button";
      button.dataset.mapId = definition.id;
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-disabled", String(!unlocked));
      button.setAttribute("aria-label", `${definition.metadata.name}${unlocked ? "" : `, locked. Requires ${unlockRank}`}`);
      const picture = pictures.get(definition.id);
      if (picture) button.style.setProperty("--map-preview", `url("${picture}")`);
      button.style.setProperty("--map-preview-position", `var(--map-focus-${definition.id}, center)`);
      if (selected) button.classList.add("is-selected");
      if (!unlocked) button.classList.add("is-locked");
      button.append(
        el("strong", "", definition.metadata.name),
        el("span", "", unlocked
          ? `${AIRPORT_CATEGORIES[definition.metadata.category]} · ${DIFFICULTY_LABELS[save.selectedDifficulty]} best ${formatScore(bestOnAirfield(save, definition.id))}`
          : `Unlock at ${unlockRank}`),
        el("small", "", definition.metadata.description),
      );
      button.addEventListener("click", () => {
        if (unlocked) choose(definition.id);
        else status.textContent = `${definition.metadata.name} unlocks at ${unlockRank}. Complete career objectives to earn that clearance.`;
      });
      return button;
    }));
  }

  for (const [id, label] of Object.entries({ all: "All airfields", ...AIRPORT_CATEGORIES })) {
    const button = el("button", "", label);
    button.type = "button";
    button.setAttribute("aria-pressed", String(id === category));
    button.addEventListener("click", () => {
      category = id;
      filters.querySelectorAll("button").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
      render();
    });
    filters.append(button);
  }

  cards.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const choices = [...cards.querySelectorAll<HTMLButtonElement>("button")];
    const current = choices.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0
      : event.key === "End" ? choices.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + choices.length) % choices.length;
    choices[next]?.focus();
  });

  return {
    render,
    /** Opens the screen's state for the selected difficulty: its switch, status line and cards. */
    show(): void {
      const { save } = read();
      document.querySelectorAll<HTMLInputElement>('input[name="airfield-difficulty"]').forEach((input) => { input.checked = input.value === save.selectedDifficulty; });
      render();
      status.textContent = `${DIFFICULTY_LABELS[save.selectedDifficulty]} difficulty · Choose an available airfield to return to Play.`;
    },
  };
}

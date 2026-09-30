import { createDefaultGameSave, type GameSaveV3 } from "../storage/gameSave";
import { isMapId } from "../game/maps/mapIds";

/** DEV-only fixtures use memory persistence and never read or write a player's career. */
export function reviewSave(params: URLSearchParams): GameSaveV3 {
  const save = createDefaultGameSave();
  const map = params.get("map");
  const promotion = params.get("review") === "promotion";
  const trainee = params.get("review") === "trainee" || promotion;
  return {
    ...save,
    selectedMapId: isMapId(map) ? map : save.selectedMapId,
    career: trainee
      ? {
          ...save.career,
          totalSafeLandings: promotion ? 7 : 0,
          shiftsPlayed: promotion ? 1 : 0,
        }
      : {
          totalSafeLandings: 240,
          shiftsPlayed: 40,
          earnedRankId: "chief-controller",
          acknowledgedRankId: "chief-controller",
        },
    settings: { ...save.settings, audio: { enabled: false, volume: 0.8 } },
  };
}

export function mountReviewControls(
  showResult: (reason: "collision" | "airspace", score: number) => void,
): void {
  const bar = document.createElement("aside");
  bar.setAttribute("aria-label", "Development review fixtures");
  bar.style.cssText =
    "position:fixed;bottom:0;left:0;z-index:100;background:#fff5df;padding:4px;font:12px sans-serif;display:flex;gap:6px";
  for (const reason of ["collision", "airspace"] as const) {
    const button = document.createElement("button");
    button.textContent = `Review ${reason} result`;
    button.addEventListener("click", () => showResult(reason, 3));
    bar.append(button);
  }
  document.body.append(bar);
}

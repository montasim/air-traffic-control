import { LIVERIES } from './progression/liveries';
import { DIFFICULTY_LABELS, isDifficulty, type DifficultyId } from './core/difficulty';
import { ACHIEVEMENTS, type ShiftEvidence } from './progression/achievements';
import { renderCareer as renderCareerPage } from "./ui/career";
import { clearActiveShift, loadActiveShift, saveActiveShift, type ActiveShift } from "./storage/activeShift";
import Phaser from "phaser";
import type { FeedbackEvent } from "./app/feedbackEvents";
import { GameAudio, WebAudioBackend } from "./audio";
import type { GameOverReason, SimulationSnapshot } from "./core/types";
import { DEFAULT_MAP_ID, type MapId } from "./game/maps/mapIds";
import { mapDefinitionById } from "./game/maps/registry";
import { PlayScene } from "./game/scenes/PlayScene";
import { GAME_FONT_LOAD_DESCRIPTORS } from "./game/typography";
import {
  needsNewShiftLayout,
  renderScaleFor,
  worldSizeForViewport,
  LANDSCAPE_PROFILE,
  PORTRAIT_PROFILE,
  isFieldPlayable,
  shouldPauseForResize,
  profileForViewport,
  type ViewportProfile,
} from "./game/viewport";
import {
  RANK_CATALOG,
  isMapUnlocked,
  rankDefinition,
  rankIndex,
  promotionProgress,
} from "./progression/ranks";
import {
  createGameStore,
  MemorySavePersistence,
  IndexedDbSavePersistence,
  type GameSaveV3,
} from "./storage/gameStore";
import { mountHugeIcon } from "./ui/hugeicons";
import { el, formatScore } from "./ui/dom";
import { shiftTags } from "./ui/shiftTags";
import { createConfirmDialog, LEAVE_SHIFT, RESTART_SHIFT } from "./ui/confirmDialog";
import { createAnnouncer } from "./ui/announcer";
import { mountAudioSettings } from "./ui/audioSettings";
import { bestOnAirfield, mountAirfieldList } from "./ui/airfieldList";
import { DIFFICULTY_CHOICES, mountSegmentedChoices } from "./ui/segmentedChoices";
import { mountPractice } from "./ui/practice";
import { mountMenuPictures } from "./ui/menuPictures";
import { renderAchievementBadges, renderPromotion, resetCareerResult } from "./ui/shiftCelebration";

const reviewParams = new URLSearchParams(window.location.search);
const review =
  import.meta.env.DEV && reviewParams.has("review")
    ? await import("./dev/review")
    : undefined;
const gameStore = createGameStore(
  review
    ? new MemorySavePersistence(review.reviewSave(reviewParams))
    : new IndexedDbSavePersistence(),
);
const loadCareerSave = () => gameStore.load();
const saveCompletedShift = gameStore.recordShift.bind(gameStore);
const setSelectedMap = gameStore.selectMap.bind(gameStore);
const updateAudioSettings = gameStore.updateAudio.bind(gameStore);
const acknowledgeEarnedRank = () => gameStore.acknowledgeEarnedRank();

const ROUTE_COACH_SESSION_KEY = "vector-approach:route-coach-complete";

function routeCoachWasCompleted(): boolean {
  try {
    return window.sessionStorage.getItem(ROUTE_COACH_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberRouteCoachCompletion(): void {
  try {
    window.sessionStorage.setItem(ROUTE_COACH_SESSION_KEY, "1");
  } catch {
    // Memory-only state still prevents repetition during the current run.
  }
}

const elements = {
  gameCanvas: document.querySelector<HTMLElement>("#game")!,
  hud: document.querySelector<HTMLElement>(".hud")!,
  scoreTile: document.querySelector<HTMLElement>(".hud-score")!,
  score: document.querySelector<HTMLElement>("#score")!,
  best: document.querySelector<HTMLElement>("#best")!,
  routeCoachmark: document.querySelector<HTMLElement>("#route-coachmark")!,
  routeCoachmarkCopy: document.querySelector<HTMLElement>(
    "#route-coachmark-copy",
  )!,
  startPanel: document.querySelector<HTMLElement>("#start-panel")!,
  pausePanel: document.querySelector<HTMLElement>("#pause-panel")!,
  gameoverPanel: document.querySelector<HTMLElement>("#gameover-panel")!,
  mapOptions: document.querySelector<HTMLElement>("#map-options")!,
  currentRank: document.querySelector<HTMLElement>("#current-rank")!,
  rankProgress: document.querySelector<HTMLElement>("#rank-progress")!,
  selectedMapName: document.querySelector<HTMLElement>("#selected-map-name")!,
  careerResult: document.querySelector<HTMLElement>("#career-result")!,
  pauseButton: document.querySelector<HTMLButtonElement>("#pause-button")!,
  speedButton: document.querySelector<HTMLButtonElement>("#speed-button")!,
  resumeShiftButton: document.querySelector<HTMLButtonElement>("#resume-shift-button")!,
  resumeShiftContext: document.querySelector<HTMLElement>("#resume-shift-context")!,
  pauseIcon: document.querySelector<HTMLElement>("#pause-icon")!,
  startButton: document.querySelector<HTMLButtonElement>("#start-button")!,
  startIcon: document.querySelector<HTMLElement>("#start-icon")!,
  resumeButton: document.querySelector<HTMLButtonElement>("#resume-button")!,
  resumeIcon: document.querySelector<HTMLElement>("#resume-icon")!,
  resumeLabel: document.querySelector<HTMLElement>("#resume-label")!,
  restartButton: document.querySelector<HTMLButtonElement>("#restart-button")!,
  restartIcon: document.querySelector<HTMLElement>("#restart-icon")!,
  restartFromPause: document.querySelector<HTMLButtonElement>(
    "#restart-from-pause",
  )!,
  restartFromPauseIcon: document.querySelector<HTMLElement>(
    "#restart-from-pause-icon",
  )!,
  chooseMapButton:
    document.querySelector<HTMLButtonElement>("#choose-map-button")!,
  chooseMapIcon: document.querySelector<HTMLElement>("#choose-map-icon")!,
  finalScore: document.querySelector<HTMLElement>("#final-score")!,
  finalBest: document.querySelector<HTMLElement>("#final-best")!,
  gameoverCode: document.querySelector<HTMLElement>("#gameover-code")!,
  gameoverCopy: document.querySelector<HTMLElement>("#gameover-copy")!,
  routeStatus: document.querySelector<HTMLElement>("#route-status")!,
};
const { announce, flash: showFlightMessage } = createAnnouncer(elements.routeStatus, document.querySelector<HTMLElement>("#flight-message")!);
const confirmShift = createConfirmDialog(document.querySelector<HTMLDialogElement>("#confirm-dialog")!);
// Choosing an airfield mid-shift asks first, since it discards the paused shift.
const airfieldList = mountAirfieldList(() => ({ save: currentSave, selectedId: activeMapId, pictures: previews }), mapId => {
  const choose = async () => {
    const discardSameMap = mapId === activeMapId && playScene()?.getPhase() === 'paused';
    await selectMap(mapId);
    if (discardSameMap) rebuildForTarget(activeProfile, activeMapId, false);
    utilityReturnPanel = elements.startPanel;
    utilityReturnFocus = document.querySelector('#choose-airfield');
    history.back();
  };
  if (playScene()?.getPhase() === 'paused') confirmShift(LEAVE_SHIFT, () => void choose());
  else void choose();
});

mountHugeIcon(elements.pauseIcon, "pause", 22);
// Every segmented switch comes from one builder, before anything reads its inputs.
mountSegmentedChoices(document.querySelector<HTMLElement>("#difficulty-choices")!, "difficulty", DIFFICULTY_CHOICES, "medium");
mountSegmentedChoices(document.querySelector<HTMLElement>("#airfield-difficulty-choices")!, "airfield-difficulty", DIFFICULTY_CHOICES);
mountSegmentedChoices(document.querySelector<HTMLElement>(".practice-lessons")!, "practice-lesson", [{ value: "land", label: "Land", icon: "landing" }, { value: "hold", label: "Hold", icon: "target" }], "land");
mountHugeIcon(elements.startIcon, "play", 18);
mountHugeIcon(elements.resumeIcon, "play", 18);
mountHugeIcon(elements.restartFromPauseIcon, "restart", 18);
mountHugeIcon(elements.restartIcon, "restart", 18);
mountHugeIcon(elements.chooseMapIcon, "home", 18);
for (const name of ["home", "settings", "help", "career", "back", "expand", "play", "restart", "close", "landing", "target", "night", "weather", "bothEnds"] as const) {
  document.querySelectorAll<HTMLElement>(`[data-ui-icon="${name}"]`).forEach(target => {
    mountHugeIcon(target, name, 18);
  });
}
elements.startButton.disabled = true;

async function loadGameFonts(timeoutMilliseconds = 1_600): Promise<void> {
  if (!document.fonts) return;
  let timeoutId = 0;
  const timeout = new Promise<void>((resolve) => {
    timeoutId = window.setTimeout(resolve, timeoutMilliseconds);
  });
  try {
    await Promise.race([
      Promise.all(
        GAME_FONT_LOAD_DESCRIPTORS.map((descriptor) =>
          document.fonts.load(descriptor),
        ),
      ),
      timeout,
    ]);
  } catch {
    // The bundled fallbacks keep the game usable if local font loading fails.
  } finally {
    window.clearTimeout(timeoutId);
  }
}

await loadGameFonts();
let currentSave: GameSaveV3 = await loadCareerSave();
// Airfield pictures: drawn on demand, cached, and pushed into every place that shows them.
const menuPictures = mountMenuPictures({
  settings: () => currentSave.settings,
  selectedId: () => activeMapId,
  listing: () => !utilityScreen.hidden && (utilityScreen.dataset.page === "airfields" || utilityScreen.dataset.page === "career"),
});
const previews = menuPictures.pictures;
if (
  !isMapUnlocked(currentSave.selectedMapId, currentSave.career.earnedRankId)
) {
  currentSave = await setSelectedMap(DEFAULT_MAP_ID);
}

const audio = new GameAudio(new WebAudioBackend(), currentSave.settings.audio);
const audioSettings = mountAudioSettings(audio, async patch => (currentSave = await updateAudioSettings(patch)).settings.audio);
await audio.prepare();
// iPhone Safari starts audio only while it handles the end of a tap, so each tap and key press unlocks it
// right there (free once it is running), before any await in a handler lets that permission lapse.
for (const type of ["touchend", "pointerup", "click", "keydown"] as const) {
  document.addEventListener(type, () => void audio.unlock(), { capture: true, passive: true });
}

let activeProfile = profileForViewport();
let createdViewport = { width: window.innerWidth, height: window.innerHeight };
function layoutChanged(): boolean {
  return (
    needsNewShiftLayout(activeProfile, profileForViewport())
  );
}
let activeMapId: MapId = currentSave.selectedMapId;
let activeDifficulty: DifficultyId = currentSave.selectedDifficulty;
let activeLivery = currentSave.settings.livery;
let activeTwoEndLanding = currentSave.settings.twoEndLanding;
let savingLandingMode = false;
let restoreLandingModeFocus = false;
const landingModeInput = document.querySelector<HTMLInputElement>('#two-end-landing')!;
const nightModeInput = document.querySelector<HTMLInputElement>('#night-mode')!;
const weatherInput = document.querySelector<HTMLInputElement>('#weather-mode')!;
let activeRunId = '';
let finishingRunId = '';
let sceneReady = false;
let startAfterRebuild = false;
let resizeTimer = 0;
let resizeSettling = false;
let resizedWhilePaused = false;
function availableViewport() {
  return { width: elements.gameCanvas.clientWidth, height: elements.gameCanvas.clientHeight };
}
let acceptedViewport = availableViewport();
function resetResizeState(): void {
  window.clearTimeout(resizeTimer);
  resizeSettling = false;
  resizedWhilePaused = false;
  acceptedViewport = availableViewport();
}
/** Device pixels per world unit for the current game; the canvas is this much larger than the world. */
let renderScale = 1;
/** The world in layout units, as the scene and saved shifts use it. */
function worldSize(): { width: number; height: number } {
  return { width: game.scale.gameSize.width / renderScale, height: game.scale.gameSize.height / renderScale };
}
function fieldPlayable(): boolean {
  return isFieldPlayable(worldSize(), availableViewport());
}
let promotionAudioTimer = 0;
let focusBeforePanel: HTMLElement | null = null;
let routeCoachCompleted = routeCoachWasCompleted();
let routeCoachDismissed = false;
try { routeCoachDismissed = sessionStorage.getItem("vector-approach:route-coach-dismissed") === "1"; } catch { /* Session-only fallback. */ }
let routeCoachTimer = 0;
let scorePulseTimer = 0;
// Session-only: the next shift keeps the player's last choice.
const GAME_SPEEDS = [
  { scale: 1, label: "1×", name: "normal" },
  { scale: 2, label: "2×", name: "double" },
  { scale: 0.5, label: "½×", name: "half" },
] as const;
let speedIndex = 0;

elements.gameCanvas.inert = true;
elements.hud.inert = true;

function createGame(profile: ViewportProfile, mapId: MapId, restore?: ActiveShift): Phaser.Game {
  activeLivery = currentSave.settings.livery;
  // A restored shift keeps the world and runway mode it started with.
  activeTwoEndLanding = restore?.twoEndLanding ?? currentSave.settings.twoEndLanding;
  createdViewport = { width: window.innerWidth, height: window.innerHeight };
  const world = restore?.world ?? worldSizeForViewport(window.innerWidth, window.innerHeight);
  // Draw at the display's real pixel density instead of stretching a world-sized canvas.
  renderScale = renderScaleFor(world, { width: window.innerWidth, height: window.innerHeight }, window.devicePixelRatio);
  const nextGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: world.width * renderScale,
    height: world.height * renderScale,
    backgroundColor: "#263f3c",
    render: { antialias: true, roundPixels: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
    // All sound goes through GameAudio; Phaser's own sound system would open a second AudioContext
    // per game (iOS Safari caps them) and add its own tap-unlock handling beside ours.
    audio: { noAudio: true },
    scene: [new PlayScene(mapDefinitionById(mapId), activeTwoEndLanding, activeLivery, renderScale)],
  });

  nextGame.events.on("scene-ready", () => {
    sceneReady = true;
    playScene()?.setNight(currentSave.settings.night);
    playScene()?.setWeather(currentSave.settings.weather);
    if (!restore) offerLivePreview(nextGame);
    menuPictures.showSelected();
    const focusLandingMode = restoreLandingModeFocus;
    restoreLandingModeFocus = false;
    landingModeInput.disabled = savingLandingMode || !isMapUnlocked(activeMapId, currentSave.career.earnedRankId);
    document.dispatchEvent(new Event("game-ready"));
    elements.startButton.disabled = savingLandingMode || !isMapUnlocked(
      activeMapId,
      currentSave.career.earnedRankId,
    );
    if (restore) {
      requestAnimationFrame(() => finishRestore(restore));
      return;
    }
    if (!utilityScreen.hidden) {
      document.querySelector<HTMLElement>("#utility-title")!.focus();
      return;
    }
    if (startAfterRebuild) {
      startAfterRebuild = false;
      requestAnimationFrame(beginRun);
    } else if (focusLandingMode && !elements.startPanel.hidden) {
      landingModeInput.focus({ preventScroll: true });
    } else if (!elements.startPanel.hidden && document.activeElement !== landingModeInput) {
      (elements.startButton.disabled
        ? elements.mapOptions.querySelector<HTMLButtonElement>(".is-selected")
        : elements.startButton
      )?.focus({ preventScroll: true });
    }
  });
  nextGame.events.on("hud-update", (snapshot: SimulationSnapshot) => {
    elements.score.textContent = formatScore(snapshot.score);
  });
  nextGame.events.on("flight-message", (message: string) => showFlightMessage(message));
  nextGame.events.on("feedback", (event: FeedbackEvent) => audio.handle(event));
  nextGame.events.on("landing", (score: number) => {
    elements.score.textContent = formatScore(score);
    announce(`Aircraft landed. Score ${score}.`);
    window.clearTimeout(scorePulseTimer);
    elements.scoreTile.classList.remove("is-scoring");
    requestAnimationFrame(() => {
      elements.scoreTile.classList.add("is-scoring");
      scorePulseTimer = window.setTimeout(
        () => elements.scoreTile.classList.remove("is-scoring"),
        540,
      );
    });
  });
  nextGame.events.on("route-coach", (stage: "selected" | "locked" | "set") => {
    if (routeCoachCompleted || routeCoachDismissed) return;
    window.clearTimeout(routeCoachTimer);
    elements.routeCoachmarkCopy.textContent =
      stage === "selected"
        ? "Draw this aircraft to the highlighted landing area."
        : stage === "locked"
          ? "Landing area acquired — release to set the route."
          : "Route set. The aircraft will follow your line.";
    elements.routeCoachmark.hidden = false;
    if (stage === "set") {
      routeCoachCompleted = true;
      rememberRouteCoachCompletion();
      routeCoachTimer = window.setTimeout(hideRouteCoachmark, 2_200);
    }
  });
  nextGame.events.on("run-state", (state: string) => {
    if (state !== "running") hideRouteCoachmark();
  });
  nextGame.events.on("game-over", handleGameOver);
  nextGame.events.on("route-status", announce);
  return nextGame;
}

let game = createGame(activeProfile, activeMapId);
updateResumeOffer();

function playScene(): PlayScene | undefined {
  if (!sceneReady) return undefined;
  return game.scene.getScene("play") as PlayScene;
}

function showOnly(panel?: HTMLElement): void {
  document.body.dataset.screen =
    panel === elements.startPanel ? "home" : panel ? "overlay" : "play";
  const panels = [
    elements.startPanel,
    elements.pausePanel,
    elements.gameoverPanel,
  ];
  const hadVisiblePanel = panels.some((candidate) => !candidate.hidden);
  if (
    panel &&
    !hadVisiblePanel &&
    document.activeElement instanceof HTMLElement
  ) {
    focusBeforePanel = document.activeElement;
  }
  panels.forEach((candidate) => {
    candidate.hidden = panel !== candidate;
  });
  const modalOpen = panel !== undefined;
  elements.gameCanvas.inert = modalOpen;
  elements.hud.inert = modalOpen;
  requestAnimationFrame(() => {
    if (!utilityScreen.hidden) return;
    if (panel) {
      (panel === elements.pausePanel
        ? elements.resumeButton.disabled ? elements.pausePanel : elements.resumeButton
        : panel === elements.startPanel
          ? elements.startButton.disabled
            ? elements.mapOptions.querySelector<HTMLButtonElement>(
                ".is-selected",
              )
            : elements.startButton
          : elements.restartButton
      )?.focus({ preventScroll: true });
      return;
    }
    const previous = focusBeforePanel;
    focusBeforePanel = null;
    if (
      previous?.isConnected &&
      !previous.closest("[hidden]") &&
      !previous.matches(":disabled")
    ) {
      previous.focus({ preventScroll: true });
    } else if (!elements.pauseButton.disabled) {
      elements.pauseButton.focus({ preventScroll: true });
    }
  });
}

function hideRouteCoachmark(): void {
  window.clearTimeout(routeCoachTimer);
  elements.routeCoachmark.hidden = true;
}

document.querySelector("#dismiss-route-coach")!.addEventListener("click", () => {
  routeCoachDismissed = true;
  try { sessionStorage.setItem("vector-approach:route-coach-dismissed", "1"); } catch { /* Memory fallback. */ }
  hideRouteCoachmark();
  elements.pauseButton.focus({ preventScroll: true });
});

function activeRecord() {
  return currentSave.mapRecords[activeMapId];
}

function updateBestDisplays(): void {
  const best = formatScore(activeRecord().difficultyScores[activeDifficulty][activeProfile.id]);
  elements.best.textContent = best;
  elements.finalBest.textContent = best;
  elements.selectedMapName.textContent =
    mapDefinitionById(activeMapId).metadata.name;
  renderFieldDetail();
}

function rankProgressCopy(): string {
  const currentIndex = rankIndex(currentSave.career.earnedRankId);
  const next = RANK_CATALOG[currentIndex + 1];
  if (!next) return "Highest clearance earned.";
  const requirements = next.requirements;
  const progress = promotionProgress(currentSave.career, currentSave.mapRecords, requirements.qualifyingBestScore);
  return `${currentSave.career.totalSafeLandings}/${requirements.minimumSafeLandings} landings · ${currentSave.career.shiftsPlayed}/${requirements.minimumShifts} shifts · ${progress.distinctMaps}/${requirements.minimumDistinctMaps} airfields at ${requirements.qualifyingBestScore}+`;
}

/** Progress toward the next rank as three small meters; a met goal shows full with a check. */
function renderRankProgress(target: HTMLElement): void {
  const next = RANK_CATALOG[rankIndex(currentSave.career.earnedRankId) + 1];
  if (!next) {
    target.textContent = "Highest clearance earned.";
    return;
  }
  const requirements = next.requirements;
  const progress = promotionProgress(currentSave.career, currentSave.mapRecords, requirements.qualifyingBestScore);
  const heading = el("p", "rank-next", "Next rank · ");
  heading.append(el("strong", "", next.name));
  const meters = el("ul", "rank-meters");
  for (const [label, done, goal] of [
    ["Landings", currentSave.career.totalSafeLandings, requirements.minimumSafeLandings],
    ["Shifts", currentSave.career.shiftsPlayed, requirements.minimumShifts],
    [`Airfields at ${requirements.qualifyingBestScore}+`, progress.distinctMaps, requirements.minimumDistinctMaps],
  ] as const) {
    const met = done >= goal;
    const item = el("li", met ? "is-met" : "");
    const value = el("strong", "", `${Math.min(done, goal)}/${goal}${met ? " ✓" : ""}`);
    const bar = el("span", "rank-meter");
    bar.setAttribute("aria-hidden", "true");
    bar.style.setProperty("--fill", `${Math.min(100, (done / Math.max(1, goal)) * 100)}%`);
    item.append(value, ` ${label}`, bar);
    meters.append(item);
  }
  target.replaceChildren(heading, meters);
}

function renderCareer(): void {
  elements.currentRank.textContent = rankDefinition(
    currentSave.career.earnedRankId,
  ).name;
  elements.rankProgress.textContent = rankProgressCopy();
}

function renderShell(): void {
  renderCareer();
  airfieldList.render();
  updateBestDisplays();
  audioSettings.show(currentSave.settings.audio);
}

function beginRun(): void {
  if (savingLandingMode) return;
  if (activeLivery !== currentSave.settings.livery || activeTwoEndLanding !== currentSave.settings.twoEndLanding || createdViewport.width !== window.innerWidth || createdViewport.height !== window.innerHeight) {
    rebuildForTarget(profileForViewport(), activeMapId, true);
    return;
  }
  const scene = playScene();
  if (!scene) return;
  window.clearTimeout(promotionAudioTimer);
  activeDifficulty = currentSave.selectedDifficulty;
  resetResizeState();
  activeRunId = crypto.randomUUID();
  finishingRunId = '';
  clearActiveShift();
  updateResumeOffer();
  scene.startRun(activeDifficulty, activeRunId);
  updateBestDisplays();
  document.querySelector('#hud-difficulty')!.textContent = `Best · ${DIFFICULTY_LABELS[activeDifficulty]}`;
  audio.handle({ type: "ui-confirm", action: "play" });
  scene.setTimeScale(GAME_SPEEDS[speedIndex].scale);
  elements.pauseButton.disabled = false;
  elements.speedButton.disabled = false;
  showOnly();
  elements.pauseButton.setAttribute("aria-label", "Pause game");
  mountHugeIcon(elements.pauseIcon, "pause", 22);
  elements.resumeLabel.textContent = "Resume";
  elements.score.textContent = "00";
  if (!fieldPlayable()) pauseRun();
  hideRouteCoachmark();
  if (!routeCoachCompleted && !routeCoachDismissed) {
    elements.routeCoachmarkCopy.textContent =
      activeTwoEndLanding ? "Draw to either runway end or to the matching helipad." : "Draw to the highlighted runway end or matching helipad.";
    elements.routeCoachmark.hidden = false;
    routeCoachTimer = window.setTimeout(hideRouteCoachmark, 6_000);
  }
}

function rebuildForTarget(
  profile: ViewportProfile,
  mapId: MapId,
  beginWhenReady: boolean,
  restore?: ActiveShift,
): void {
  resetResizeState();
  sceneReady = false;
  startAfterRebuild = beginWhenReady;
  activeProfile = profile;
  activeMapId = mapId;
  elements.startButton.disabled = true;
  elements.pauseButton.disabled = true;
  elements.speedButton.disabled = true;
  game.destroy(true);
  game = createGame(profile, mapId, restore);
  renderShell();
}

function persistShift(): void {
  const scene = playScene();
  if (!scene || !activeRunId || scene.getPhase() !== "paused") return;
  saveActiveShift({
    version: 1,
    savedAt: Date.now(),
    mapId: activeMapId,
    difficulty: activeDifficulty,
    orientation: activeProfile.id,
    world: worldSize(),
    twoEndLanding: activeTwoEndLanding,
    ...scene.exportShift(),
  });
}

function updateResumeOffer(): void {
  const shift = loadActiveShift();
  const offer = !!shift && isMapUnlocked(shift.mapId, currentSave.career.earnedRankId);
  elements.resumeShiftButton.hidden = !offer;
  if (!offer) return;
  const name = mapDefinitionById(shift.mapId).metadata.name;
  const landed = formatScore(shift.simulation.score);
  elements.resumeShiftButton.title = `${name} · ${DIFFICULTY_LABELS[shift.difficulty]} · ${landed} landed`;
  elements.resumeShiftContext.replaceChildren(shiftTags({
    // No orientation tag here: it follows the device, so it does not help choose between resuming and starting.
    name, difficulty: shift.difficulty, landed, twoEndLanding: shift.twoEndLanding,
  }));
}

async function resumeSavedShift(): Promise<void> {
  const shift = loadActiveShift();
  if (!shift || !sceneReady || !isMapUnlocked(shift.mapId, currentSave.career.earnedRankId)) {
    updateResumeOffer();
    return;
  }
  await audio.unlock();
  rebuildForTarget(shift.orientation === "portrait" ? PORTRAIT_PROFILE : LANDSCAPE_PROFILE, shift.mapId, false, shift);
}

function finishRestore(shift: ActiveShift): void {
  const scene = playScene();
  if (!scene?.restoreRun(shift.difficulty, shift)) {
    clearActiveShift();
    updateResumeOffer();
    showOnly(elements.startPanel);
    announce("Saved shift could not be restored");
    return;
  }
  window.clearTimeout(promotionAudioTimer);
  activeDifficulty = shift.difficulty;
  resetResizeState();
  activeRunId = shift.runId;
  finishingRunId = '';
  scene.setTimeScale(GAME_SPEEDS[speedIndex].scale);
  updateBestDisplays();
  document.querySelector('#hud-difficulty')!.textContent = `Best · ${DIFFICULTY_LABELS[activeDifficulty]}`;
  elements.score.textContent = formatScore(shift.simulation.score);
  elements.pauseButton.disabled = false;
  elements.speedButton.disabled = false;
  elements.resumeLabel.textContent = "Resume";
  hideRouteCoachmark();
  showPausePanel();
}

async function selectMap(mapId: MapId): Promise<void> {
  if (mapId === activeMapId || !sceneReady) return;
  await audio.unlock();
  if (isMapUnlocked(mapId, currentSave.career.earnedRankId))
    currentSave = await setSelectedMap(mapId);
  audio.handle({ type: "ui-confirm", action: "map-select" });
  rebuildForTarget(activeProfile, mapId, false);
}

async function startRun(): Promise<void> {
  currentSave = await gameStore.load();
  if (!isMapUnlocked(activeMapId, currentSave.career.earnedRankId)) return;
  await audio.unlock();
  const requestedProfile = profileForViewport();
  if (layoutChanged()) {
    rebuildForTarget(requestedProfile, activeMapId, true);
    return;
  }
  beginRun();
}

function pauseRun(): void {
  const scene = playScene();
  if (!scene || scene.getPhase() !== "running") return;
  scene.pauseRun();
  persistShift();
  showPausePanel();
}

function showPausePanel(): void {
  showOnly(elements.pausePanel);
  // The airfield name is the pause heading, so the details below are tags only.
  document.querySelector("#pause-map-name")!.textContent = mapDefinitionById(activeMapId).metadata.name;
  renderShiftContext(document.querySelector<HTMLElement>("#pause-context")!, elements.score.textContent ?? "");
  updateResizeNotice();
  elements.pauseButton.setAttribute("aria-label", "Resume game");
  mountHugeIcon(elements.pauseIcon, "play", 22);
}

async function resumeRun(): Promise<void> {
  await audio.unlock();
  const scene = playScene();
  if (!scene || scene.getPhase() !== "paused" || document.hidden
    || !utilityScreen.hidden || document.querySelector("dialog[open]")
    || resizeSettling || !fieldPlayable()) return;
  resetResizeState();
  scene.resumeRun();
  audio.handle({ type: "ui-confirm", action: "resume" });
  showOnly();
  elements.pauseButton.setAttribute("aria-label", "Pause game");
  mountHugeIcon(elements.pauseIcon, "pause", 22);
}

async function handleGameOver({
  reason,
  score,
  runId,
  evidence,
}: {
  reason: GameOverReason;
  score: number;
  runId?: string;
  evidence?: ShiftEvidence;
}): Promise<void> {
  if (runId && (runId !== activeRunId || finishingRunId === runId)) return;
  finishingRunId = runId ?? crypto.randomUUID();
  const completedRunId = finishingRunId;
  clearActiveShift();
  updateResumeOffer();
  const copy =
    reason === "airspace"
      ? [
          "Aircraft left the sector",
          "An aircraft crossed the edge before reaching its landing zone.",
        ]
      : [
          "Aircraft collided",
          "Two aircraft made contact. Keep their airframes clear of each other.",
        ];
  elements.gameoverCode.textContent = copy[0];
  elements.gameoverCopy.textContent = copy[1];
  const isRecord = score > activeRecord().difficultyScores[activeDifficulty][activeProfile.id];
  document.querySelector<HTMLElement>("#record-message")!.hidden = !isRecord;
  // Both result cards keep one-word labels so they stay level; the record's context reads below them.
  document.querySelector("#result-best-label")!.textContent = "Best";
  // The same tags as the pause card; the airfield, the pause card's heading, joins the eyebrow here.
  document.querySelector("#result-eyebrow")!.textContent = `Shift ended · ${mapDefinitionById(activeMapId).metadata.name}`;
  renderShiftContext(document.querySelector<HTMLElement>('#result-difficulty')!, formatScore(score));
  document.querySelector<HTMLElement>('#achievement-result')!.hidden = true;
  elements.finalScore.textContent = formatScore(score);
  resetCareerResult(elements.careerResult, "Recording shift…");
  elements.pauseButton.disabled = true;
  elements.speedButton.disabled = true;
  elements.restartButton.disabled = true;
  elements.chooseMapButton.disabled = true;
  showOnly(elements.gameoverPanel);
  const result = await saveCompletedShift({
    runId: completedRunId,
    difficulty: activeDifficulty,
    evidence,
    mapId: activeMapId,
    orientation: activeProfile.id,
    score,
    safeLandings: score,
  });
  currentSave = result.save;
  renderAchievementBadges(document.querySelector<HTMLElement>('#achievement-result')!, result.newAchievements);
  if (result.newAchievements.length) announce(`Achievements earned: ${result.newAchievements.map(id => ACHIEVEMENTS.find(a => a.id === id)!.name).join(' · ')}`);
  renderShell();
  if (result.promoted) {
    const earned = rankDefinition(result.earnedRankId);
    const promotionDelay = reason === "collision" ? 940 : 0;
    renderPromotion(elements.careerResult, earned.name, earned.unlocks.map((id) => mapDefinitionById(id).metadata.name), promotionDelay);
    const liveries = LIVERIES.filter(livery => rankIndex(livery.rank) > rankIndex(result.previousRankId) && rankIndex(livery.rank) <= rankIndex(result.earnedRankId));
    if (liveries.length) {
      elements.careerResult.append(el('p', 'career-result-note', `${liveries.map(livery => livery.name).join(' and ')} livery unlocked. Choose it in Your career.`));
    }
    announce(`Promoted to ${earned.name}.${liveries.length ? ' New liveries available in Your career.' : ''}`);
    promotionAudioTimer = window.setTimeout(
      () => {
        audio.handle({
          type: "promotion",
          previousRankId: result.previousRankId,
          rankId: result.earnedRankId,
        });
      },
      promotionDelay,
    );
    currentSave = await acknowledgeEarnedRank();
  } else {
    renderRankProgress(elements.careerResult);
  }
  if (!result.persisted) {
    elements.careerResult.append(el("span", "career-result-note", " Progress is available this session only; saving on this device failed."));
  }
  elements.restartButton.disabled = false;
  elements.chooseMapButton.disabled = false;
}

document.querySelectorAll<HTMLInputElement>('input[name="difficulty"], input[name="airfield-difficulty"]').forEach(input => input.addEventListener('change', async () => {
  if (!input.checked || !isDifficulty(input.value)) return;
  currentSave = await gameStore.selectDifficulty(input.value);
  activeDifficulty = currentSave.selectedDifficulty;
  renderShell();
  // On the airfield chooser, its cards and status follow the new difficulty at once.
  if (!document.querySelector<HTMLElement>('#airfields-content')!.hidden) airfieldList.show();
}));
landingModeInput.addEventListener('change', async () => {
  if (savingLandingMode || elements.startPanel.hidden || !utilityScreen.hidden) return;
  savingLandingMode = true;
  restoreLandingModeFocus = document.activeElement === landingModeInput;
  landingModeInput.disabled = true;
  elements.startButton.disabled = true;
  try {
    currentSave = await gameStore.setTwoEndLanding(landingModeInput.checked);
    resetPractice();
    menuPictures.refresh();
  } finally {
    savingLandingMode = false;
  }
  rebuildForTarget(profileForViewport(), activeMapId, false);
});
// Night only changes the look, so the live map updates without a rebuild; the store queue orders rapid toggles.
nightModeInput.addEventListener("change", () => {
  playScene()?.setNight(nightModeInput.checked);
  void gameStore.setNight(nightModeInput.checked).then(save => {
    currentSave = save;
    menuPictures.refresh();
  });
});
// Weather only changes the look too: the live map shows or hides its clouds at once.
weatherInput.addEventListener("change", () => {
  playScene()?.setWeather(weatherInput.checked);
  void gameStore.setWeather(weatherInput.checked).then(save => {
    currentSave = save;
    menuPictures.refresh();
  });
});
elements.startButton.addEventListener("click", () => void startRun());
elements.restartButton.addEventListener("click", () => void startRun());
elements.restartFromPause.addEventListener("click", () =>
  confirmShift(RESTART_SHIFT, () => void startRun()),
);
elements.resumeButton.addEventListener("click", () => void resumeRun());
elements.chooseMapButton.addEventListener("click", () => {
  renderShell();
  showOnly(elements.startPanel);
});
elements.resumeShiftButton.addEventListener("click", () => void resumeSavedShift());
// Some platforms kill a hidden page without another event; pausing here saves the shift.
window.addEventListener("pagehide", () => pauseRun());
elements.speedButton.addEventListener("click", () => {
  speedIndex = (speedIndex + 1) % GAME_SPEEDS.length;
  const speed = GAME_SPEEDS[speedIndex];
  playScene()?.setTimeScale(speed.scale);
  elements.speedButton.textContent = speed.label;
  elements.speedButton.setAttribute("aria-label", `Game speed: ${speed.name}`);
  announce(`Game speed ${speed.name}`);
});
elements.pauseButton.addEventListener("click", () => {
  if (playScene()?.getPhase() === "paused") void resumeRun();
  else pauseRun();
});

// Dismiss secondary menus without consuming the outside click or tap.
document.addEventListener("pointerdown", (event) => {
  if (!(event.target instanceof Node)) return;
  for (const menu of document.querySelectorAll<HTMLDetailsElement>(".menu-more[open]")) {
    if (!menu.contains(event.target)) menu.open = false;
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
  if (!utilityScreen.hidden) { event.preventDefault(); history.back(); return; }
  if (playScene()?.getPhase() === "paused") void resumeRun();
  else pauseRun();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pauseRun();
    void audio.suspend();
  }
});

window.addEventListener("resize", () => {
  const scene = playScene();
  if (scene?.getPhase() === "running" || scene?.getPhase() === "paused") {
    scene.cancelDrawing();
    const significant = shouldPauseForResize(acceptedViewport, availableViewport(), worldSize());
    if (significant || scene.getPhase() === "paused") {
      resizedWhilePaused = true;
      resizeSettling = true;
      pauseRun();
      updateResizeNotice();
    }
  }
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    resizeSettling = false;
    if (!elements.startPanel.hidden && utilityScreen.hidden) {
      rebuildForTarget(profileForViewport(), activeMapId, false);
    }
    // A new window size can change the layout a new shift gets, so redraw the pictures to match.
    menuPictures.resized();
    updateResizeNotice();
  }, 160);
});

window.addEventListener("pagehide", () => void audio.destroy(), { once: true });

const utilityScreen = document.querySelector<HTMLElement>("#utility-screen")!;
const resetPractice = mountPractice(() => currentSave.settings.twoEndLanding);
let utilityReturnPanel: HTMLElement = elements.startPanel;
let utilityReturnFocus: HTMLElement | null = null;
const utilityNames = ["settings", "career", "help", "practice", "airfields"] as const;
type UtilityName = typeof utilityNames[number];
function isUtilityName(value: string): value is UtilityName {
  return utilityNames.some(name => name === value);
}
function renderFieldDetail(): void {
  const definition = mapDefinitionById(activeMapId);
  const preview = document.querySelector<HTMLImageElement>('#home-map-preview')!;
  const previewUrl = previews.get(activeMapId);
  if (previewUrl) preview.src = previewUrl;
  else {
    preview.removeAttribute('src');
    menuPictures.showSelected();
  }
  preview.style.objectPosition = `var(--map-focus-${activeMapId}, center)`;
  const unlocked = isMapUnlocked(activeMapId, currentSave.career.earnedRankId);
  document.querySelector("#field-title")!.textContent =
    definition.metadata.name;
  document.querySelector("#field-difficulty")!.textContent =
    definition.metadata.layoutLabel;
  document.querySelector("#field-description")!.textContent =
    definition.metadata.description;
  document.querySelector("#field-record")!.textContent =
    `Best · ${formatScore(bestOnAirfield(currentSave, activeMapId))} landings`;
  document.querySelectorAll<HTMLInputElement>('input[name="difficulty"]').forEach(input => { input.checked = input.value === currentSave.selectedDifficulty; });
  document.querySelector<HTMLFieldSetElement>('#difficulty-options')!.disabled = !unlocked;
  landingModeInput.checked = currentSave.settings.twoEndLanding;
  nightModeInput.checked = currentSave.settings.night;
  weatherInput.checked = currentSave.settings.weather;
  landingModeInput.disabled = savingLandingMode || !sceneReady || !unlocked;
  const lock = document.querySelector<HTMLElement>("#field-lock")!;
  lock.hidden = unlocked;
  const rank = rankDefinition(definition.metadata.unlockRankId);
  const r = rank.requirements;
  lock.textContent = `Earn ${rank.name}: ${r.minimumSafeLandings} safe landings, ${r.minimumShifts} shifts, and a best of ${r.qualifyingBestScore}+ on ${r.minimumDistinctMaps} ${r.minimumDistinctMaps === 1 ? "airfield" : "airfields"}. See Your career for your progress.`;
  elements.startButton.disabled = savingLandingMode || !sceneReady || !unlocked;
}

function updateResizeNotice(): void {
  const notice = document.querySelector<HTMLElement>("#resize-notice")!;
  const playable = fieldPlayable();
  const message = !playable
    ? "The airfield is too small to play comfortably. Enlarge the window or rotate your device to continue this shift."
    : resizeSettling
      ? "Adjusting to the screen size. Your shift is paused."
      : resizedWhilePaused
        ? "Screen size changed. Your shift is paused and ready to continue."
        : "";
  notice.hidden = !message;
  if (notice.textContent !== message) notice.textContent = message;
  elements.resumeButton.disabled = resizeSettling || !playable;
  elements.resumeLabel.textContent = "Resume";
  elements.restartFromPause.hidden = false;
}

/** The shift's airfield as a heading, then its settings as short tags; the landing count only while paused. */
/** The pause and result cards' shared tags; both name the airfield elsewhere (heading, eyebrow). */
function renderShiftContext(target: HTMLElement, landed: string): void {
  target.replaceChildren(shiftTags({
    difficulty: activeDifficulty,
    landed,
    orientation: activeProfile.id,
    twoEndLanding: activeTwoEndLanding,
  }));
}

document.querySelector("#pause-map")!.addEventListener("click", () =>
  confirmShift(LEAVE_SHIFT,
    () => {
      clearActiveShift();
      updateResumeOffer();
      rebuildForTarget(activeProfile, activeMapId, false);
      showOnly(elements.startPanel);
    },
  ),
);

function renderCareerDetail(): void {
  renderCareerPage(document.querySelector<HTMLElement>("#career-content")!, currentSave, previews, currentSave.selectedDifficulty, async livery => {
    const result = await gameStore.selectLivery(livery);
    currentSave = result.save;
    return result;
  });
}

function openUtility(screen: string, pushHistory = true): void {
  if (!isUtilityName(screen)) return;
  if (utilityScreen.hidden) {
    utilityReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (playScene()?.getPhase() === "running") pauseRun();
    utilityReturnPanel = [elements.pausePanel, elements.gameoverPanel, elements.startPanel]
      .find(panel => !panel.hidden) ?? elements.startPanel;
  }
  hideRouteCoachmark();
  resetPractice();
  for (const name of utilityNames) {
    document.querySelector<HTMLElement>(`#${name}-content`)!.hidden = name !== screen;
  }
  const title = document.querySelector<HTMLElement>("#utility-title")!;
  title.textContent = { help: "How to play", career: "Your career", settings: "Settings", practice: "Practice flight", airfields: "Choose airfield" }[screen];
  if (screen === "career") renderCareerDetail();
  if (screen === 'airfields') airfieldList.show();
  // These screens list every airfield, so their pictures are drawn now rather than at startup.
  if (screen === 'airfields' || screen === 'career') menuPictures.showAll();
  document.querySelector<HTMLElement>("#utility-support")!.hidden = screen === "airfields";
  utilityScreen.dataset.page = screen;
  utilityScreen.hidden = false;
  document.querySelector<HTMLElement>("#utility-scroll")!.scrollTop = 0;
  document.body.dataset.screen = "utility";
  for (const element of [elements.startPanel, elements.pausePanel, elements.gameoverPanel, elements.gameCanvas, elements.hud]) element.inert = true;
  if (pushHistory) history.pushState(null, "", `#${screen}`);
  title.focus({ preventScroll: true });
}
function closeUtility(): void {
  resetPractice();
  utilityScreen.hidden = true;
  for (const panel of [elements.startPanel, elements.pausePanel, elements.gameoverPanel]) panel.inert = false;
  showOnly(utilityReturnPanel);
  requestAnimationFrame(() => {
    if (utilityReturnFocus?.isConnected && !utilityReturnFocus.closest("[hidden]")) utilityReturnFocus.focus({ preventScroll: true });
  });
}
window.addEventListener("popstate", () => {
  const screen = location.hash.slice(1);
  if (isUtilityName(screen)) openUtility(screen, false);
  else if (!utilityScreen.hidden) closeUtility();
});
document.querySelectorAll<HTMLElement>("[data-screen]").forEach(button =>
  button.addEventListener("click", () => openUtility(button.dataset.screen!))
);
document.querySelector("#utility-close")!.addEventListener("click", () => history.back());

renderShell();
showOnly(elements.startPanel);
const initialUtility = location.hash.slice(1);
if (isUtilityName(initialUtility)) {
  // Establish an in-app Back destination when entering a shared/reloaded screen URL.
  history.replaceState(null, "", location.pathname + location.search);
  openUtility(initialUtility);
}
/** The selected airfield is already on screen at startup, so its picture is cut from that frame instead of drawn again. */
function offerLivePreview(source: Phaser.Game): void {
  const scene = playScene();
  // Only a frame that matches what a fresh picture would show: same window, runway mode, and settings.
  if (!scene || createdViewport.width !== window.innerWidth || createdViewport.height !== window.innerHeight || activeTwoEndLanding !== currentSave.settings.twoEndLanding) return;
  menuPictures.takeFromFrame(source, scene.getLayout().landingZones, () => playScene() === scene);
}
// Inline MODE checks let Vite drop the unused PWA and Android imports per edition.
if (import.meta.env.MODE !== "desktop" && import.meta.env.MODE !== "android") {
  void import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
}

/** Android back dismisses the topmost layer or pauses play; it never resumes a shift. */
function handleBackIntent(): boolean {
  const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
  if (dialog) { dialog.close(); return true; }
  const menu = document.querySelector<HTMLDetailsElement>(".menu-more[open]");
  if (menu) { menu.open = false; return true; }
  if (!utilityScreen.hidden) { history.back(); return true; }
  if (playScene()?.getPhase() === "running") { pauseRun(); return true; }
  return false;
}
if (import.meta.env.MODE === "android") {
  void import("./platform/android").then(({ installAndroidShell }) => installAndroidShell(handleBackIntent));
}

review?.mountReviewControls((reason, score) => {
  playScene()?.pauseRun();
  void handleGameOver({ reason, score });
});

// Custom game overlays retain focus; native nested dialogs handle their own trap.
document.addEventListener("keydown", (event) => {
  if (document.querySelector("dialog[open]") || !utilityScreen.hidden) return;
  const panel = [
    elements.startPanel,
    elements.pausePanel,
    elements.gameoverPanel,
  ].find((node) => !node.hidden);
  if (!panel || event.key !== "Tab") return;
  const controls = [
    ...panel.querySelectorAll<HTMLElement>(
      'button:not(:disabled),input:not(:disabled),summary,[tabindex="0"]',
    ),
  ].filter((node) => node.getClientRects().length > 0);
  const first = controls[0],
    last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
});
/** Read-only development seam; never exposes the live game or simulation. */
export function inspectShift() {
  if (!import.meta.env.DEV) throw new Error("Shift inspection is development-only");
  return { ...playScene()?.getShiftSnapshot(), orientation: activeProfile.id,
    world: worldSize() };
}

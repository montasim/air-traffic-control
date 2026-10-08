import { LIVERIES } from './progression/liveries';
import { AIRPORT_CATEGORIES } from './game/maps/categories';
import { DIFFICULTY_LABELS, isDifficulty, type DifficultyId } from './core/difficulty';
import { ACHIEVEMENTS, type ShiftEvidence } from './progression/achievements';
import { renderCareer as renderCareerPage } from "./ui/career";
import Phaser from "phaser";
import type { FeedbackEvent } from "./app/feedbackEvents";
import { GameAudio, WebAudioBackend } from "./audio";
import type { GameOverReason, SimulationSnapshot } from "./core/types";
import { DEFAULT_MAP_ID, type MapId } from "./game/maps/mapIds";
import { MAP_DEFINITIONS, mapDefinitionById } from "./game/maps/registry";
import { PlayScene } from "./game/scenes/PlayScene";
import { GAME_FONT_LOAD_DESCRIPTORS } from "./game/typography";
import {
  needsNewShiftLayout,
  worldSizeForViewport,
  isFieldPlayable,
  shouldPauseForResize,
  profileForViewport,
  PORTRAIT_PROFILE,
  LANDSCAPE_PROFILE,
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
import { mountPractice } from "./ui/practice";
import { createMapPreviews } from "./ui/mapPreviews";
import { renderAchievementBadges, renderPromotion, resetCareerResult } from "./ui/shiftCelebration";
import {
  COMPETITION_ENABLED,
  CompetitionError,
  competitionErrorCopy,
  getChallenge,
  startChallenge,
  submitChallenge,
  submitChallengeFeedback,
} from './competition';
import { createChallengeRun, type FrozenChallengeRun } from './competition/rules';
import type { ChallengeResponse, FairnessAnswer, FairnessFactor, StartChallengeResponse } from './competition/contracts';
import type { RouteCommand } from './competition/verifyRun';
import { renderChallenge, type ChallengeViewState } from './ui/challenge';

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
  rankedMarker: document.querySelector<HTMLElement>('#ranked-marker')!,
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
  audioToggles: [
    ...document.querySelectorAll<HTMLButtonElement>("[data-audio-toggle]"),
  ],
  audioIcons: [...document.querySelectorAll<HTMLElement>("[data-audio-icon]")],
  volumeInputs: [
    ...document.querySelectorAll<HTMLInputElement>("[data-audio-volume]"),
  ],
};

mountHugeIcon(elements.pauseIcon, "pause", 22);
mountHugeIcon(elements.startIcon, "play", 18);
mountHugeIcon(elements.resumeIcon, "play", 18);
mountHugeIcon(elements.restartFromPauseIcon, "restart", 18);
mountHugeIcon(elements.restartIcon, "restart", 18);
mountHugeIcon(elements.chooseMapIcon, "home", 18);
for (const name of ["home", "settings", "help", "career", "challenge", "back", "expand", "play", "restart", "close"] as const) {
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
const previews = new Map<MapId, string>();
if (
  !isMapUnlocked(currentSave.selectedMapId, currentSave.career.earnedRankId)
) {
  currentSave = await setSelectedMap(DEFAULT_MAP_ID);
}

const audio = new GameAudio(new WebAudioBackend(), currentSave.settings.audio);
await audio.prepare();

let activeProfile = profileForViewport();
let createdViewport = { width: window.innerWidth, height: window.innerHeight };
function layoutChanged(): boolean {
  return (
    needsNewShiftLayout(activeProfile, profileForViewport())
  );
}
let categoryFilter = 'all';
let activeMapId: MapId = currentSave.selectedMapId;
let activeDifficulty: DifficultyId = currentSave.selectedDifficulty;
let activeLivery = currentSave.settings.livery;
let activeTwoEndLanding = currentSave.settings.twoEndLanding;
let savingLandingMode = false;
let restoreLandingModeFocus = false;
const landingModeInput = document.querySelector<HTMLInputElement>('#two-end-landing')!;
const landingModeLabel = () => activeTwoEndLanding ? 'Both landing ends' : 'One landing end';
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
function fieldPlayable(): boolean {
  return isFieldPlayable(game.scale.gameSize, availableViewport());
}
let volumeSaveTimer = 0;
let promotionAudioTimer = 0;
let focusBeforePanel: HTMLElement | null = null;
let routeCoachCompleted = routeCoachWasCompleted();
let routeCoachDismissed = false;
try { routeCoachDismissed = sessionStorage.getItem("vector-approach:route-coach-dismissed") === "1"; } catch { /* Session-only fallback. */ }
let routeCoachTimer = 0;
let scorePulseTimer = 0;

interface RankedSession {
  readonly runId: string;
  readonly expiresAt: string;
  readonly rules: FrozenChallengeRun;
  readonly challenge: StartChallengeResponse['challenge'];
  commands?: readonly RouteCommand[];
}

let rankedSession: RankedSession | undefined;
let challengeResponse: ChallengeResponse | undefined;
let challengeViewState: ChallengeViewState = { status: 'loading' };

elements.gameCanvas.inert = true;
elements.hud.inert = true;

function createGame(profile: ViewportProfile, mapId: MapId): Phaser.Game {
  activeLivery = currentSave.settings.livery;
  activeTwoEndLanding = rankedSession ? false : currentSave.settings.twoEndLanding;
  createdViewport = { width: window.innerWidth, height: window.innerHeight };
  const world = rankedSession?.rules.world ?? worldSizeForViewport(window.innerWidth, window.innerHeight);
  const nextGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    ...world,
    backgroundColor: "#263f3c",
    render: { antialias: true, roundPixels: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
    scene: [new PlayScene(mapDefinitionById(mapId), activeTwoEndLanding, activeLivery, rankedSession?.rules)],
  });

  nextGame.events.on("scene-ready", () => {
    sceneReady = true;
    const focusLandingMode = restoreLandingModeFocus;
    restoreLandingModeFocus = false;
    landingModeInput.disabled = savingLandingMode || !isMapUnlocked(activeMapId, currentSave.career.earnedRankId);
    document.dispatchEvent(new Event("game-ready"));
    elements.startButton.disabled = savingLandingMode || !isMapUnlocked(
      activeMapId,
      currentSave.career.earnedRankId,
    );
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

function formatScore(value: number): string {
  return Math.max(0, value).toString().padStart(2, "0");
}

function announce(message: string): void {
  elements.routeStatus.textContent = "";
  // Play stays quiet: only a rejected route is shown, because it explains a failed input.
  // Every message, landings included, still reaches screen readers through #route-status.
  if (message.startsWith("Route not added")) showFlightMessage(message);
  requestAnimationFrame(() => {
    elements.routeStatus.textContent = message;
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
  return `${currentSave.career.totalSafeLandings}/${requirements.minimumSafeLandings} safe landings · ${currentSave.career.shiftsPlayed}/${requirements.minimumShifts} shifts · ${progress.distinctMaps}/${requirements.minimumDistinctMaps} airfields with a best of ${requirements.qualifyingBestScore}+`;
}

function renderCareer(): void {
  elements.currentRank.textContent = rankDefinition(
    currentSave.career.earnedRankId,
  ).name;
  elements.rankProgress.textContent = rankProgressCopy();
}

function mapBest(mapId: MapId): number {
  const scores = currentSave.mapRecords[mapId].difficultyScores[currentSave.selectedDifficulty];
  return Math.max(scores.portrait, scores.landscape);
}

function renderMapOptions(): void {
  const buttons = MAP_DEFINITIONS.filter(map => categoryFilter === 'all' || map.metadata.category === categoryFilter).map((definition) => {
    const unlocked = isMapUnlocked(
      definition.id,
      currentSave.career.earnedRankId,
    );
    const selected = definition.id === activeMapId;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-option";
    button.dataset.mapId = definition.id;
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-disabled", String(!unlocked));
    button.setAttribute(
      "aria-label",
      `${definition.metadata.name}${unlocked ? "" : `, locked. Requires ${rankDefinition(definition.metadata.unlockRankId).name}`}`,
    );
    const preview = previews.get(definition.id);
    if (preview) button.style.setProperty("--map-preview", `url("${preview}")`);
    if (selected) button.classList.add("is-selected");
    if (!unlocked) button.classList.add("is-locked");
    const title = document.createElement("strong");
    title.textContent = definition.metadata.name;
    const detail = document.createElement("span");
    detail.textContent = unlocked
      ? `${AIRPORT_CATEGORIES[definition.metadata.category]} · ${DIFFICULTY_LABELS[currentSave.selectedDifficulty]} best ${formatScore(mapBest(definition.id))}`
      : `Unlock at ${rankDefinition(definition.metadata.unlockRankId).name}`;
    const copy = document.createElement("small");
    copy.textContent = definition.metadata.description;
    button.append(title, detail, copy);
    button.addEventListener("click", () => {
      if (!unlocked) {
        document.querySelector('#airfield-selection-status')!.textContent = `${definition.metadata.name} unlocks at ${rankDefinition(definition.metadata.unlockRankId).name}. Complete career objectives to earn that clearance.`;
        return;
      }
      const choose = async () => {
        const discardSameMap = definition.id === activeMapId && playScene()?.getPhase() === 'paused';
        await selectMap(definition.id);
        if (discardSameMap) rebuildForTarget(activeProfile, activeMapId, false);
        utilityReturnPanel = elements.startPanel;
        utilityReturnFocus = document.querySelector('#choose-airfield');
        history.back();
      };
      if (playScene()?.getPhase() === 'paused') confirmAbandon('Leave this shift?', 'This unfinished shift will not count toward your career, records, or achievements.', () => void choose());
      else void choose();
    });
    return button;
  });
  elements.mapOptions.replaceChildren(...buttons);

}

function syncAudioControls(): void {
  const settings = currentSave.settings.audio;
  audio.setSettings(settings);
  elements.audioToggles.forEach((button) => {
    button.setAttribute("aria-pressed", String(settings.enabled));
    button.setAttribute("aria-label", "Sound effects");
    button.querySelector<HTMLElement>("[data-audio-label]")!.textContent =
      settings.enabled ? "Sound on" : "Sound off";
  });
  elements.audioIcons.forEach((icon) => {
    mountHugeIcon(icon, settings.enabled ? "volume" : "mute", 19);
  });
  document
    .querySelectorAll<HTMLOutputElement>("[data-audio-value]")
    .forEach((output) => {
      output.value = `${Math.round(settings.volume * 100)}%`;
    });
  elements.volumeInputs.forEach((input) => {
    input.value = String(Math.round(settings.volume * 100));
    input.style.setProperty("--volume-level", `${Math.round(settings.volume * 100)}%`);
    input.setAttribute(
      "aria-valuetext",
      `${Math.round(settings.volume * 100)} percent`,
    );
  });
}

function renderShell(): void {
  renderCareer();
  renderMapOptions();
  updateBestDisplays();
  syncAudioControls();
}

function beginRun(): void {
  if (savingLandingMode) return;
  if (!rankedSession && (activeLivery !== currentSave.settings.livery || activeTwoEndLanding !== currentSave.settings.twoEndLanding || createdViewport.width !== window.innerWidth || createdViewport.height !== window.innerHeight)) {
    rebuildForTarget(profileForViewport(), activeMapId, true);
    return;
  }
  const scene = playScene();
  if (!scene) return;
  window.clearTimeout(promotionAudioTimer);
  activeDifficulty = rankedSession?.rules.difficulty ?? currentSave.selectedDifficulty;
  resetResizeState();
  activeRunId = rankedSession?.runId ?? crypto.randomUUID();
  finishingRunId = '';
  scene.startRun(activeDifficulty, activeRunId);
  updateBestDisplays();
  elements.rankedMarker.hidden = !rankedSession;
  document.querySelector('#hud-difficulty')!.textContent = rankedSession
    ? `${rankedSession.rules.orientation === 'portrait' ? 'Portrait' : 'Landscape'} division`
    : `Best · ${DIFFICULTY_LABELS[activeDifficulty]}`;
  audio.handle({ type: "ui-confirm", action: "play" });
  elements.pauseButton.disabled = false;
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
): void {
  resetResizeState();
  sceneReady = false;
  startAfterRebuild = beginWhenReady;
  activeProfile = profile;
  activeMapId = mapId;
  elements.startButton.disabled = true;
  elements.pauseButton.disabled = true;
  game.destroy(true);
  game = createGame(profile, mapId);
  renderShell();
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
  if (rankedSession) {
    await startRankedAttempt(rankedSession.rules.orientation);
    return;
  }
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
  showOnly(elements.pausePanel);
  document.querySelector("#pause-context")!.textContent =
    rankedSession
      ? `${mapDefinitionById(activeMapId).metadata.name} · Ranked ${rankedSession.rules.orientation} division · ${elements.score.textContent} landed`
      : `${mapDefinitionById(activeMapId).metadata.name} · ${DIFFICULTY_LABELS[activeDifficulty]} · ${elements.score.textContent} landed · Started in ${activeProfile.id} · ${landingModeLabel()}`;
  updateResizeNotice();
  elements.pauseButton.setAttribute("aria-label", "Resume game");
  mountHugeIcon(elements.pauseIcon, "play", 22);
}

async function resumeRun(): Promise<void> {
  await audio.unlock();
  const scene = playScene();
  if (!scene || scene.getPhase() !== "paused" || document.hidden
    || !utilityScreen.hidden || document.querySelector("dialog[open]")
    || resizeSettling || !fieldPlayable()
    || (rankedSession !== undefined && profileForViewport().id !== rankedSession.rules.orientation)) return;
  resetResizeState();
  scene.resumeRun();
  audio.handle({ type: "ui-confirm", action: "resume" });
  showOnly();
  elements.pauseButton.setAttribute("aria-label", "Pause game");
  mountHugeIcon(elements.pauseIcon, "pause", 22);
}

function rankedProfile(orientation: FrozenChallengeRun['orientation']): ViewportProfile {
  return orientation === 'portrait' ? PORTRAIT_PROFILE : LANDSCAPE_PROFILE;
}

function leaveRankedMode(rebuild = true): void {
  rankedSession = undefined;
  elements.rankedMarker.hidden = true;
  elements.restartButton.querySelector<HTMLElement>('.button-label')!.textContent = 'Play again';
  elements.chooseMapButton.querySelector<HTMLElement>('.button-label')!.textContent = 'Main menu';
  activeMapId = currentSave.selectedMapId;
  activeDifficulty = currentSave.selectedDifficulty;
  activeProfile = profileForViewport();
  if (rebuild) rebuildForTarget(activeProfile, activeMapId, false);
}

function updateChallengeView(): void {
  renderChallenge(
    document.querySelector<HTMLElement>('#challenge-content')!,
    challengeViewState,
    { play: () => requestRankedStart(profileForViewport().id), refresh: () => void refreshChallenge() },
  );
}

function requestRankedStart(orientation: FrozenChallengeRun['orientation']): void {
  if (playScene()?.getPhase() === 'paused') {
    confirmAbandon(
      'Start ranked flight?',
      'Your unfinished shift will not count toward your career, records, or achievements.',
      () => void startRankedAttempt(orientation),
    );
    return;
  }
  void startRankedAttempt(orientation);
}

async function refreshChallenge(): Promise<void> {
  challengeViewState = { status: 'loading' };
  updateChallengeView();
  try {
    const result = await getChallenge();
    challengeResponse = result.data;
    challengeViewState = {
      status: 'ready', response: result.data, stale: result.stale,
      orientation: profileForViewport().id, starting: false,
    };
  } catch (error) {
    challengeViewState = { status: 'error', message: competitionErrorCopy(error) };
  }
  updateChallengeView();
}

async function startRankedAttempt(orientation: FrozenChallengeRun['orientation']): Promise<void> {
  if (challengeResponse) {
    challengeViewState = { status: 'ready', response: challengeResponse, stale: false, orientation, starting: true };
    updateChallengeView();
  }
  elements.restartButton.disabled = true;
  try {
    const challengeId = challengeResponse?.challenge?.id ?? rankedSession?.challenge.id;
    if (!challengeId) throw new CompetitionError('challenge-closed', 410, false);
    const { run } = await startChallenge(challengeId, orientation);
    const rules = createChallengeRun(run.challenge.mapId, orientation, run.challenge.seed);
    if (run.challenge.ruleset !== rules.ruleset || run.challenge.difficulty !== rules.difficulty || run.challenge.twoEndLanding !== rules.twoEndLanding) {
      throw new CompetitionError('update-required', 409, false);
    }
    rankedSession = { runId: run.runId, expiresAt: run.expiresAt, rules, challenge: run.challenge };
    activeMapId = run.challenge.mapId;
    activeProfile = rankedProfile(orientation);
    activeDifficulty = rules.difficulty;
    activeTwoEndLanding = false;
    utilityScreen.hidden = true;
    for (const panel of [elements.startPanel, elements.pausePanel, elements.gameoverPanel]) panel.inert = false;
    history.replaceState(null, '', location.pathname + location.search);
    elements.restartButton.querySelector<HTMLElement>('.button-label')!.textContent = 'Play ranked again';
    elements.chooseMapButton.querySelector<HTMLElement>('.button-label')!.textContent = 'Main menu';
    rebuildForTarget(activeProfile, activeMapId, true);
  } catch (error) {
    const message = competitionErrorCopy(error);
    if (!elements.gameoverPanel.hidden) {
      elements.careerResult.textContent = message;
      elements.restartButton.disabled = false;
    } else {
      challengeViewState = { status: 'error', message };
      updateChallengeView();
    }
  }
}

async function handleRankedGameOver(reason: GameOverReason, score: number, session: RankedSession): Promise<void> {
  const collision = reason === 'collision';
  elements.gameoverCode.textContent = collision ? 'Aircraft collided' : 'Aircraft left the sector';
  elements.gameoverCopy.textContent = collision
    ? 'Two aircraft made contact. Keep their airframes clear of each other.'
    : 'An aircraft crossed the edge before reaching its landing zone.';
  elements.finalScore.textContent = formatScore(score);
  elements.finalBest.textContent = '—';
  document.querySelector('#result-best-label')!.textContent = 'Ranked best';
  document.querySelector<HTMLElement>('#record-message')!.hidden = true;
  document.querySelector('#result-difficulty')!.textContent =
    `${mapDefinitionById(session.challenge.mapId).metadata.name} · ${DIFFICULTY_LABELS[session.rules.difficulty]} · ${session.rules.orientation} division`;
  document.querySelector<HTMLElement>('#achievement-result')!.hidden = true;
  resetCareerResult(elements.careerResult, 'Verifying ranked shift…');
  elements.pauseButton.disabled = true;
  elements.restartButton.disabled = true;
  elements.chooseMapButton.disabled = true;
  showOnly(elements.gameoverPanel);

  const verify = async (): Promise<void> => {
    resetCareerResult(elements.careerResult, 'Verifying ranked shift…');
    try {
      const result = await submitChallenge({ runId: session.runId, commands: session.commands ?? [] });
      elements.finalScore.textContent = formatScore(result.score);
      elements.finalBest.textContent = result.personalBest === null ? '—' : formatScore(result.personalBest);
      document.querySelector<HTMLElement>('#record-message')!.hidden = !result.improved;
      elements.careerResult.textContent = result.rank
        ? `Verified · Global rank ${result.rank}${result.personalBest === null ? '' : ` · ${result.personalBest} best landings`}`
        : `Verified · Score accepted · Standings temporarily unavailable`;
      if (result.feedbackRequested) renderFairnessSurvey(elements.careerResult, session.challenge.id);
      announce(result.rank
        ? `Ranked shift verified. Global rank ${result.rank}.`
        : 'Ranked shift verified. Standings are temporarily unavailable.');
    } catch (error) {
      elements.careerResult.textContent = competitionErrorCopy(error);
      if (!(error instanceof CompetitionError) || error.transient) {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'secondary-button ranked-retry';
        retry.textContent = 'Retry verification';
        retry.addEventListener('click', () => void verify(), { once: true });
        elements.careerResult.append(retry);
      }
    } finally {
      elements.restartButton.disabled = false;
      elements.chooseMapButton.disabled = false;
    }
  };
  await verify();
}

function renderFairnessSurvey(container: HTMLElement, challengeId: string): void {
  const form = document.createElement('form');
  form.className = 'fairness-survey';
  form.innerHTML = `
    <p class="fairness-heading">Optional fairness check</p>
    <fieldset><legend>The weekly challenge felt fair.</legend>
      <label><input type="radio" name="fairness" value="agree" required> Agree</label>
      <label><input type="radio" name="fairness" value="unsure"> Not sure</label>
      <label><input type="radio" name="fairness" value="disagree"> Disagree</label>
    </fieldset>
    <fieldset><legend>What most affected fairness?</legend>
      <label><input type="radio" name="factor" value="same-rules" required> Same rules</label>
      <label><input type="radio" name="factor" value="device-controls"> Device or controls</label>
      <label><input type="radio" name="factor" value="pausing"> Pausing</label>
      <label><input type="radio" name="factor" value="suspicious-scores"> Suspicious scores</label>
      <label><input type="radio" name="factor" value="connection-verification"> Connection or verification</label>
    </fieldset>
    <button type="submit" class="secondary-button">Send feedback</button>
    <p class="fairness-status" role="status" aria-live="polite"></p>`;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector<HTMLButtonElement>('button')!;
    const status = form.querySelector<HTMLElement>('.fairness-status')!;
    const data = new FormData(form);
    button.disabled = true;
    status.textContent = 'Sending…';
    try {
      await submitChallengeFeedback({
        challengeId,
        fairness: data.get('fairness') as FairnessAnswer,
        factor: data.get('factor') as FairnessFactor,
      });
      form.replaceChildren(Object.assign(document.createElement('p'), { textContent: 'Thanks — feedback recorded.' }));
    } catch (error) {
      status.textContent = competitionErrorCopy(error);
      button.disabled = false;
    }
  });
  container.append(form);
}

async function handleGameOver({
  reason,
  score,
  runId,
  evidence,
  commands,
}: {
  reason: GameOverReason;
  score: number;
  runId?: string;
  evidence?: ShiftEvidence;
  commands?: readonly RouteCommand[];
}): Promise<void> {
  if (runId && (runId !== activeRunId || finishingRunId === runId)) return;
  finishingRunId = runId ?? crypto.randomUUID();
  const completedRunId = finishingRunId;
  if (rankedSession) {
    rankedSession.commands = commands ?? playScene()?.getRouteCommands() ?? [];
    await handleRankedGameOver(reason, score, rankedSession);
    return;
  }
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
  document.querySelector('#result-difficulty')!.textContent =
    `${mapDefinitionById(activeMapId).metadata.name} · ${DIFFICULTY_LABELS[activeDifficulty]} · Started in ${activeProfile.id} · ${landingModeLabel()}`;
  document.querySelector<HTMLElement>('#achievement-result')!.hidden = true;
  elements.finalScore.textContent = formatScore(score);
  resetCareerResult(elements.careerResult, "Recording shift…");
  elements.pauseButton.disabled = true;
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
      const reward = document.createElement('p');
      reward.className = 'career-result-note';
      reward.textContent = `${liveries.map(livery => livery.name).join(' and ')} livery unlocked. Choose it in Your career.`;
      elements.careerResult.append(reward);
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
    elements.careerResult.textContent = rankProgressCopy();
  }
  if (!result.persisted) {
    const note = document.createElement("span");
    note.className = "career-result-note";
    note.textContent = " Progress is available this session only; saving on this device failed.";
    elements.careerResult.append(note);
  }
  elements.restartButton.disabled = false;
  elements.chooseMapButton.disabled = false;
}

async function toggleAudio(): Promise<void> {
  await audio.unlock();
  const enabled = !currentSave.settings.audio.enabled;
  currentSave = await updateAudioSettings({ enabled });
  syncAudioControls();
  if (enabled) audio.handle({ type: "ui-confirm", action: "resume" });
}

function setLocalVolume(volume: number): void {
  const normalized = Math.min(1, Math.max(0, volume));
  currentSave = {
    ...currentSave,
    settings: {
      ...currentSave.settings,
      audio: { ...currentSave.settings.audio, volume: normalized },
    },
  };
  syncAudioControls();
  window.clearTimeout(volumeSaveTimer);
  volumeSaveTimer = window.setTimeout(async () => {
    currentSave = await updateAudioSettings({ volume: normalized });
    syncAudioControls();
  }, 140);
}

document.querySelectorAll<HTMLInputElement>('input[name="difficulty"]').forEach(input => input.addEventListener('change', async () => {
  if (!input.checked || !isDifficulty(input.value)) return;
  currentSave = await gameStore.selectDifficulty(input.value);
  activeDifficulty = currentSave.selectedDifficulty;
  renderShell();
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
  } finally {
    savingLandingMode = false;
  }
  rebuildForTarget(profileForViewport(), activeMapId, false);
});
elements.startButton.addEventListener("click", () => void startRun());
elements.restartButton.addEventListener("click", () => void startRun());
elements.restartFromPause.addEventListener("click", () =>
  confirmAbandon(
    "Restart this shift?",
    "Your unfinished shift, including achievement progress, will not be saved.",
    () => void startRun(),
  ),
);
elements.resumeButton.addEventListener("click", () => void resumeRun());
elements.chooseMapButton.addEventListener("click", () => {
  if (rankedSession) leaveRankedMode(true);
  renderShell();
  showOnly(elements.startPanel);
});
elements.pauseButton.addEventListener("click", () => {
  if (playScene()?.getPhase() === "paused") void resumeRun();
  else pauseRun();
});
elements.audioToggles.forEach((button) =>
  button.addEventListener("click", () => void toggleAudio()),
);
elements.volumeInputs.forEach((input) => {
  input.addEventListener("input", () =>
    setLocalVolume(Number(input.value) / 100),
  );
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
    const significant = shouldPauseForResize(acceptedViewport, availableViewport(), game.scale.gameSize);
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
    updateResizeNotice();
  }, 160);
});

window.addEventListener("pagehide", () => void audio.destroy(), { once: true });

const utilityScreen = document.querySelector<HTMLElement>("#utility-screen")!;
const resetPractice = mountPractice(() => currentSave.settings.twoEndLanding);
let utilityReturnPanel: HTMLElement = elements.startPanel;
let utilityReturnFocus: HTMLElement | null = null;
const utilityNames = ["settings", "career", "challenge", "help", "practice", "airfields"] as const;
type UtilityName = typeof utilityNames[number];
function isUtilityName(value: string): value is UtilityName {
  return utilityNames.some(name => name === value) && (value !== 'challenge' || COMPETITION_ENABLED);
}
const confirmDialog =
  document.querySelector<HTMLDialogElement>("#confirm-dialog")!;
let pendingAction: (() => void) | undefined;
let messageTimer = 0;

function showFlightMessage(message: string): void {
  const output = document.querySelector<HTMLElement>("#flight-message")!;
  output.textContent = message;
  output.hidden = false;
  window.clearTimeout(messageTimer);
  messageTimer = window.setTimeout(() => {
    output.hidden = true;
  }, 2800);
}

function renderFieldDetail(): void {
  const definition = mapDefinitionById(activeMapId);
  const preview = document.querySelector<HTMLImageElement>('#home-map-preview')!;
  const previewUrl = previews.get(activeMapId);
  if (previewUrl) preview.src = previewUrl;
  else preview.removeAttribute('src');
  const unlocked = isMapUnlocked(activeMapId, currentSave.career.earnedRankId);
  document.querySelector("#field-title")!.textContent =
    definition.metadata.name;
  document.querySelector("#field-difficulty")!.textContent =
    definition.metadata.layoutLabel;
  document.querySelector("#field-description")!.textContent =
    definition.metadata.description;
  document.querySelector("#field-record")!.textContent =
    `Best · ${formatScore(mapBest(activeMapId))} landings`;
  document.querySelectorAll<HTMLInputElement>('input[name="difficulty"]').forEach(input => { input.checked = input.value === currentSave.selectedDifficulty; });
  document.querySelector<HTMLFieldSetElement>('#difficulty-options')!.disabled = !unlocked;
  landingModeInput.checked = currentSave.settings.twoEndLanding;
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
  const wrongRankedOrientation = rankedSession !== undefined && profileForViewport().id !== rankedSession.rules.orientation;
  const message = wrongRankedOrientation
    ? `Return to ${rankedSession!.rules.orientation} orientation to continue this ranked shift.`
    : !playable
    ? "The airfield is too small to play comfortably. Enlarge the window or rotate your device to continue this shift."
    : resizeSettling
      ? "Adjusting to the screen size. Your shift is paused."
      : resizedWhilePaused
        ? "Screen size changed. Your shift is paused and ready to continue."
        : "";
  notice.hidden = !message;
  if (notice.textContent !== message) notice.textContent = message;
  elements.resumeButton.disabled = resizeSettling || !playable || wrongRankedOrientation;
  elements.resumeLabel.textContent = "Resume";
  elements.restartFromPause.hidden = false;
}

function confirmAbandon(title: string, copy: string, action: () => void): void {
  pendingAction = action;
  document.querySelector("#confirm-title")!.textContent = title;
  document.querySelector("#confirm-copy")!.textContent = copy;
  document.querySelector("#confirm-accept")!.textContent = title.startsWith(
    "Restart",
  )
    ? "Restart shift"
    : title.startsWith("Start")
      ? "Start new shift"
      : "Main menu";
  confirmDialog.showModal();
}

document
  .querySelector("#confirm-cancel")!
  .addEventListener("click", () => confirmDialog.close());
document.querySelector("#confirm-accept")!.addEventListener("click", () => {
  const action = pendingAction;
  confirmDialog.close();
  action?.();
});
confirmDialog.addEventListener("close", () => {
  pendingAction = undefined;
});
document.querySelector("#pause-map")!.addEventListener("click", () =>
  confirmAbandon(
    "Leave this shift?",
    "This unfinished shift will not count toward your career, records, or achievements.",
    () => {
      if (rankedSession) leaveRankedMode(false);
      rebuildForTarget(profileForViewport(), currentSave.selectedMapId, false);
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
  title.textContent = { help: "How to play", career: "Your career", challenge: "Tower Challenge", settings: "Settings", practice: "Practice flight", airfields: "Choose airfield" }[screen];
  if (screen === "career") renderCareerDetail();
  if (screen === 'challenge') void refreshChallenge();
  if (screen === 'airfields') { renderMapOptions(); document.querySelector('#airfield-selection-status')!.textContent = `${DIFFICULTY_LABELS[currentSave.selectedDifficulty]} difficulty · Choose an available airfield to return to Play.`; }
  document.querySelector<HTMLElement>("#utility-support")!.hidden = screen === "airfields";
  utilityScreen.dataset.page = screen;
  utilityScreen.hidden = false;
  utilityScreen.scrollTop = 0;
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
document.querySelectorAll<HTMLButtonElement>("[data-screen]").forEach(button =>
  button.addEventListener("click", () => openUtility(button.dataset.screen!))
);
document.querySelector("#utility-close")!.addEventListener("click", () => history.back());

for (const [id, label] of Object.entries({ all: 'All airfields', ...AIRPORT_CATEGORIES })) {
  const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
  button.setAttribute('aria-pressed', String(id === categoryFilter));
  button.addEventListener('click', () => {
    categoryFilter = id;
    document.querySelectorAll('#category-filters button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    renderMapOptions();
  });
  document.querySelector('#category-filters')!.append(button);
}
renderShell();
const challengeButton = document.querySelector<HTMLButtonElement>('[data-screen="challenge"]')!;
challengeButton.hidden = !COMPETITION_ENABLED;
showOnly(elements.startPanel);
const initialUtility = location.hash.slice(1);
if (isUtilityName(initialUtility)) {
  // Establish an in-app Back destination when entering a shared/reloaded screen URL.
  history.replaceState(null, "", location.pathname + location.search);
  openUtility(initialUtility);
}
const disposePreviews = createMapPreviews((id, url) => {
  previews.set(id, url);
  if (id === activeMapId) document.querySelector<HTMLImageElement>("#home-map-preview")!.src = url;
  const careerImage = document.querySelector<HTMLImageElement>(`[data-career-map="${id}"]`);
  if (careerImage) careerImage.src = url;
  const card = elements.mapOptions.querySelector<HTMLElement>(
    `[data-map-id="${id}"]`,
  );
  card?.style.setProperty("--map-preview", `url("${url}")`);
});
window.addEventListener("pagehide", disposePreviews, { once: true });
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
elements.mapOptions.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const choices = [
    ...elements.mapOptions.querySelectorAll<HTMLButtonElement>("button"),
  ];
  const current = choices.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? choices.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + choices.length) %
          choices.length;
  choices[next]?.focus();
});

/** Read-only development seam; never exposes the live game or simulation. */
export function inspectShift() {
  if (!import.meta.env.DEV) throw new Error("Shift inspection is development-only");
  return { ...playScene()?.getShiftSnapshot(), orientation: activeProfile.id,
    world: { width: game.scale.gameSize.width, height: game.scale.gameSize.height } };
}

import Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';
import type { FeedbackEvent } from './app/feedbackEvents';
import { GameAudio, WebAudioBackend } from './audio';
import type { GameOverReason, SimulationSnapshot } from './core/types';
import { DEFAULT_MAP_ID, type MapId } from './game/maps/mapIds';
import { MAP_DEFINITIONS, mapDefinitionById } from './game/maps/registry';
import { PlayScene } from './game/scenes/PlayScene';
import { GAME_FONT_LOAD_DESCRIPTORS } from './game/typography';
import {
  isSameProfile,
  profileForViewport,
  type ViewportProfile
} from './game/viewport';
import {
  RANK_CATALOG,
  isMapUnlocked,
  rankDefinition,
  rankIndex
} from './progression/ranks';
import {
  acknowledgeEarnedRank,
  loadCareerSave,
  saveCompletedShift,
  setSelectedMap,
  updateAudioSettings,
  type GameSaveV2
} from './storage/gameStore';
import { mountHugeIcon } from './ui/hugeicons';
import './styles.css';

const ROUTE_COACH_SESSION_KEY = 'vector-approach:route-coach-complete';

function routeCoachWasCompleted(): boolean {
  try {
    return window.sessionStorage.getItem(ROUTE_COACH_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberRouteCoachCompletion(): void {
  try {
    window.sessionStorage.setItem(ROUTE_COACH_SESSION_KEY, '1');
  } catch {
    // Memory-only state still prevents repetition during the current run.
  }
}

const elements = {
  gameCanvas: document.querySelector<HTMLElement>('#game')!,
  hud: document.querySelector<HTMLElement>('.hud')!,
  scoreTile: document.querySelector<HTMLElement>('.hud-score')!,
  score: document.querySelector<HTMLElement>('#score')!,
  best: document.querySelector<HTMLElement>('#best')!,
  routeCoachmark: document.querySelector<HTMLElement>('#route-coachmark')!,
  routeCoachmarkCopy: document.querySelector<HTMLElement>('#route-coachmark-copy')!,
  startPanel: document.querySelector<HTMLElement>('#start-panel')!,
  pausePanel: document.querySelector<HTMLElement>('#pause-panel')!,
  gameoverPanel: document.querySelector<HTMLElement>('#gameover-panel')!,
  mapOptions: document.querySelector<HTMLElement>('#map-options')!,
  currentRank: document.querySelector<HTMLElement>('#current-rank')!,
  rankProgress: document.querySelector<HTMLElement>('#rank-progress')!,
  selectedMapName: document.querySelector<HTMLElement>('#selected-map-name')!,
  careerResult: document.querySelector<HTMLElement>('#career-result')!,
  pauseButton: document.querySelector<HTMLButtonElement>('#pause-button')!,
  pauseIcon: document.querySelector<HTMLElement>('#pause-icon')!,
  startButton: document.querySelector<HTMLButtonElement>('#start-button')!,
  startIcon: document.querySelector<HTMLElement>('#start-icon')!,
  resumeButton: document.querySelector<HTMLButtonElement>('#resume-button')!,
  resumeIcon: document.querySelector<HTMLElement>('#resume-icon')!,
  resumeLabel: document.querySelector<HTMLElement>('#resume-label')!,
  restartButton: document.querySelector<HTMLButtonElement>('#restart-button')!,
  restartIcon: document.querySelector<HTMLElement>('#restart-icon')!,
  restartFromPause: document.querySelector<HTMLButtonElement>('#restart-from-pause')!,
  restartFromPauseIcon: document.querySelector<HTMLElement>('#restart-from-pause-icon')!,
  chooseMapButton: document.querySelector<HTMLButtonElement>('#choose-map-button')!,
  chooseMapIcon: document.querySelector<HTMLElement>('#choose-map-icon')!,
  finalScore: document.querySelector<HTMLElement>('#final-score')!,
  finalBest: document.querySelector<HTMLElement>('#final-best')!,
  gameoverCode: document.querySelector<HTMLElement>('#gameover-code')!,
  gameoverCopy: document.querySelector<HTMLElement>('#gameover-copy')!,
  routeStatus: document.querySelector<HTMLElement>('#route-status')!,
  audioToggles: [...document.querySelectorAll<HTMLButtonElement>('[data-audio-toggle]')],
  audioIcons: [...document.querySelectorAll<HTMLElement>('[data-audio-icon]')],
  volumeInputs: [...document.querySelectorAll<HTMLInputElement>('[data-audio-volume]')]
};

mountHugeIcon(elements.pauseIcon, 'pause', 22);
mountHugeIcon(elements.startIcon, 'play', 18);
mountHugeIcon(elements.resumeIcon, 'play', 18);
mountHugeIcon(elements.restartFromPauseIcon, 'restart', 18);
mountHugeIcon(elements.restartIcon, 'restart', 18);
mountHugeIcon(elements.chooseMapIcon, 'map', 18);
elements.startButton.disabled = true;

async function loadGameFonts(timeoutMilliseconds = 1_600): Promise<void> {
  if (!document.fonts) return;
  let timeoutId = 0;
  const timeout = new Promise<void>((resolve) => {
    timeoutId = window.setTimeout(resolve, timeoutMilliseconds);
  });
  try {
    await Promise.race([
      Promise.all(GAME_FONT_LOAD_DESCRIPTORS.map((descriptor) => document.fonts.load(descriptor))),
      timeout
    ]);
  } catch {
    // The bundled fallbacks keep the game usable if local font loading fails.
  } finally {
    window.clearTimeout(timeoutId);
  }
}

await loadGameFonts();
let currentSave: GameSaveV2 = await loadCareerSave();
if (!isMapUnlocked(currentSave.selectedMapId, currentSave.career.earnedRankId)) {
  currentSave = await setSelectedMap(DEFAULT_MAP_ID);
}

const audio = new GameAudio(new WebAudioBackend(), currentSave.settings.audio);
await audio.prepare();

let activeProfile = profileForViewport();
let activeMapId: MapId = currentSave.selectedMapId;
let sceneReady = false;
let startAfterRebuild = false;
let resizeTimer = 0;
let volumeSaveTimer = 0;
let promotionAudioTimer = 0;
let focusBeforePanel: HTMLElement | null = null;
let routeCoachCompleted = routeCoachWasCompleted();
let routeCoachTimer = 0;
let scorePulseTimer = 0;

elements.gameCanvas.inert = true;
elements.hud.inert = true;

function createGame(profile: ViewportProfile, mapId: MapId): Phaser.Game {
  const nextGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: profile.width,
    height: profile.height,
    backgroundColor: '#263f3c',
    render: { antialias: true, roundPixels: false },
    scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
    scene: [new PlayScene(mapDefinitionById(mapId))]
  });

  nextGame.events.on('scene-ready', () => {
    sceneReady = true;
    elements.startButton.disabled = false;
    if (startAfterRebuild) {
      startAfterRebuild = false;
      requestAnimationFrame(beginRun);
    } else if (!elements.startPanel.hidden) {
      elements.startButton.focus({ preventScroll: true });
    }
  });
  nextGame.events.on('hud-update', (snapshot: SimulationSnapshot) => {
    elements.score.textContent = formatScore(snapshot.score);
  });
  nextGame.events.on('feedback', (event: FeedbackEvent) => audio.handle(event));
  nextGame.events.on('landing', (score: number) => {
    elements.score.textContent = formatScore(score);
    announce(`Aircraft landed. Score ${score}.`);
    window.clearTimeout(scorePulseTimer);
    elements.scoreTile.classList.remove('is-scoring');
    requestAnimationFrame(() => {
      elements.scoreTile.classList.add('is-scoring');
      scorePulseTimer = window.setTimeout(() => elements.scoreTile.classList.remove('is-scoring'), 540);
    });
  });
  nextGame.events.on('route-coach', (stage: 'selected' | 'locked' | 'set') => {
    if (routeCoachCompleted) return;
    window.clearTimeout(routeCoachTimer);
    elements.routeCoachmarkCopy.textContent = stage === 'selected'
      ? 'Draw this aircraft to the highlighted landing area.'
      : stage === 'locked'
        ? 'Landing area acquired — release to set the route.'
        : 'Route set. The aircraft will follow your line.';
    elements.routeCoachmark.hidden = false;
    if (stage === 'set') {
      routeCoachCompleted = true;
      rememberRouteCoachCompletion();
      routeCoachTimer = window.setTimeout(hideRouteCoachmark, 2_200);
    }
  });
  nextGame.events.on('run-state', (state: string) => {
    if (state !== 'running') hideRouteCoachmark();
  });
  nextGame.events.on('game-over', handleGameOver);
  nextGame.events.on('route-status', announce);
  return nextGame;
}

let game = createGame(activeProfile, activeMapId);

function playScene(): PlayScene | undefined {
  if (!sceneReady) return undefined;
  return game.scene.getScene('play') as PlayScene;
}

function showOnly(panel?: HTMLElement): void {
  const panels = [elements.startPanel, elements.pausePanel, elements.gameoverPanel];
  const hadVisiblePanel = panels.some((candidate) => !candidate.hidden);
  if (panel && !hadVisiblePanel && document.activeElement instanceof HTMLElement) {
    focusBeforePanel = document.activeElement;
  }
  panels.forEach((candidate) => {
    candidate.hidden = panel !== candidate;
  });
  const modalOpen = panel !== undefined;
  elements.gameCanvas.inert = modalOpen;
  elements.hud.inert = modalOpen;
  requestAnimationFrame(() => {
    if (panel) {
      panel.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
      return;
    }
    const previous = focusBeforePanel;
    focusBeforePanel = null;
    if (previous?.isConnected && !previous.closest('[hidden]') && !previous.matches(':disabled')) {
      previous.focus({ preventScroll: true });
    } else if (!elements.pauseButton.disabled) {
      elements.pauseButton.focus({ preventScroll: true });
    }
  });
}

function formatScore(value: number): string {
  return Math.max(0, value).toString().padStart(2, '0');
}

function announce(message: string): void {
  elements.routeStatus.textContent = '';
  requestAnimationFrame(() => {
    elements.routeStatus.textContent = message;
  });
}

function hideRouteCoachmark(): void {
  window.clearTimeout(routeCoachTimer);
  elements.routeCoachmark.hidden = true;
}

function activeRecord() {
  return currentSave.mapRecords[activeMapId];
}

function updateBestDisplays(): void {
  const best = formatScore(activeRecord().bestScores[activeProfile.id]);
  elements.best.textContent = best;
  elements.finalBest.textContent = best;
  elements.selectedMapName.textContent = mapDefinitionById(activeMapId).metadata.name;
}

function rankProgressCopy(): string {
  const currentIndex = rankIndex(currentSave.career.earnedRankId);
  const next = RANK_CATALOG[currentIndex + 1];
  if (!next) return 'Highest clearance earned.';
  const requirements = next.requirements;
  const mapLabel = requirements.minimumDistinctMaps === 1 ? 'map' : 'maps';
  return `${currentSave.career.totalSafeLandings}/${requirements.minimumSafeLandings} safe landings · ${currentSave.career.shiftsPlayed}/${requirements.minimumShifts} shifts · best ${requirements.qualifyingBestScore}+ on ${requirements.minimumDistinctMaps} ${mapLabel}`;
}

function renderCareer(): void {
  elements.currentRank.textContent = rankDefinition(currentSave.career.earnedRankId).name;
  elements.rankProgress.textContent = rankProgressCopy();
}

function mapBest(mapId: MapId): number {
  const scores = currentSave.mapRecords[mapId].bestScores;
  return Math.max(scores.portrait, scores.landscape);
}

function renderMapOptions(): void {
  const buttons = MAP_DEFINITIONS.map((definition) => {
    const unlocked = isMapUnlocked(definition.id, currentSave.career.earnedRankId);
    const selected = definition.id === activeMapId;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'map-option';
    button.dataset.mapId = definition.id;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(selected));
    button.setAttribute('aria-disabled', String(!unlocked));
    if (selected) button.classList.add('is-selected');
    if (!unlocked) button.classList.add('is-locked');
    const title = document.createElement('strong');
    title.textContent = definition.metadata.name;
    const detail = document.createElement('span');
    detail.textContent = unlocked
      ? `${definition.metadata.difficulty} · best ${formatScore(mapBest(definition.id))}`
      : `Unlock at ${rankDefinition(definition.metadata.unlockRankId).name}`;
    const copy = document.createElement('small');
    copy.textContent = definition.metadata.description;
    button.append(title, detail, copy);
    button.addEventListener('click', () => {
      if (!unlocked) {
        announce(`${definition.metadata.name} unlocks at ${rankDefinition(definition.metadata.unlockRankId).name}.`);
        return;
      }
      void selectMap(definition.id);
    });
    return button;
  });
  elements.mapOptions.replaceChildren(...buttons);
}

function syncAudioControls(): void {
  const settings = currentSave.settings.audio;
  audio.setSettings(settings);
  elements.audioToggles.forEach((button) => {
    button.setAttribute('aria-pressed', String(settings.enabled));
    button.setAttribute('aria-label', 'Sound effects');
    button.querySelector<HTMLElement>('[data-audio-label]')!.textContent = settings.enabled ? 'Sound on' : 'Sound off';
  });
  elements.audioIcons.forEach((icon) => {
    mountHugeIcon(icon, settings.enabled ? 'volume' : 'mute', 19);
  });
  elements.volumeInputs.forEach((input) => {
    input.value = String(Math.round(settings.volume * 100));
    input.setAttribute('aria-valuetext', `${Math.round(settings.volume * 100)} percent`);
  });
}

function renderShell(): void {
  renderCareer();
  renderMapOptions();
  updateBestDisplays();
  syncAudioControls();
}

function beginRun(): void {
  const scene = playScene();
  if (!scene) return;
  window.clearTimeout(promotionAudioTimer);
  scene.startRun();
  audio.handle({ type: 'ui-confirm', action: 'play' });
  elements.pauseButton.disabled = false;
  showOnly();
  elements.pauseButton.setAttribute('aria-label', 'Pause game');
  mountHugeIcon(elements.pauseIcon, 'pause', 22);
  elements.resumeLabel.textContent = 'Resume';
  elements.score.textContent = '00';
  hideRouteCoachmark();
}

function rebuildForTarget(profile: ViewportProfile, mapId: MapId, beginWhenReady: boolean): void {
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
  if (mapId === activeMapId) return;
  await audio.unlock();
  currentSave = await setSelectedMap(mapId);
  audio.handle({ type: 'ui-confirm', action: 'map-select' });
  rebuildForTarget(activeProfile, mapId, false);
}

async function startRun(): Promise<void> {
  await audio.unlock();
  const requestedProfile = profileForViewport();
  if (!isSameProfile(requestedProfile, activeProfile)) {
    rebuildForTarget(requestedProfile, activeMapId, true);
    return;
  }
  beginRun();
}

function pauseRun(): void {
  const scene = playScene();
  if (!scene || scene.getPhase() !== 'running') return;
  scene.pauseRun();
  showOnly(elements.pausePanel);
  elements.pauseButton.setAttribute('aria-label', 'Resume game');
  mountHugeIcon(elements.pauseIcon, 'play', 22);
}

async function resumeRun(): Promise<void> {
  await audio.unlock();
  const requestedProfile = profileForViewport();
  if (!isSameProfile(requestedProfile, activeProfile)) {
    rebuildForTarget(requestedProfile, activeMapId, true);
    return;
  }
  const scene = playScene();
  if (!scene || scene.getPhase() !== 'paused') return;
  scene.resumeRun();
  audio.handle({ type: 'ui-confirm', action: 'resume' });
  showOnly();
  elements.pauseButton.setAttribute('aria-label', 'Pause game');
  mountHugeIcon(elements.pauseIcon, 'pause', 22);
}

async function handleGameOver({ reason, score }: { reason: GameOverReason; score: number }): Promise<void> {
  const copy = reason === 'airspace'
    ? ['Aircraft left the sector', 'An aircraft crossed the edge before reaching its landing zone.']
    : ['Aircraft collided', 'Two aircraft crossed inside the protected separation distance.'];
  elements.gameoverCode.textContent = copy[0];
  elements.gameoverCopy.textContent = copy[1];
  elements.finalScore.textContent = formatScore(score);
  elements.careerResult.textContent = 'Recording shift…';
  elements.careerResult.classList.remove('is-promotion');
  elements.pauseButton.disabled = true;
  elements.restartButton.disabled = true;
  elements.chooseMapButton.disabled = true;
  showOnly(elements.gameoverPanel);
  const result = await saveCompletedShift({
    mapId: activeMapId,
    orientation: activeProfile.id,
    score,
    safeLandings: score
  });
  currentSave = result.save;
  renderShell();
  if (result.promoted) {
    const earned = rankDefinition(result.earnedRankId);
    elements.careerResult.textContent = `Promoted — ${earned.name}`;
    elements.careerResult.classList.add('is-promotion');
    announce(`Promoted to ${earned.name}.`);
    promotionAudioTimer = window.setTimeout(() => {
      audio.handle({ type: 'promotion', previousRankId: result.previousRankId, rankId: result.earnedRankId });
    }, reason === 'collision' ? 940 : 0);
    currentSave = await acknowledgeEarnedRank();
  } else {
    elements.careerResult.textContent = rankProgressCopy();
  }
  elements.restartButton.disabled = false;
  elements.chooseMapButton.disabled = false;
}

async function toggleAudio(): Promise<void> {
  await audio.unlock();
  const enabled = !currentSave.settings.audio.enabled;
  currentSave = await updateAudioSettings({ enabled });
  syncAudioControls();
  if (enabled) audio.handle({ type: 'ui-confirm', action: 'resume' });
}

function setLocalVolume(volume: number): void {
  const normalized = Math.min(1, Math.max(0, volume));
  currentSave = {
    ...currentSave,
    settings: {
      ...currentSave.settings,
      audio: { ...currentSave.settings.audio, volume: normalized }
    }
  };
  syncAudioControls();
  window.clearTimeout(volumeSaveTimer);
  volumeSaveTimer = window.setTimeout(async () => {
    currentSave = await updateAudioSettings({ volume: normalized });
    syncAudioControls();
  }, 140);
}

elements.startButton.addEventListener('click', () => void startRun());
elements.restartButton.addEventListener('click', () => void startRun());
elements.restartFromPause.addEventListener('click', () => void startRun());
elements.resumeButton.addEventListener('click', () => void resumeRun());
elements.chooseMapButton.addEventListener('click', () => {
  renderShell();
  showOnly(elements.startPanel);
});
elements.pauseButton.addEventListener('click', () => {
  if (playScene()?.getPhase() === 'paused') void resumeRun();
  else pauseRun();
});
elements.audioToggles.forEach((button) => button.addEventListener('click', () => void toggleAudio()));
elements.volumeInputs.forEach((input) => {
  input.addEventListener('input', () => setLocalVolume(Number(input.value) / 100));
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (playScene()?.getPhase() === 'paused') void resumeRun();
  else pauseRun();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseRun();
    void audio.suspend();
  }
});

window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const nextProfile = profileForViewport();
    const profileChanged = !isSameProfile(nextProfile, activeProfile);
    elements.resumeLabel.textContent = profileChanged
      ? nextProfile.id !== activeProfile.id
        ? `Start in ${nextProfile.id}`
        : `Restart for ${nextProfile.detailLevel} detail`
      : 'Resume';
    if (profileChanged) pauseRun();
  }, 160);
});

window.addEventListener('pagehide', () => void audio.destroy(), { once: true });

renderShell();
registerSW({ immediate: true });

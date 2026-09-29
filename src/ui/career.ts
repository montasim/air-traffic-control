import { DIFFICULTIES, DIFFICULTY_LABELS, type DifficultyId } from '../core/difficulty';
import { ACHIEVEMENTS } from '../progression/achievements';
import { MAP_DEFINITIONS } from '../game/maps/registry';
import type { MapId } from '../game/maps/mapIds';
import { RANK_CATALOG, rankDefinition, rankIndex, isMapUnlocked } from '../progression/ranks';
import type { GameSaveV3 } from '../storage/gameSave';
import { mountHugeIcon, type AppIconName } from './hugeicons';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function renderCareer(container: HTMLElement, save: GameSaveV3, previews: ReadonlyMap<MapId, string>, difficulty: DifficultyId = save.selectedDifficulty): void {
  const current = rankDefinition(save.career.earnedRankId);
  const level = rankIndex(current.id);
  const next = RANK_CATALOG[level + 1];
  const best = (id: MapId) => Math.max(...Object.values(save.mapRecords[id].bestScores));
  const overview = node('div', 'career-overview');
  const identity = node('section', 'controller-card');
  identity.setAttribute('aria-label', 'Current clearance');
  const badge = node('div', 'controller-badge');
  badge.setAttribute('aria-hidden', 'true');
  mountHugeIcon(badge, 'career', 48);
  identity.append(badge, node('p', 'career-eyebrow', 'Current clearance'), node('h3', '', current.name), node('p', 'clearance-level', `Clearance ${level + 1} of ${RANK_CATALOG.length}`));
  const totals = node('dl', 'career-totals');
  for (const [label, value] of [['Safe landings', save.career.totalSafeLandings], ['Shifts completed', save.career.shiftsPlayed]] as const) {
    const item = node('div', '');
    item.append(node('dt', '', label), node('dd', '', String(value).padStart(2, '0')));
    totals.append(item);
  }
  identity.append(totals);
  const promotion = node('section', 'promotion-card');
  promotion.append(node('p', 'career-eyebrow', next ? 'Your next clearance' : 'Career complete'), node('h3', '', next?.name ?? 'Chief of the airspace'));
  if (next) {
    const r = next.requirements;
    const requirements: [string, number, number][] = [
      ['Safe landings', save.career.totalSafeLandings, r.minimumSafeLandings],
      ['Completed shifts', save.career.shiftsPlayed, r.minimumShifts],
      [`Airfields with a best of ${r.qualifyingBestScore}+`, MAP_DEFINITIONS.filter(map => best(map.id) >= r.qualifyingBestScore).length, r.minimumDistinctMaps],
    ];
    promotion.append(node('p', 'promotion-caption', 'Complete all three objectives to earn your promotion.'));
    const objectives = node('div', 'promotion-objectives');
    for (const [label, value, goal] of requirements) {
      const complete = value >= goal;
      const objective = node('div', `promotion-objective${complete ? ' is-complete' : ''}`);
      const labelRow = node('div', 'objective-label');
      labelRow.append(node('span', '', label), node('strong', '', complete ? 'Complete' : `${value} / ${goal}`));
      const progress = node('progress', '');
      progress.max = goal;
      progress.value = Math.min(value, goal);
      progress.setAttribute('aria-label', label);
      progress.setAttribute('aria-valuetext', `${Math.min(value, goal)} of ${goal}${complete ? ', complete' : ''}`);
      objective.append(labelRow, progress);
      objectives.append(objective);
    }
    promotion.append(objectives);
    const reward = next.unlocks.map(id => MAP_DEFINITIONS.find(map => map.id === id)!.metadata.name);
    promotion.append(node('p', 'promotion-reward', reward.length ? `Unlocks ${reward.join(' and ')}` : 'Earn your next controller badge'));
  } else {
    promotion.append(node('p', 'promotion-caption', 'Every clearance earned. Every airfield unlocked. Keep building your record with each safe landing.'), node('p', 'promotion-reward', `All ${MAP_DEFINITIONS.length} airfields are yours`));
  }
  overview.append(identity, promotion);

  const airfields = node('section', 'career-airfields');
  airfields.append(node('h3', 'career-section-title', 'Your airfield records'));
  const filter = node('fieldset', 'difficulty-options career-mode');
  filter.append(node('legend', '', 'Record difficulty'));
  const choices = node('div', 'difficulty-choices');
  for (const mode of DIFFICULTIES) {
    const label = node('label', '');
    const input = node('input', ''); input.type = 'radio'; input.name = 'career-difficulty'; input.value = mode; input.checked = mode === difficulty;
    input.addEventListener('change', () => { renderCareer(container, save, previews, mode); container.querySelector<HTMLInputElement>(`input[value="${mode}"]`)?.focus({ preventScroll: true }); });
    label.append(input, node('span', '', DIFFICULTY_LABELS[mode])); choices.append(label);
  }
  filter.append(choices); airfields.append(filter);
  const records = node('div', 'airfield-records');
  for (const map of MAP_DEFINITIONS) {
    const unlocked = isMapUnlocked(map.id, current.id);
    const card = node('article', `airfield-record${unlocked ? '' : ' is-locked'}`);
    const picture = node('div', 'airfield-record-picture');
    const image = node('img', '');
    image.alt = '';
    image.dataset.careerMap = map.id;
    const preview = previews.get(map.id);
    if (preview) image.src = preview;
    picture.append(image);
    const status = node('span', 'airfield-record-status', unlocked ? 'Available' : 'Locked');
    if (!unlocked) {
      const icon = node('span', 'button-icon');
      mountHugeIcon(icon, 'lock', 14);
      status.prepend(icon);
    }
    picture.append(status);
    const detail = node('div', 'airfield-record-detail');
    detail.append(node('h4', '', map.metadata.name));
    if (unlocked) {
      const score = node('p', 'airfield-best');
      score.append(node('strong', '', String(Math.max(...Object.values(save.mapRecords[map.id].difficultyScores[difficulty]))).padStart(2, '0')), node('span', '', 'Best landings'));
      const scores = save.mapRecords[map.id].difficultyScores[difficulty];
      detail.append(score, node('p', 'record-orientations', `Portrait ${scores.portrait} · Landscape ${scores.landscape}`));
    } else {
      detail.append(node('p', 'airfield-unlock', `Earn ${rankDefinition(map.metadata.unlockRankId).name} to unlock.`));
    }
    card.append(picture, detail);
    records.append(card);
  }
  airfields.append(records);
  const ladder = node('section', 'career-ladder');
  ladder.append(node('h3', 'career-section-title', 'Your path to Chief Controller'));
  const ranks = node('ol', 'clearance-path');
  RANK_CATALOG.forEach((rank, index) => {
    const item = node('li', index === level ? 'is-current' : index < level ? 'is-earned' : '');
    if (index === level) item.setAttribute('aria-current', 'step');
    item.append(node('span', 'clearance-number', String(index + 1).padStart(2, '0')), node('strong', '', rank.name), node('small', '', index === level ? 'Current' : index < level ? 'Earned' : 'Not yet earned'));
    ranks.append(item);
  });
  ladder.append(ranks);
  const achievements = node('section', 'career-achievements');
  achievements.append(node('h3', 'career-section-title', `Achievements · ${Object.keys(save.achievements).length} / ${ACHIEVEMENTS.length}`), node('p', 'achievement-caption', 'Earn badges from completed shifts. Leaving or restarting an unfinished shift discards its progress.'));
  const badges = node('div', 'achievement-grid');
  for (const achievement of ACHIEVEMENTS) {
    const earned = !!save.achievements[achievement.id];
    const card = node('article', `achievement-card${earned ? ' is-earned' : ''}`);
    const icons: Record<string, AppIconName> = { 'first-landing': 'landing', 'getting-comfortable': 'target', 'busy-shift': 'career', 'mixed-fleet': 'fleet', 'steady-hands': 'safety', 'airfield-explorer': 'explore', 'expanded-horizons': 'explore', 'under-pressure': 'pressure', 'veteran-controller': 'veteran' };
    const icon = node('span', 'achievement-icon'); mountHugeIcon(icon, icons[achievement.id], 28);
    card.append(icon, node('span', 'achievement-state', earned ? 'Earned' : 'In progress'), node('h4', '', achievement.name), node('p', '', achievement.description));
    const progress = node('progress', ''); progress.max = achievement.goal; progress.value = earned ? achievement.goal : Math.min(achievement.value(save), achievement.goal); progress.setAttribute('aria-label', achievement.name);
    card.append(progress, node('small', '', earned ? 'Completed' : `${progress.value} / ${achievement.goal}`)); badges.append(card);
  }
  achievements.append(badges);
  container.replaceChildren(overview, airfields, achievements, ladder);
}

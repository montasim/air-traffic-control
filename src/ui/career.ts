import { LIVERIES, isLiveryUnlocked, type LiveryId } from '../progression/liveries';
import { AIRCRAFT_OUTLINES } from '../core/aircraftCollision';
import { AIRCRAFT_VISUAL_TOKENS as INK, aircraftLiveryPaint } from '../game/rendering/aircraft/visualTokens';
import { DIFFICULTIES, DIFFICULTY_LABELS, type DifficultyId } from '../core/difficulty';
import { ACHIEVEMENTS } from '../progression/achievements';
import { MAP_DEFINITIONS } from '../game/maps/registry';
import type { MapId } from '../game/maps/mapIds';
import { RANK_CATALOG, rankDefinition, rankIndex, isMapUnlocked, promotionProgress } from '../progression/ranks';
import type { GameSaveV3 } from '../storage/gameSave';
import { ACHIEVEMENT_ICONS } from './achievementIcons';
import { mountHugeIcon } from './hugeicons';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function renderCareer(container: HTMLElement, save: GameSaveV3, previews: ReadonlyMap<MapId, string>, difficulty: DifficultyId = save.selectedDifficulty, selectLivery?: (id: LiveryId) => Promise<{ save: GameSaveV3; persisted: boolean }>): void {
  const current = rankDefinition(save.career.earnedRankId);
  const level = rankIndex(current.id);
  const next = RANK_CATALOG[level + 1];
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
    const progress = promotionProgress(save.career, save.mapRecords, r.qualifyingBestScore);
    const requirements: [string, number, number][] = [
      ['Safe landings', save.career.totalSafeLandings, r.minimumSafeLandings],
      ['Completed shifts', save.career.shiftsPlayed, r.minimumShifts],
      [`Airfields with a best of ${r.qualifyingBestScore}+`, progress.distinctMaps, r.minimumDistinctMaps],
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
    reward.push(...LIVERIES.filter(livery => livery.rank === next.id).map(livery => `${livery.name} livery`));
    promotion.append(node('p', 'promotion-reward', reward.length ? `Unlocks ${reward.join(' and ')}` : 'Earn your next controller badge'));
  } else {
    promotion.append(node('p', 'promotion-caption', 'Every clearance earned. Every airfield unlocked. Keep building your record with each safe landing.'), node('p', 'promotion-reward', `All ${MAP_DEFINITIONS.length} airfields are yours`));
  }
  overview.append(identity, promotion);

  const liveries = node('section', 'career-liveries');
  liveries.append(node('h3', 'career-section-title', 'Aircraft liveries'), node('p', 'achievement-caption', 'Choose a look for your fleet. Destination colors and flight behavior stay the same. Applies on your next flight.'));
  const fleet = node('fieldset', 'livery-options');
  fleet.append(node('legend', 'livery-legend', 'Fleet livery'));
  const status = node('p', 'achievement-caption livery-status');
  status.setAttribute('role', 'status');
  for (const livery of LIVERIES) {
    const unlocked = isLiveryUnlocked(livery.id, current.id);
    const label = node('label', 'livery-option');
    const input = node('input', '');
    input.type = 'radio'; input.name = 'fleet-livery'; input.value = livery.id;
    input.checked = save.settings.livery === livery.id;
    input.disabled = !unlocked || !selectLivery;
    const detail = node('span', 'livery-detail');
    const preview = node('img', 'livery-preview');
    preview.alt = '';
    preview.src = liveryPreview(livery);
    const text = node('span', '');
    text.append(node('strong', '', livery.name), node('small', '', unlocked ? 'Available' : `Unlocks at ${rankDefinition(livery.rank).name}`));
    detail.append(preview, text);
    label.append(input, detail);
    input.addEventListener('change', async () => {
      fleet.disabled = true;
      filter.disabled = true;
      status.textContent = 'Saving livery…';
      try {
        const result = await selectLivery!(livery.id);
        save = result.save;
        status.textContent = result.persisted ? `${livery.name} selected for your next flight.` : `${livery.name} selected for this session. Could not save to this device.`;
      } catch {
        status.textContent = 'Could not select that livery. Please try again.';
      } finally {
        fleet.disabled = false;
        filter.disabled = false;
        fleet.querySelectorAll<HTMLInputElement>('input').forEach(choice => { choice.checked = choice.value === save.settings.livery; });
        input.focus({ preventScroll: true });
      }
    });
    fleet.append(label);
  }
  liveries.append(fleet, status);

  const airfields = node('section', 'career-airfields');
  airfields.append(node('h3', 'career-section-title', 'Your airfield records'));
  const filter = node('fieldset', 'difficulty-options career-mode');
  filter.append(node('legend', '', 'Record difficulty'));
  const choices = node('div', 'difficulty-choices');
  for (const mode of DIFFICULTIES) {
    const label = node('label', '');
    const input = node('input', ''); input.type = 'radio'; input.name = 'career-difficulty'; input.value = mode; input.checked = mode === difficulty;
    input.addEventListener('change', () => { renderCareer(container, save, previews, mode, selectLivery); container.querySelector<HTMLInputElement>(`input[value="${mode}"]`)?.focus({ preventScroll: true }); });
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
    const icon = node('span', 'achievement-icon'); mountHugeIcon(icon, ACHIEVEMENT_ICONS[achievement.id], 28);
    card.append(icon, node('span', 'achievement-state', earned ? 'Earned' : 'In progress'), node('h4', '', achievement.name), node('p', '', achievement.description));
    const progress = node('progress', ''); progress.max = achievement.goal; progress.value = earned ? achievement.goal : Math.min(achievement.value(save), achievement.goal); progress.setAttribute('aria-label', achievement.name);
    card.append(progress, node('small', '', earned ? 'Completed' : `${progress.value} / ${achievement.goal}`)); badges.append(card);
  }
  achievements.append(badges);
  container.replaceChildren(overview, liveries, airfields, achievements, ladder);
}

/** Use the same airframe outlines, class colors and paint treatments as the in-game fleet. */
function liveryPreview(livery: typeof LIVERIES[number]): string {
  const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
  const aircraft = (['liner', 'commuter', 'rotor'] as const).map((type, index) => {
    const paint = aircraftLiveryPaint(livery.id, type);
    const outline = AIRCRAFT_OUTLINES[type].map(point => point.join(',')).join(' ');
    const wingX = type === 'liner' ? -7 : -4;
    return `<g transform="translate(${42 + index * 82} 36)" fill="${hex(INK.keyline)}">
      ${livery.id === 'midnight' ? `<polygon points="${outline}" fill="none" stroke="${hex(INK.keyline)}" stroke-width="4.4"/>` : ''}
      <polygon points="${outline}" fill="${hex(paint.body)}" stroke="${hex(paint.edge)}" stroke-width="2.4"/>
      <rect x="${paint.panelX}" y="${-paint.panelHeight / 2}" width="${paint.panelWidth}" height="${paint.panelHeight}" rx="${Math.min(4, paint.panelHeight / 2)}" fill="${hex(paint.panel)}"/>
      ${type === 'rotor' ? '' : `<path d="M${wingX} -19l3 10M${wingX} 19l3 -10" stroke="${hex(paint.wing)}" stroke-width="${paint.wingWidth}"/>`}
      <rect x="${type === 'rotor' ? 14 : 20}" y="-3.5" width="6" height="7" rx="2" fill="${hex(paint.cockpit)}"/>
      ${type === 'rotor' ? `<path d="M-20 0h50M5 -25v50" stroke="${hex(paint.rotor)}" stroke-opacity=".42" stroke-width="3"/><circle cx="5" r="3" fill="${hex(INK.bodyHighlight)}" stroke="${hex(INK.keyline)}" stroke-width="1.5"/>` : ''}
    </g>`;
  }).join('');
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 248 72">${aircraft}</svg>`)}`;
}

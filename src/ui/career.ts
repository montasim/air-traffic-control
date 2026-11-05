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
import { el, formatScore } from './dom';


export function renderCareer(container: HTMLElement, save: GameSaveV3, previews: ReadonlyMap<MapId, string>, difficulty: DifficultyId = save.selectedDifficulty, selectLivery?: (id: LiveryId) => Promise<{ save: GameSaveV3; persisted: boolean }>): void {
  const current = rankDefinition(save.career.earnedRankId);
  const level = rankIndex(current.id);
  const next = RANK_CATALOG[level + 1];
  const overview = el('div', 'career-overview');
  const identity = el('section', 'controller-card');
  identity.setAttribute('aria-label', 'Current clearance');
  const badge = el('div', 'controller-badge');
  badge.setAttribute('aria-hidden', 'true');
  mountHugeIcon(badge, 'career', 48);
  identity.append(badge, el('p', 'career-eyebrow', 'Current clearance'), el('h3', '', current.name), el('p', 'clearance-level', `Clearance ${level + 1} of ${RANK_CATALOG.length}`));
  const totals = el('dl', 'career-totals');
  for (const [label, value] of [['Safe landings', save.career.totalSafeLandings], ['Shifts completed', save.career.shiftsPlayed]] as const) {
    const item = el('div', '');
    item.append(el('dt', '', label), el('dd', '', formatScore(value)));
    totals.append(item);
  }
  identity.append(totals);
  if (save.modified) identity.append(el('p', 'clearance-level', 'Records on this device were changed outside the game.'));
  const promotion = el('section', 'promotion-card');
  promotion.append(el('p', 'career-eyebrow', next ? 'Your next clearance' : 'Career complete'), el('h3', '', next?.name ?? 'Chief of the airspace'));
  if (next) {
    const r = next.requirements;
    const progress = promotionProgress(save.career, save.mapRecords, r.qualifyingBestScore);
    const requirements: [string, number, number][] = [
      ['Safe landings', save.career.totalSafeLandings, r.minimumSafeLandings],
      ['Completed shifts', save.career.shiftsPlayed, r.minimumShifts],
      [`Airfields with a best of ${r.qualifyingBestScore}+`, progress.distinctMaps, r.minimumDistinctMaps],
    ];
    promotion.append(el('p', 'promotion-caption', 'Complete all three objectives to earn your promotion.'));
    const objectives = el('div', 'promotion-objectives');
    for (const [label, value, goal] of requirements) {
      const complete = value >= goal;
      const objective = el('div', `promotion-objective${complete ? ' is-complete' : ''}`);
      const labelRow = el('div', 'objective-label');
      labelRow.append(el('span', '', label), el('strong', '', complete ? 'Complete' : `${value} / ${goal}`));
      const progress = el('progress', '');
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
    promotion.append(el('p', 'promotion-reward', reward.length ? `Unlocks ${reward.join(' and ')}` : 'Earn your next controller badge'));
  } else {
    promotion.append(el('p', 'promotion-caption', 'Every clearance earned. Every airfield unlocked. Keep building your record with each safe landing.'), el('p', 'promotion-reward', `All ${MAP_DEFINITIONS.length} airfields are yours`));
  }
  overview.append(identity, promotion);

  const liveries = el('section', 'career-liveries');
  liveries.append(el('h3', 'career-section-title', 'Aircraft liveries'), el('p', 'achievement-caption', 'Choose a look for your fleet. Destination colors and flight behavior stay the same. Applies on your next flight.'));
  const fleet = el('fieldset', 'livery-options');
  fleet.append(el('legend', 'livery-legend', 'Fleet livery'));
  const status = el('p', 'achievement-caption livery-status');
  status.setAttribute('role', 'status');
  for (const livery of LIVERIES) {
    const unlocked = isLiveryUnlocked(livery.id, current.id);
    const label = el('label', 'livery-option');
    const input = el('input', '');
    input.type = 'radio'; input.name = 'fleet-livery'; input.value = livery.id;
    input.checked = save.settings.livery === livery.id;
    input.disabled = !unlocked || !selectLivery;
    const detail = el('span', 'livery-detail');
    const preview = el('img', 'livery-preview');
    preview.alt = '';
    preview.src = liveryPreview(livery);
    const text = el('span', '');
    text.append(el('strong', '', livery.name), el('small', '', unlocked ? 'Available' : `Unlocks at ${rankDefinition(livery.rank).name}`));
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

  const airfields = el('section', 'career-airfields');
  airfields.append(el('h3', 'career-section-title', 'Your airfield records'));
  const filter = el('fieldset', 'difficulty-options career-mode');
  filter.append(el('legend', '', 'Show records for'));
  const choices = el('div', 'difficulty-choices');
  for (const mode of DIFFICULTIES) {
    const label = el('label', '');
    const input = el('input', ''); input.type = 'radio'; input.name = 'career-difficulty'; input.value = mode; input.checked = mode === difficulty;
    input.addEventListener('change', () => { renderCareer(container, save, previews, mode, selectLivery); container.querySelector<HTMLInputElement>(`input[value="${mode}"]`)?.focus({ preventScroll: true }); });
    label.append(input, el('span', '', DIFFICULTY_LABELS[mode])); choices.append(label);
  }
  filter.append(choices); airfields.append(filter);
  const records = el('div', 'airfield-records');
  for (const map of MAP_DEFINITIONS) {
    const unlocked = isMapUnlocked(map.id, current.id);
    const card = el('article', `airfield-record${unlocked ? '' : ' is-locked'}`);
    const picture = el('div', 'airfield-record-picture');
    const image = el('img', '');
    image.alt = '';
    image.dataset.careerMap = map.id;
    image.style.objectPosition = `var(--map-focus-${map.id}, center)`;
    const preview = previews.get(map.id);
    if (preview) image.src = preview;
    picture.append(image);
    const status = el('span', 'airfield-record-status', unlocked ? 'Available' : 'Locked');
    if (!unlocked) {
      const icon = el('span', 'button-icon');
      mountHugeIcon(icon, 'lock', 14);
      status.prepend(icon);
    }
    picture.append(status);
    const detail = el('div', 'airfield-record-detail');
    detail.append(el('h4', '', map.metadata.name));
    if (unlocked) {
      const score = el('p', 'airfield-best');
      score.append(el('strong', '', formatScore(Math.max(...Object.values(save.mapRecords[map.id].difficultyScores[difficulty])))), el('span', '', 'Best landings'));
      const scores = save.mapRecords[map.id].difficultyScores[difficulty];
      detail.append(score, el('p', 'record-orientations', `Portrait ${scores.portrait} · Landscape ${scores.landscape}`));
    } else {
      detail.append(el('p', 'airfield-unlock', `Earn ${rankDefinition(map.metadata.unlockRankId).name} to unlock.`));
    }
    card.append(picture, detail);
    records.append(card);
  }
  airfields.append(records);
  const ladder = el('section', 'career-ladder');
  ladder.append(el('h3', 'career-section-title', 'Your path to Chief Controller'));
  const ranks = el('ol', 'clearance-path');
  RANK_CATALOG.forEach((rank, index) => {
    const item = el('li', index === level ? 'is-current' : index < level ? 'is-earned' : '');
    if (index === level) item.setAttribute('aria-current', 'step');
    item.append(el('span', 'clearance-number', formatScore(index + 1)), el('strong', '', rank.name), el('small', '', index === level ? 'Current' : index < level ? 'Earned' : 'Not yet earned'));
    ranks.append(item);
  });
  ladder.append(ranks);
  const achievements = el('section', 'career-achievements');
  achievements.append(el('h3', 'career-section-title', `Achievements · ${Object.keys(save.achievements).length} / ${ACHIEVEMENTS.length}`), el('p', 'achievement-caption', 'Earn badges from completed shifts. Leaving or restarting an unfinished shift discards its progress.'));
  const badges = el('div', 'achievement-grid');
  for (const achievement of ACHIEVEMENTS) {
    const earned = !!save.achievements[achievement.id];
    const card = el('article', `achievement-card${earned ? ' is-earned' : ''}`);
    const icon = el('span', 'achievement-icon'); mountHugeIcon(icon, ACHIEVEMENT_ICONS[achievement.id], 28);
    card.append(icon, el('span', 'achievement-state', earned ? 'Earned' : 'In progress'), el('h4', '', achievement.name), el('p', '', achievement.description));
    const progress = el('progress', ''); progress.max = achievement.goal; progress.value = earned ? achievement.goal : Math.min(achievement.value(save), achievement.goal); progress.setAttribute('aria-label', achievement.name);
    card.append(progress, el('small', '', earned ? 'Completed' : `${progress.value} / ${achievement.goal}`)); badges.append(card);
  }
  achievements.append(badges);
  // Status, then what's next, then what's done, then detail, then cosmetics.
  container.replaceChildren(overview, ladder, achievements, airfields, liveries);
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

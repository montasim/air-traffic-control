import { ACHIEVEMENTS } from '../progression/achievements';
import { ACHIEVEMENT_ICONS } from './achievementIcons';
import { mountHugeIcon } from './hugeicons';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Shift-end achievements as badges that pop in one after another. */
export function renderAchievementBadges(container: HTMLElement, achievementIds: readonly string[]): void {
  container.replaceChildren();
  container.hidden = achievementIds.length === 0;
  if (container.hidden) return;
  const list = element('ul', 'achievement-badges');
  achievementIds.forEach((id, index) => {
    const achievement = ACHIEVEMENTS.find((item) => item.id === id);
    if (!achievement) return;
    const badge = element('li', 'achievement-badge');
    badge.style.setProperty('--badge-index', String(index));
    const icon = element('span', 'achievement-badge-icon');
    icon.setAttribute('aria-hidden', 'true');
    mountHugeIcon(icon, ACHIEVEMENT_ICONS[id] ?? 'career', 20);
    badge.append(icon, element('strong', '', achievement.name), element('span', 'achievement-badge-copy', achievement.description));
    list.append(badge);
  });
  container.append(element('h3', 'celebration-eyebrow', achievementIds.length === 1 ? 'Achievement earned' : 'Achievements earned'), list);
}

/**
 * A promotion block timed to the promotion sound, listing any airfields it opens.
 * `delayMs` matches the audio cue so the block lands with it.
 */
export function renderPromotion(container: HTMLElement, rankName: string, unlockedAirfields: readonly string[], delayMs: number): void {
  container.replaceChildren();
  container.classList.add('is-promotion');
  container.style.setProperty('--celebrate-delay', `${delayMs}ms`);
  const icon = element('span', 'promotion-icon');
  icon.setAttribute('aria-hidden', 'true');
  mountHugeIcon(icon, 'career', 24);
  const heading = element('div', 'promotion-heading');
  heading.append(element('span', 'celebration-eyebrow', 'Promotion'), element('strong', '', `Promoted to ${rankName}`));
  container.append(icon, heading);
  if (unlockedAirfields.length) {
    const unlocks = element('ul', 'promotion-unlocks');
    unlocks.setAttribute('aria-label', 'Airfields now open');
    for (const name of unlockedAirfields) unlocks.append(element('li', '', `${name} now open`));
    container.append(unlocks);
  }
}

/** Return the result line to its plain, uncelebrated state for a new shift. */
export function resetCareerResult(container: HTMLElement, text: string): void {
  container.classList.remove('is-promotion');
  container.style.removeProperty('--celebrate-delay');
  container.textContent = text;
}

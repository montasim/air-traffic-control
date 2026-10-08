import { DIFFICULTY_LABELS } from '../core/difficulty';
import type { ChallengeResponse, Standing } from '../competition/contracts';
import type { ChallengeOrientation } from '../competition/rules';
import { mapDefinitionById } from '../game/maps/registry';

export type ChallengeViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly response: ChallengeResponse; readonly stale: boolean; readonly orientation: ChallengeOrientation; readonly starting: boolean };

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function standingsTable(entries: readonly Standing[]): HTMLElement {
  const region = element('div', 'challenge-standings');
  const heading = element('h3', '', 'Global standings');
  region.append(heading);
  if (!entries.length) {
    region.append(element('p', 'challenge-empty', 'No verified scores yet. The tower is yours.'));
    return region;
  }
  const table = element('table');
  table.setAttribute('aria-label', 'Global challenge standings');
  const head = table.createTHead().insertRow();
  for (const label of ['Rank', 'Controller', 'Landings']) {
    const cell = element('th', '', label);
    cell.scope = 'col';
    head.append(cell);
  }
  const body = table.createTBody();
  for (const entry of entries) {
    const row = body.insertRow();
    if (entry.isPlayer) row.className = 'is-player';
    const rank = row.insertCell(); rank.textContent = String(entry.rank);
    const callsign = row.insertCell(); callsign.textContent = entry.callsign + (entry.isPlayer ? ' · You' : '');
    const score = row.insertCell(); score.textContent = String(entry.score).padStart(2, '0');
  }
  region.append(table);
  return region;
}

export function renderChallenge(
  container: HTMLElement,
  state: ChallengeViewState,
  actions: { readonly play: () => void; readonly refresh: () => void },
): void {
  if (state.status === 'loading') {
    const status = element('p', 'challenge-status', 'Contacting approach control…');
    status.setAttribute('role', 'status');
    container.replaceChildren(status);
    return;
  }
  if (state.status === 'error') {
    const message = element('p', 'challenge-status is-error', state.message);
    message.setAttribute('role', 'alert');
    const retry = element('button', 'secondary-button', 'Try again'); retry.type = 'button'; retry.addEventListener('click', actions.refresh);
    container.replaceChildren(message, retry);
    return;
  }

  const { challenge } = state.response;
  if (!challenge) {
    const message = element('p', 'challenge-status', 'No tower challenge is active right now. Ordinary flights remain available offline.');
    const retry = element('button', 'secondary-button', 'Check again'); retry.type = 'button'; retry.addEventListener('click', actions.refresh);
    container.replaceChildren(message, retry);
    return;
  }

  const intro = element('div', 'challenge-intro');
  intro.append(
    element('p', 'challenge-lead', 'One traffic pattern. One rulebook. Your best verified shift.'),
    element('p', 'challenge-copy', 'Participation is optional. Pausing is allowed and never breaks score ties. Started runs may submit for 15 minutes after the weekly close. Ranked flights never change your local career, records, achievements, or settings.'),
  );
  if (state.stale) {
    const stale = element('p', 'challenge-status is-stale', 'Showing saved standings. Connect before starting a ranked flight.');
    stale.setAttribute('role', 'status');
    intro.append(stale);
  }

  const assignment = element('dl', 'challenge-assignment');
  const values: readonly [string, string][] = [
    ['Airfield', mapDefinitionById(challenge.mapId).metadata.name],
    ['Difficulty', DIFFICULTY_LABELS[challenge.difficulty]],
    ['Division', state.orientation === 'portrait' ? 'Portrait' : 'Landscape'],
    ['Landing rule', challenge.twoEndLanding ? 'Both runway ends' : 'Highlighted runway end'],
    ['Closes', new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(challenge.endsAt))],
  ];
  for (const [label, value] of values) {
    const row = element('div');
    row.append(element('dt', '', label), element('dd', '', value));
    assignment.append(row);
  }

  const play = element('button', 'primary-button button-with-icon', state.starting ? 'Requesting clearance…' : 'Play ranked');
  play.type = 'button';
  play.disabled = state.starting || state.stale;
  play.addEventListener('click', actions.play);

  container.replaceChildren(intro, assignment, play, standingsTable(state.response.standings[state.orientation]));
}

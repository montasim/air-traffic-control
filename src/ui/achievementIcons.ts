import type { AppIconName } from './hugeicons';

/** One icon per achievement, shared by the career page and the shift result. */
export const ACHIEVEMENT_ICONS: Readonly<Record<string, AppIconName>> = {
  'first-landing': 'landing',
  'getting-comfortable': 'target',
  'busy-shift': 'career',
  'mixed-fleet': 'fleet',
  'steady-hands': 'safety',
  'airfield-explorer': 'explore',
  'expanded-horizons': 'explore',
  'under-pressure': 'pressure',
  'veteran-controller': 'veteran',
};

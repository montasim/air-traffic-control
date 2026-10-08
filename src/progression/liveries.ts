import { rankIndex, type RankId } from './ranks';

export const LIVERIES = [
  { id: 'classic', name: 'Classic', rank: 'control-trainee' },
  { id: 'signal', name: 'Signal', rank: 'tower-controller' },
  { id: 'midnight', name: 'Midnight', rank: 'senior-controller' },
] as const satisfies readonly { id: string; name: string; rank: RankId }[];

export type LiveryId = typeof LIVERIES[number]['id'];

export function isLiveryUnlocked(value: unknown, rank: RankId): value is LiveryId {
  return LIVERIES.some(livery => livery.id === value && rankIndex(rank) >= rankIndex(livery.rank));
}

export function normalizeLivery(value: unknown, rank: RankId): LiveryId {
  // Preserve choices saved before the broader paint treatments replaced small markings.
  if (value === 'twin-bands') value = 'signal';
  if (value === 'chevron') value = 'midnight';
  return isLiveryUnlocked(value, rank) ? value : 'classic';
}

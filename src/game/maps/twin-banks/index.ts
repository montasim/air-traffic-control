import { defineMap } from '../shared/definition';
import { createTwinBanksLayout } from './layout';

export * from './layout';

export const TWIN_BANKS_DEFINITION = defineMap({
  id: 'twin-banks',
  metadata: {
    name: 'Twin Banks',
    description: 'Two asymmetric fields share a river corridor and demand cross-bank planning.',
    category: 'regional',
    layoutLabel: 'Split airfield',
    unlockRankId: 'tower-controller'
  },
  trafficProfileId: 'twin-banks',
  createLayout: ({ width, height, detailLevel }) =>
    createTwinBanksLayout(width, height, detailLevel),

});

/** Compatibility alias for callers that name selectable definitions as maps. */
export const TWIN_BANKS_MAP = TWIN_BANKS_DEFINITION;

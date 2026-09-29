import { defineMap } from '../shared/definition';
import { createRiverBendLayout } from './layout';
import { renderRiverBend } from './render';

export const RIVER_BEND_DEFINITION = defineMap({
  id: 'river-bend',
  metadata: {
    name: 'River Bend',
    description: 'A compact airfield beside a quiet curved river landmark.',
    category: 'regional',
    layoutLabel: 'Riverside airfield',
    unlockRankId: 'control-trainee'
  },
  trafficProfileId: 'river-bend',
  createLayout: ({ width, height }) => createRiverBendLayout(width, height),
  render: (scene, layout, { detailLevel }) => {
    renderRiverBend(scene, layout, detailLevel);
  }
});

/** Compatibility alias for callers that name selectable definitions as maps. */
export const RIVER_BEND_MAP = RIVER_BEND_DEFINITION;

export { createRiverBendLayout } from './layout';
export type {
  RiverBendLayout,
  RiverConnectionId,
  RiverRunwayDesignator,
  RiverRunwayId,
  RiverTaxiwayId
} from './layout';
export { renderRiverBend, RIVER_BEND_PALETTE } from './render';

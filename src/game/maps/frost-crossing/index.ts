import { defineMap } from '../shared/definition';
import { createFrostCrossingLayout, type FrostCrossingLayout } from './layout';
import { renderFrostCrossingMap } from './renderer';

export { createFrostCrossingLayout, type FrostCrossingLayout } from './layout';

export const FROST_CROSSING_DEFINITION = defineMap<FrostCrossingLayout>({
  id: 'frost-crossing',
  metadata: {
    name: 'Frost Crossing',
    description: 'A snowbound island field with parallel runways either side of its apron.',
    category: 'regional',
    layoutLabel: 'Crossing runways',
    unlockRankId: 'chief-controller',
  },
  trafficProfileId: 'frost-crossing',
  createLayout: ({ width, height }) => createFrostCrossingLayout(width, height),
  render: (scene, layout, { detailLevel }) => renderFrostCrossingMap(scene, layout, detailLevel),
});

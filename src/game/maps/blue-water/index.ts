import { defineMap } from '../shared/definition';
import { createBlueWaterLayout, type BlueWaterLayout } from './layout';
import { renderBlueWaterMap } from './renderer';

export { createBlueWaterLayout, type BlueWaterLayout } from './layout';

export const BLUE_WATER_DEFINITION = defineMap<BlueWaterLayout>({
  id: 'blue-water',
  metadata: {
    name: 'Blue Water',
    description: 'Open ocean and one carrier deck: every arrival lands on it.',
    category: 'naval',
    layoutLabel: 'Carrier deck only',
    unlockRankId: 'air-boss',
  },
  trafficProfileId: 'blue-water',
  createLayout: ({ width, height }) => createBlueWaterLayout(width, height),
  render: (scene, layout, { detailLevel }) => renderBlueWaterMap(scene, layout, detailLevel),
});

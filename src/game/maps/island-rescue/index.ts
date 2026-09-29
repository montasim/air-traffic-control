import { defineMap } from '../shared/definition';
import { renderSpecialistAirfield } from '../shared/specialistAirfield';
import { createLayout } from './layout';
export { createLayout } from './layout';
export const ISLAND_RESCUE_DEFINITION = defineMap({
  id: 'island-rescue',
  metadata: { name: 'Island Rescue', description: 'A coastal airstrip and two island rescue pads share open water.', category: 'rescue', layoutLabel: 'Island destinations', unlockRankId: 'senior-controller' },
  trafficProfileId: 'island-rescue',
  createLayout: ({width,height}) => createLayout(width,height),
  render: (scene, layout, {detailLevel}) => renderSpecialistAirfield(scene, layout, detailLevel)
});

import { defineMap } from '../shared/definition';
import { renderSpecialistAirfield } from '../shared/specialistAirfield';
import { createLayout } from './layout';
export { createLayout } from './layout';
export const METRO_INTERNATIONAL_DEFINITION = defineMap({
  id: 'metro-international',
  metadata: { name: 'Metro International', description: 'Long parallel approaches around a busy passenger concourse.', category: 'passenger', layoutLabel: 'Parallel approaches', unlockRankId: 'tower-controller' },
  trafficProfileId: 'metro-international',
  createLayout: ({width,height}) => createLayout(width,height),
  render: (scene, layout, {detailLevel}) => renderSpecialistAirfield(scene, layout, detailLevel)
});

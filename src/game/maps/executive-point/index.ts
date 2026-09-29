import { defineMap } from '../shared/definition';
import { renderSpecialistAirfield } from '../shared/specialistAirfield';
import { createLayout } from './layout';
export { createLayout } from './layout';
export const EXECUTIVE_POINT_DEFINITION = defineMap({
  id: 'executive-point',
  metadata: { name: 'Executive Point', description: 'Private hangars and a compact terminal beside landscaped grounds.', category: 'business', layoutLabel: 'Compact approaches', unlockRankId: 'control-assistant' },
  trafficProfileId: 'executive-point',
  createLayout: ({width,height}) => createLayout(width,height),
  render: (scene, layout, {detailLevel}) => renderSpecialistAirfield(scene, layout, detailLevel)
});

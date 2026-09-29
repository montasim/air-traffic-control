import { defineMap } from '../shared/definition';
import { renderSpecialistAirfield } from '../shared/specialistAirfield';
import { createLayout } from './layout';
export { createLayout } from './layout';
export const FALCON_AIR_BASE_DEFINITION = defineMap({
  id: 'falcon-air-base',
  metadata: { name: 'Falcon Air Base', description: 'Sheltered military aprons with separated fixed-wing and rotor approaches.', category: 'military', layoutLabel: 'Offset runways', unlockRankId: 'approach-controller' },
  trafficProfileId: 'falcon-air-base',
  createLayout: ({width,height}) => createLayout(width,height),
  render: (scene, layout, {detailLevel}) => renderSpecialistAirfield(scene, layout, detailLevel)
});

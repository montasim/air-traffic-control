import { defineMap } from '../shared/definition';
import { renderSpecialistAirfield } from '../shared/specialistAirfield';
import { createLayout } from './layout';
export { createLayout } from './layout';
export const FREIGHT_JUNCTION_DEFINITION = defineMap({
  id: 'freight-junction',
  metadata: { name: 'Freight Junction', description: 'Warehouse aprons and offset runways across an industrial basin.', category: 'cargo', layoutLabel: 'Offset freight strips', unlockRankId: 'area-controller' },
  trafficProfileId: 'freight-junction',
  createLayout: ({width,height}) => createLayout(width,height),
  render: (scene, layout, {detailLevel}) => renderSpecialistAirfield(scene, layout, detailLevel)
});

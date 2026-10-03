import { defineMap } from '../shared/definition';
import { createCarrierCoastLayout, type CarrierCoastLayout } from './layout';
import { renderCarrierCoastMap } from './renderer';

export { createCarrierCoastLayout, type CarrierCoastLayout } from './layout';

export const CARRIER_COAST_DEFINITION = defineMap<CarrierCoastLayout>({
  id: 'carrier-coast',
  metadata: {
    name: 'Carrier Coast',
    description: 'A shore airfield takes the liners; commuters land on the carrier offshore.',
    category: 'naval',
    layoutLabel: 'Shore field and carrier',
    unlockRankId: 'flight-director',
  },
  trafficProfileId: 'carrier-coast',
  createLayout: ({ width, height }) => createCarrierCoastLayout(width, height),
  render: (scene, layout, { detailLevel }) => renderCarrierCoastMap(scene, layout, detailLevel),
});

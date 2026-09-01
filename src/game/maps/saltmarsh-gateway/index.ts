import { defineMap } from '../shared/definition';
import { createSaltmarshGatewayLayout } from './layout';
import { renderSaltmarshGateway } from './render';

export const SALTMARSH_GATEWAY_DEFINITION = defineMap({
  id: 'saltmarsh-gateway',
  metadata: {
    name: 'Saltmarsh Gateway',
    description: 'A connected regional airport above quiet tidal fields.',
    difficulty: 'beginner',
    unlockRankId: 'control-trainee'
  },
  trafficProfileId: 'saltmarsh-gateway',
  createLayout: ({ width, height }) => createSaltmarshGatewayLayout(width, height),
  render: (scene, layout, { detailLevel }) => {
    renderSaltmarshGateway(scene, layout, detailLevel);
  }
});

/** Compatibility alias for callers that name selectable definitions as maps. */
export const SALTMARSH_GATEWAY_MAP = SALTMARSH_GATEWAY_DEFINITION;

export { createSaltmarshGatewayLayout } from './layout';
export type {
  GatewayConnectionId,
  GatewayRunwayDesignator,
  GatewayRunwayId,
  GatewayTaxiwayId,
  SaltmarshGatewayLayout
} from './layout';
export { renderSaltmarshGateway, SALTMARSH_GATEWAY_PALETTE } from './render';

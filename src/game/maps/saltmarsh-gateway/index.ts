import { defineMap } from '../shared/definition';
import { createSaltmarshGatewayLayout } from './layout';

export const SALTMARSH_GATEWAY_DEFINITION = defineMap({
  id: 'saltmarsh-gateway',
  metadata: {
    name: 'Saltmarsh Gateway',
    description: 'A connected regional airport above quiet tidal fields.',
    category: 'regional',
    layoutLabel: 'Parallel runways',
    unlockRankId: 'control-trainee'
  },
  trafficProfileId: 'saltmarsh-gateway',
  createLayout: ({ width, height }) => createSaltmarshGatewayLayout(width, height),

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
export { SALTMARSH_GATEWAY_PALETTE } from './palette';

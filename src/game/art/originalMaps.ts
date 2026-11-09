import type { Scene } from './CanvasScene';
import type { MapId } from '../maps/mapIds';
import type { PlayableMapLayout } from '../maps/types';
import type { WorldDetailLevel } from '../palette';
import { renderSaltmarshGateway } from '../maps/saltmarsh-gateway/render';
import { renderRiverBend } from '../maps/river-bend/render';
import { renderDesertParallelMap } from '../maps/desert-parallel/renderer';
import { renderTwinBanksMap } from '../maps/twin-banks/renderer';
import { renderSpecialistAirfield } from '../maps/shared/specialistAirfield';
import { renderFrostCrossingMap } from '../maps/frost-crossing/renderer';
import { renderCarrierCoastMap } from '../maps/carrier-coast/renderer';
import { renderBlueWaterMap } from '../maps/blue-water/renderer';

const painters:Record<MapId,(scene:Scene,layout:any,detail:WorldDetailLevel)=>void>={
  'saltmarsh-gateway':renderSaltmarshGateway,'river-bend':renderRiverBend,
  'desert-parallel':renderDesertParallelMap,'twin-banks':renderTwinBanksMap,
  'falcon-air-base':renderSpecialistAirfield,'executive-point':renderSpecialistAirfield,
  'metro-international':renderSpecialistAirfield,'freight-junction':renderSpecialistAirfield,
  'island-rescue':renderSpecialistAirfield,'frost-crossing':renderFrostCrossingMap,
  'carrier-coast':renderCarrierCoastMap,'blue-water':renderBlueWaterMap,
};
export function paintOriginalMap(scene:Scene,id:MapId,layout:PlayableMapLayout,detail:WorldDetailLevel){painters[id](scene,layout,detail);}

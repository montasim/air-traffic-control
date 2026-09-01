import type Phaser from 'phaser';
import type { MapId } from '../maps/mapIds';
import type { MapLayoutVariant } from '../maps/types';

export interface PresentationAssetRequest {
  readonly mapId: MapId;
  readonly variant: MapLayoutVariant;
}

interface PresentationAsset {
  readonly key: string;
  readonly url: string;
}

const RIVER_BEND_TERRAIN: Readonly<Record<MapLayoutVariant, PresentationAsset>> = {
  landscape: {
    key: 'terrain:river-bend:landscape:v1',
    url: '/assets/visual-v2/river-bend/terrain-landscape.webp'
  },
  portrait: {
    key: 'terrain:river-bend:portrait:v1',
    url: '/assets/visual-v2/river-bend/terrain-portrait.webp'
  },
  square: {
    key: 'terrain:river-bend:square:v1',
    url: '/assets/visual-v2/river-bend/terrain-square.webp'
  }
};

/** Returns the one terrain plate required by the active map and viewport. */
export function presentationAssetFor(
  request: PresentationAssetRequest
): PresentationAsset | undefined {
  if (request.mapId !== 'river-bend') return undefined;
  return RIVER_BEND_TERRAIN[request.variant];
}

/** Queues only the active presentation asset, avoiding unused decoded maps. */
export function queuePresentationAssets(
  scene: Phaser.Scene,
  request: PresentationAssetRequest
): void {
  const asset = presentationAssetFor(request);
  if (!asset || scene.textures.exists(asset.key)) return;
  scene.load.image(asset.key, asset.url);
}

export function riverBendTerrainTextureKey(variant: MapLayoutVariant): string {
  return RIVER_BEND_TERRAIN[variant].key;
}

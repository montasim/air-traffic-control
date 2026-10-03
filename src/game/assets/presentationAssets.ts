import type Phaser from "phaser";
import type { MapId } from "../maps/mapIds";
import type { MapLayoutVariant } from "../maps/types";

export interface PresentationAssetRequest {
  readonly mapId: MapId;
  readonly variant: MapLayoutVariant;
}

/** Shared tileable materials keep all orientations consistent and bound decoded memory. */
export function presentationAssetFor({ mapId }: PresentationAssetRequest): {
  key: string;
  url: string;
} {
  const materials: Record<MapId, 'mineral' | 'meadow'> = {
    'saltmarsh-gateway': 'meadow', 'river-bend': 'meadow', 'desert-parallel': 'mineral', 'twin-banks': 'meadow',
    'falcon-air-base': 'meadow', 'executive-point': 'meadow', 'metro-international': 'meadow', 'freight-junction': 'mineral', 'island-rescue': 'meadow',
    // Snow, sand, and sea take the fine mineral grain; each renderer decides whether to overlay it.
    'frost-crossing': 'mineral', 'carrier-coast': 'mineral', 'blue-water': 'mineral'
  };
  const material = materials[mapId];
  return {
    key: `terrain:arcade:${material}`,
    url: `/assets/arcade/${material}.webp`,
  };
}

const queued = new WeakMap<Phaser.Scene, Set<string>>();

export function queuePresentationAssets(
  scene: Phaser.Scene,
  request: PresentationAssetRequest,
): void {
  const asset = presentationAssetFor(request);
  const keys = queued.get(scene) ?? new Set<string>();
  if (!scene.textures.exists(asset.key) && !keys.has(asset.key)) {
    keys.add(asset.key);
    queued.set(scene, keys);
    scene.load.image(asset.key, asset.url);
  }
}

import type Phaser from 'phaser';
import type { WorldDetailLevel } from '../../palette';
import type {
  StaticMapComposeOptions,
  StaticMapLayers,
  StaticMapPaintContext,
  StaticMapPaintPlan
} from './types';

function isLayeredPaintPlan<Layout>(
  paint: StaticMapPaintPlan<Layout>
): paint is StaticMapLayers<Layout> {
  return typeof paint !== 'function';
}

/** Paints a layered plan in the one authoritative world order. */
export function paintStaticMapLayers<Layout>(
  context: StaticMapPaintContext<Layout>,
  layers: StaticMapLayers<Layout>
): void {
  layers.scenery(context);
  layers.operational(context);
  layers.detail(context);
}

/** Composes every static map layer into one native-size render texture. */
export function composeStaticMap<Layout extends { readonly width: number; readonly height: number }>(
  scene: Phaser.Scene,
  layout: Layout,
  detailLevel: WorldDetailLevel,
  paint: StaticMapPaintPlan<Layout>,
  options: StaticMapComposeOptions = {}
): Phaser.GameObjects.RenderTexture {
  const graphics = scene.add.graphics();
  const texture = scene.add.renderTexture(0, 0, layout.width, layout.height)
    .setOrigin(0, 0)
    .setDepth(options.depth ?? -20);
  const sceneryTextureKey = options.sceneryTextureKey;
  const hasSceneryTexture = sceneryTextureKey !== undefined
    && scene.textures?.exists(sceneryTextureKey) === true;
  const scenery = hasSceneryTexture
    ? scene.add.image(0, 0, sceneryTextureKey)
      .setOrigin(0, 0)
      .setDisplaySize(layout.width, layout.height)
    : undefined;

  try {
    if (scenery) texture.draw(scenery);
    const context = {
      graphics,
      layout,
      detailLevel,
      unit: Math.min(layout.width, layout.height)
    } satisfies StaticMapPaintContext<Layout>;
    if (isLayeredPaintPlan(paint)) {
      if (!scenery) paint.scenery(context);
      paint.operational(context);
      paint.detail(context);
    } else {
      paint(context);
    }
    texture.draw(graphics);
    texture.render();
  } finally {
    scenery?.destroy();
    graphics.destroy();
  }

  return texture;
}

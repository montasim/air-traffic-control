import type Phaser from "phaser";
import type { WorldDetailLevel } from "../../palette";
import type {
  StaticMapComposeOptions,
  StaticMapLayers,
  StaticMapPaintContext,
  StaticMapPaintPlan,
} from "./types";

/** How many device pixels the scene draws per world unit: the main camera's zoom (1 off-screen). */
export function renderScaleOf(scene: Phaser.Scene): number {
  return scene.cameras?.main?.zoom ?? 1;
}

/**
 * A render texture in world units that bakes at the scene's render scale, so cached layers stay
 * as sharp as live drawing on high-density screens: its camera zooms in and the texture is
 * displayed back at world size.
 */
/** The longest side a baked layer may have: within every phone GPU's limit and memory budget. */
const MAX_BAKE_SIZE = 4096;
/**
 * Registry key for how much finer than the screen the airport vectors bake (2 by default). The menu's
 * picture renderer sets 1: its pictures are shrunk well below display size, so supersampling them only
 * costs memory.
 */
export const VECTOR_SUPERSAMPLE_KEY = "vector-supersample";

export function sceneRenderTexture(scene: Phaser.Scene, width: number, height: number, supersample = 1): Phaser.GameObjects.RenderTexture {
  // Supersampling bakes at a higher scale and lets texture filtering smooth it back down: render textures
  // have no multisampling, so angled edges drawn into them at display scale come out stepped.
  const scale = renderScaleOf(scene) * Math.max(1, Math.min(supersample, MAX_BAKE_SIZE / (Math.max(width, height) * renderScaleOf(scene))));
  const texture = scene.add.renderTexture(0, 0, Math.ceil(width * scale), Math.ceil(height * scale)).setOrigin(0, 0);
  if (scale === 1) return texture;
  texture.camera.setOrigin(0, 0).setZoom(scale);
  return texture.setDisplaySize(width, height);
}

function isLayeredPaintPlan<Layout>(
  paint: StaticMapPaintPlan<Layout>,
): paint is StaticMapLayers<Layout> {
  return typeof paint !== "function";
}

/** Paints a layered plan in the one authoritative world order. */
export function paintStaticMapLayers<Layout>(
  context: StaticMapPaintContext<Layout>,
  layers: StaticMapLayers<Layout>,
): void {
  layers.scenery(context);
  layers.operational(context);
  layers.detail(context);
}

/**
 * Bakes the map once: terrain into one texture and, for layered plans, the airport vectors (runways,
 * markings, aprons) into a second one just above it, so things drawn between them keep their order.
 * Live vector shapes were re-triangulated every frame, the largest single cost of a busy shift on a slow
 * phone. The vectors bake at twice the render scale so their angled edges stay as smooth as live drawing.
 */
export function composeStaticMap<
  Layout extends { readonly width: number; readonly height: number },
>(
  scene: Phaser.Scene,
  layout: Layout,
  detailLevel: WorldDetailLevel,
  paint: StaticMapPaintPlan<Layout>,
  options: StaticMapComposeOptions = {},
): Phaser.GameObjects.RenderTexture {
  const graphics = scene.add.graphics();
  const texture = sceneRenderTexture(scene, layout.width, layout.height).setDepth(options.depth ?? -20);
  const sceneryTextureKey = options.sceneryTextureKey;
  const hasSceneryTexture =
    sceneryTextureKey !== undefined &&
    scene.textures?.exists(sceneryTextureKey) === true;
  const scenery = hasSceneryTexture
    ? scene.add
        .image(0, 0, sceneryTextureKey)
        .setOrigin(0, 0)
        .setDisplaySize(layout.width, layout.height)
    : undefined;

  try {
    if (scenery) texture.draw(scenery);
    const context = {
      graphics,
      layout,
      detailLevel,
      unit: Math.min(layout.width, layout.height),
    } satisfies StaticMapPaintContext<Layout>;
    if (isLayeredPaintPlan(paint)) {
      if (!scenery) paint.scenery(context);
      texture.draw(graphics);
      texture.render();
      graphics.clear();
      if (
        options.materialTextureKey &&
        scene.textures?.exists(options.materialTextureKey)
      ) {
        const material = scene.add
          .tileSprite(
            0,
            0,
            layout.width,
            layout.height,
            options.materialTextureKey,
          )
          .setOrigin(0, 0)
          .setAlpha(0.2)
          .setBlendMode(2);
        texture.draw(material);
        texture.render();
        material.destroy();
      }
      paint.operational(context);
      paint.detail(context);
      const supersample = (scene.registry?.get(VECTOR_SUPERSAMPLE_KEY) as number | undefined) ?? 2;
      const vectors = sceneRenderTexture(scene, layout.width, layout.height, supersample).setDepth((options.depth ?? -20) + 0.1);
      vectors.draw(graphics);
      vectors.render();
    } else {
      paint(context);
      texture.draw(graphics);
      texture.render();
    }
  } finally {
    scenery?.destroy();
    graphics.destroy();
  }

  return texture;
}

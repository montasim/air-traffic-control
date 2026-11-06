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

type TextureWrapperList = { readonly glTextureWrappers?: unknown[]; deleteTexture?(wrapper: unknown): void };

/**
 * Makes a dynamic texture with `make` and frees the GPU texture Phaser 4.2.1 abandons while doing so: a
 * dynamic texture allocates a full-size texture when constructed, then switches to its framebuffer's own
 * texture and never deletes the first, so every render texture held twice its memory.
 */
export function withoutAbandonedTexture<T>(scene: Phaser.Scene, make: () => T, textureOf: (made: T) => Phaser.Textures.Texture): T {
  const renderer = scene.sys?.renderer as unknown as TextureWrapperList | undefined;
  const wrappers = renderer?.glTextureWrappers;
  // The canvas renderer has no GPU textures to leak.
  if (!wrappers || !renderer.deleteTexture) return make();
  const before = new Set(wrappers);
  const made = make();
  const used = textureOf(made).source[0]?.glTexture;
  for (const wrapper of wrappers.filter((candidate) => !before.has(candidate) && candidate !== used)) renderer.deleteTexture(wrapper);
  return made;
}

export function sceneRenderTexture(scene: Phaser.Scene, width: number, height: number, supersample = 1): Phaser.GameObjects.RenderTexture {
  // Supersampling bakes at a higher scale and lets texture filtering smooth it back down: render textures
  // have no multisampling, so angled edges drawn into them at display scale come out stepped.
  const scale = renderScaleOf(scene) * Math.max(1, Math.min(supersample, MAX_BAKE_SIZE / (Math.max(width, height) * renderScaleOf(scene))));
  const texture = withoutAbandonedTexture(scene, () => scene.add.renderTexture(0, 0, Math.ceil(width * scale), Math.ceil(height * scale)), (made) => made.texture).setOrigin(0, 0);
  if (scale === 1) return texture;
  texture.camera.setOrigin(0, 0).setZoom(scale);
  return texture.setDisplaySize(width, height);
}

const baked = new WeakSet<Phaser.GameObjects.GameObject>();

/** Marks a full-screen layer that never changes once drawn, so `flattenBakedLayers` may merge it. */
export function markBaked<T extends Phaser.GameObjects.GameObject>(layer: T): T {
  baked.add(layer);
  return layer;
}

/**
 * Merges each run of baked layers that are next to each other in depth, with nothing live between them,
 * into one render texture, and frees the originals. Each full-screen layer cost the GPU a full pass every
 * frame and held its own texture (the runway layer at twice screen sharpness): a land map drew four, now one.
 * Live effects between layers (waves, ship wakes) split the runs, so they keep their place.
 */
export function flattenBakedLayers(scene: Phaser.Scene, width: number, height: number): void {
  scene.children.depthSort();
  const runs: Phaser.GameObjects.GameObject[][] = [[]];
  for (const child of scene.children.list) {
    if (baked.has(child) && (child as unknown as Phaser.GameObjects.Components.Visible).visible) runs[runs.length - 1].push(child);
    else if (runs[runs.length - 1].length) runs.push([]);
  }
  // Exactly the game canvas's pixels, so the merged layer reaches the screen one texel per pixel; any other
  // size would resample (and soften) everything in it a second time.
  const { width: pixelsWide, height: pixelsHigh } = scene.game.canvas;
  for (const layers of runs.filter((run) => run.length > 1)) {
    const merged = withoutAbandonedTexture(scene, () => scene.add.renderTexture(0, 0, pixelsWide, pixelsHigh), (made) => made.texture).setOrigin(0, 0);
    // Drawn at the main camera's own zoom, so each source lands on the same pixels it covered on screen.
    const zoom = renderScaleOf(scene);
    merged.camera.setOrigin(0, 0).setZoom(zoom);
    markBaked(merged.setDisplaySize(pixelsWide / zoom, pixelsHigh / zoom).setDepth((layers[0] as unknown as Phaser.GameObjects.Components.Depth).depth));
    merged.draw(layers);
    merged.render();
    for (const layer of layers) layer.destroy();
  }
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
  const texture = markBaked(sceneRenderTexture(scene, layout.width, layout.height).setDepth(options.depth ?? -20));
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
      const vectors = markBaked(sceneRenderTexture(scene, layout.width, layout.height, supersample).setDepth((options.depth ?? -20) + 0.1));
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

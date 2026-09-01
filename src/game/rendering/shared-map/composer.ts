import type Phaser from 'phaser';
import type { WorldDetailLevel } from '../../palette';
import type { StaticMapComposeOptions, StaticMapPainter } from './types';

/** Composes every static map layer into one native-size render texture. */
export function composeStaticMap<Layout extends { readonly width: number; readonly height: number }>(
  scene: Phaser.Scene,
  layout: Layout,
  detailLevel: WorldDetailLevel,
  paint: StaticMapPainter<Layout>,
  options: StaticMapComposeOptions = {}
): Phaser.GameObjects.RenderTexture {
  const graphics = scene.add.graphics();
  const texture = scene.add.renderTexture(0, 0, layout.width, layout.height)
    .setOrigin(0, 0)
    .setDepth(options.depth ?? -20);

  try {
    paint({
      graphics,
      layout,
      detailLevel,
      unit: Math.min(layout.width, layout.height)
    });
    texture.draw(graphics);
    texture.render();
  } finally {
    graphics.destroy();
  }

  return texture;
}


import Phaser from "phaser";
import { MAP_DEFINITIONS } from "../game/maps/registry";
import { queuePresentationAssets } from "../game/assets/presentationAssets";
import type { MapId } from "../game/maps/mapIds";
import { drawNight } from "../game/rendering/NightRenderer";
import type { WorldDetailLevel } from "../game/palette";

/**
 * One disposable renderer produces accurate thumbnails from the real map renderers. They are
 * drawn at the world size and detail level a new shift would get, because layouts change with
 * size (which apron end a building takes, for one), so a fixed size could show a mirrored map.
 * Like the game on a sharp screen, they draw at twice the density (camera zoom), then shrink in
 * halving steps so thin runway markings stay smooth instead of breaking up in one big downscale.
 */
const DENSITY = 2;
/** Longest side of a finished picture: enough for the largest preview box on a sharp screen. */
const OUTPUT_SIZE = 960;

function shrink(image: HTMLImageElement, width: number, height: number): string {
  const scale = Math.min(1, OUTPUT_SIZE / Math.max(width, height));
  const target = { width: Math.round(width * scale), height: Math.round(height * scale) };
  let source: CanvasImageSource = image;
  let size = { width: image.width, height: image.height };
  // Halve until one more halving would pass the target, then make the last, smaller step.
  while (size.width / 2 >= target.width) {
    const step = document.createElement("canvas");
    step.width = Math.round(size.width / 2);
    step.height = Math.round(size.height / 2);
    const context = step.getContext("2d")!;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, step.width, step.height);
    source = step;
    size = { width: step.width, height: step.height };
  }
  const output = document.createElement("canvas");
  output.width = target.width;
  output.height = target.height;
  const context = output.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, target.width, target.height);
  return output.toDataURL("image/webp", 0.9);
}

export function createMapPreviews(
  /** `focus` is where the airfield sits, as fractions of the picture, for cropping it into a different shape. */
  onPreview: (id: MapId, url: string, focus: { readonly x: number; readonly y: number }) => void,
  options: {
    readonly night: boolean;
    readonly twoEndLanding: boolean;
    readonly world: { readonly width: number; readonly height: number };
    readonly detailLevel: WorldDetailLevel;
    readonly first?: MapId;
  },
): () => void {
  const WIDTH = Math.round(options.world.width);
  const HEIGHT = Math.round(options.world.height);
  // The selected airfield first, so its picture follows a settings change without a wait.
  const maps = [...MAP_DEFINITIONS].sort((a, b) => Number(b.id === options.first) - Number(a.id === options.first));
  const host = document.createElement("div");
  host.style.cssText =
    `position:fixed;left:-${WIDTH * DENSITY + 100}px;top:0;width:${WIDTH * DENSITY}px;height:${HEIGHT * DENSITY}px;pointer-events:none`;
  host.setAttribute("aria-hidden", "true");
  document.body.append(host);
  let index = 0;
  let stopped = false;
  class PreviewScene extends Phaser.Scene {
    preload(): void {
      for (const map of maps)
        queuePresentationAssets(this, { mapId: map.id, variant: "landscape" });
    }
    create(): void {
      this.paintNext();
    }
    paintNext(): void {
      if (stopped) return;
      const map = maps[index];
      if (!map) {
        cleanup();
        return;
      }
      this.children.removeAll(true);
      // The renderers read the camera zoom as their render scale, exactly as in PlayScene.
      this.cameras.main.setZoom(DENSITY).centerOn(WIDTH / 2, HEIGHT / 2);
      const prepared = map.prepare({ width: WIDTH, height: HEIGHT, detailLevel: options.detailLevel, twoEndLanding: options.twoEndLanding });
      map.render(this, prepared);
      if (options.night) drawNight(this, prepared.layout);
      const zones = prepared.layout.landingZones;
      const focus = zones.length
        ? { x: zones.reduce((sum, zone) => sum + zone.position.x, 0) / zones.length / WIDTH, y: zones.reduce((sum, zone) => sum + zone.position.y, 0) / zones.length / HEIGHT }
        : { x: 0.5, y: 0.5 };
      this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
        this.game.renderer.snapshot((image) => {
          if (stopped) return;
          if (image instanceof HTMLImageElement) onPreview(map.id, shrink(image, WIDTH, HEIGHT), focus);
          index += 1;
          this.time.delayedCall(0, () => this.paintNext());
        }, "image/jpeg", 0.95);
      });
    }
  }
  const previewGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    width: WIDTH * DENSITY,
    height: HEIGHT * DENSITY,
    audio: { noAudio: true },
    scene: PreviewScene,
    banner: false,
  });
  function cleanup(): void {
    stopped = true;
    previewGame.destroy(true);
    host.remove();
  }
  return cleanup;
}

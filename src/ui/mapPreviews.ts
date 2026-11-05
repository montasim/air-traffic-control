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
 * JPEG keeps twelve of them light in memory.
 */
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
    `position:fixed;left:-${WIDTH + 100}px;top:0;width:${WIDTH}px;height:${HEIGHT}px;pointer-events:none`;
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
          if (image instanceof HTMLImageElement) onPreview(map.id, image.src, focus);
          index += 1;
          this.time.delayedCall(0, () => this.paintNext());
        }, "image/jpeg", 0.85);
      });
    }
  }
  const previewGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    width: WIDTH,
    height: HEIGHT,
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

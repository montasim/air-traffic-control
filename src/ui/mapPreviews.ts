import Phaser from "phaser";
import { MAP_DEFINITIONS } from "../game/maps/registry";
import { queuePresentationAssets } from "../game/assets/presentationAssets";
import type { MapId } from "../game/maps/mapIds";
import { drawNight } from "../game/rendering/NightRenderer";

// Drawn at a desktop size so thumbnails show the layout most screens get; small sizes use a
// tighter fallback for buildings and stands. JPEG keeps twelve of them light in memory.
const WIDTH = 1280;
const HEIGHT = 720;

/** One disposable renderer produces accurate thumbnails from the real map renderers. */
export function createMapPreviews(
  onPreview: (id: MapId, url: string) => void,
  options: { readonly night: boolean; readonly twoEndLanding: boolean; readonly first?: MapId },
): () => void {
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
      const prepared = map.prepare({ width: WIDTH, height: HEIGHT, detailLevel: "mobile", twoEndLanding: options.twoEndLanding });
      map.render(this, prepared);
      if (options.night) drawNight(this, prepared.layout);
      this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
        this.game.renderer.snapshot((image) => {
          if (stopped) return;
          if (image instanceof HTMLImageElement) onPreview(map.id, image.src);
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

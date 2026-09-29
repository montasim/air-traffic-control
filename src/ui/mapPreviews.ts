import Phaser from "phaser";
import { MAP_DEFINITIONS } from "../game/maps/registry";
import { queuePresentationAssets } from "../game/assets/presentationAssets";
import type { MapId } from "../game/maps/mapIds";

/** One disposable renderer produces accurate thumbnails from the real map renderers. */
export function createMapPreviews(
  onPreview: (id: MapId, url: string) => void,
): () => void {
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-2000px;top:0;width:640px;height:360px;pointer-events:none";
  host.setAttribute("aria-hidden", "true");
  document.body.append(host);
  let index = 0;
  let stopped = false;
  class PreviewScene extends Phaser.Scene {
    preload(): void {
      for (const map of MAP_DEFINITIONS)
        queuePresentationAssets(this, { mapId: map.id, variant: "landscape" });
    }
    create(): void {
      this.paintNext();
    }
    paintNext(): void {
      if (stopped) return;
      const map = MAP_DEFINITIONS[index];
      if (!map) {
        cleanup();
        return;
      }
      this.children.removeAll(true);
      map.render(
        this,
        map.prepare({ width: 640, height: 360, detailLevel: "mobile" }),
      );
      this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
        this.game.renderer.snapshot((image) => {
          if (stopped) return;
          if (image instanceof HTMLImageElement) onPreview(map.id, image.src);
          index += 1;
          this.time.delayedCall(0, () => this.paintNext());
        });
      });
    }
  }
  const previewGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    width: 640,
    height: 360,
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

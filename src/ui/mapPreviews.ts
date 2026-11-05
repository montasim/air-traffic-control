import Phaser from "phaser";
import { MAP_DEFINITIONS } from "../game/maps/registry";
import { queuePresentationAssets } from "../game/assets/presentationAssets";
import type { MapId } from "../game/maps/mapIds";
import { drawNight } from "../game/rendering/NightRenderer";
import { releaseCanvas } from "../game/rendering/shared-map/surfaceTexture";
import type { WorldDetailLevel } from "../game/palette";
import type { LandingZone } from "../core/types";

/**
 * One disposable renderer produces accurate thumbnails from the real map renderers. They are
 * drawn at the world size and detail level a new shift would get, because layouts change with
 * size (which apron end a building takes, for one), so a fixed size could show a mirrored map.
 * On desktop they draw at twice the density (camera zoom), then shrink in halving steps so thin
 * runway markings stay smooth instead of breaking up in one big downscale. Phones and tablets draw
 * at single density: their tall world is already about twice the finished picture, and a doubled
 * one (1800x3900 on an iPhone) runs Safari out of memory.
 */
const densityFor = (detailLevel: WorldDetailLevel) => (detailLevel === "desktop" ? 2 : 1);
/** Longest side of a finished picture: enough for the largest preview box on a sharp screen. */
const OUTPUT_SIZE = 960;

/** A finished picture of a world-sized frame (any render scale), as a compact data URL. */
export function shrink(image: HTMLCanvasElement, width: number, height: number): string {
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
    if (source !== image) releaseCanvas(source as HTMLCanvasElement);
    source = step;
    size = { width: step.width, height: step.height };
  }
  const output = document.createElement("canvas");
  output.width = target.width;
  output.height = target.height;
  const context = output.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, target.width, target.height);
  if (source !== image) releaseCanvas(source as HTMLCanvasElement);
  // JPEG: the pictures are opaque, and Safari has no WebP encoder, so asking for one gets a large, slow PNG.
  const url = output.toDataURL("image/jpeg", 0.88);
  releaseCanvas(output);
  return url;
}

/** Where the airfield sits in a picture, as fractions of it: the middle of its landing areas. */
export function airfieldFocus(zones: readonly LandingZone[], width: number, height: number): { readonly x: number; readonly y: number } {
  return zones.length
    ? { x: zones.reduce((sum, zone) => sum + zone.position.x, 0) / zones.length / width, y: zones.reduce((sum, zone) => sum + zone.position.y, 0) / zones.length / height }
    : { x: 0.5, y: 0.5 };
}

/** What a set of pictures is drawn for: the settings and world a new shift would get. */
export interface PreviewSettings {
  readonly night: boolean;
  readonly weather: boolean;
  readonly twoEndLanding: boolean;
  readonly world: { readonly width: number; readonly height: number };
  readonly detailLevel: WorldDetailLevel;
}

/** Draws pictures of `maps`, in that order, then calls `onDone`; the returned function stops early. */
export function createMapPreviews(
  /** `focus` is where the airfield sits, as fractions of the picture, for cropping it into a different shape. */
  onPreview: (id: MapId, url: string, focus: { readonly x: number; readonly y: number }) => void,
  options: PreviewSettings & { readonly maps: readonly MapId[]; readonly onDone?: () => void },
): () => void {
  const WIDTH = Math.round(options.world.width);
  const HEIGHT = Math.round(options.world.height);
  const DENSITY = densityFor(options.detailLevel);
  const maps = options.maps.map((id) => MAP_DEFINITIONS.find((map) => map.id === id)!);
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
        options.onDone?.();
        return;
      }
      // Destroyed, not just removed (removeAll's flag only skips callbacks): each map's textures and
      // full-size canvases must go before the next is drawn, or twelve maps pile up on a phone.
      for (const child of [...this.children.list]) child.destroy();
      // The renderers read the camera zoom as their render scale, exactly as in PlayScene.
      this.cameras.main.setZoom(DENSITY).centerOn(WIDTH / 2, HEIGHT / 2);
      const prepared = map.prepare({ width: WIDTH, height: HEIGHT, detailLevel: options.detailLevel, twoEndLanding: options.twoEndLanding });
      map.render(this, prepared);
      if (options.night) drawNight(this, prepared.layout);
      // Time of day and weather reach the drifting clouds the same way as in a shift.
      this.events.emit("night-mode", options.night);
      this.events.emit("weather-mode", options.weather);
      const focus = airfieldFocus(prepared.layout.landingZones, WIDTH, HEIGHT);
      // Shrunk straight from the frame just drawn: a renderer snapshot would add a full-size canvas
      // and a full-size JPEG for every map, more than iOS Safari can hold.
      this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
        if (stopped) return;
        onPreview(map.id, shrink(this.game.canvas, WIDTH, HEIGHT), focus);
        index += 1;
        this.time.delayedCall(0, () => this.paintNext());
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

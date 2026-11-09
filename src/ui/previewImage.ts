import type { LandingZone } from "../core/types";
function releaseCanvas(canvas: HTMLCanvasElement) { canvas.width = canvas.height = 0; }
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

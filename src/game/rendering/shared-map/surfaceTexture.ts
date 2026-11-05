import type Phaser from "phaser";
import type { LandingZone, Vector2 } from "../../../core/types";
import type { MapRunway, MapTaxiway } from "../../maps/shared/airfield";
import type { MapBuilding } from "./airfieldPainter";
import { buildingCenterClearOfRunways, rotatedRectangle } from "./geometry";
import { renderScaleOf } from "./composer";

/** What the surface texture needs from a map: its paved shapes and where aircraft touch down. */
export interface SurfaceLayout {
  readonly width: number;
  readonly height: number;
  readonly runways: readonly MapRunway[];
  readonly taxiways: readonly MapTaxiway[];
  readonly apron: readonly Vector2[];
  readonly landingZones: readonly LandingZone[];
  /** Raised buildings and the helipad keep their own finish, so the texture stays off them. */
  readonly buildings?: readonly MapBuilding[];
  readonly helipad?: { readonly center: Vector2; readonly radius: number };
}

let serial = 0;

/** A square of random light and dark pixels with random alpha: fine grain. */
function noiseTile(size: number, strength: number, light = [255, 255, 255], dark = [0, 0, 0]): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const [r, g, b] = Math.random() < 0.5 ? light : dark;
    image.data[i] = r;
    image.data[i + 1] = g;
    image.data[i + 2] = b;
    image.data[i + 3] = Math.random() * strength * 255;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function fillWith(context: CanvasRenderingContext2D, tile: HTMLCanvasElement, scale: number, width: number, height: number): void {
  const pattern = context.createPattern(tile, "repeat")!;
  pattern.setTransform(new DOMMatrix().scale(scale));
  context.fillStyle = pattern;
  context.fillRect(0, 0, width, height);
}

/** Paints a mask shape (runway rectangles, apron polygon, taxiway strokes) in solid black. */
function paved(context: CanvasRenderingContext2D, layout: SurfaceLayout, which: "asphalt" | "concrete"): void {
  context.fillStyle = context.strokeStyle = "#000";
  if (which === "concrete") {
    context.beginPath();
    layout.apron.forEach((point, index) => (index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)));
    context.closePath();
    context.fill();
    return;
  }
  for (const runway of layout.runways) {
    context.save();
    context.translate(runway.center.x, runway.center.y);
    context.rotate(runway.angle);
    context.fillRect(-runway.length / 2, -runway.width / 2, runway.length, runway.width);
    context.restore();
  }
  context.lineJoin = "round";
  for (const taxiway of layout.taxiways) {
    context.lineWidth = taxiway.width;
    context.beginPath();
    taxiway.path.forEach((point, index) => (index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)));
    context.stroke();
  }
}

/** A layer cut to one surface: the surface's own texture kept only inside (or outside) its mask. */
function surfaceLayer(layout: SurfaceLayout, scale: number, paint: (context: CanvasRenderingContext2D) => void, mask: (context: CanvasRenderingContext2D) => void, keep: "inside" | "outside"): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(layout.width * scale);
  canvas.height = Math.ceil(layout.height * scale);
  const context = canvas.getContext("2d")!;
  context.scale(scale, scale);
  paint(context);
  // Draw every mask shape first and cut once: cutting shape by shape with destination-in
  // would keep only the last shape (one taxiway), leaving the runways bare.
  const stencil = document.createElement("canvas");
  stencil.width = canvas.width;
  stencil.height = canvas.height;
  const stencilContext = stencil.getContext("2d")!;
  stencilContext.scale(scale, scale);
  mask(stencilContext);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = keep === "inside" ? "destination-in" : "destination-out";
  context.drawImage(stencil, 0, 0);
  return canvas;
}

/**
 * Asphalt and concrete texture for a map, drawn once into one image above the map art
 * and below aircraft and the night layer: fine grain and touchdown rubber on runways and
 * taxiways, and grain with slab joints on the apron.
 */
export function paintSurfaceTexture(scene: Phaser.Scene, layout: SurfaceLayout, depth = -19.85): Phaser.GameObjects.Image | undefined {
  if (typeof document === "undefined" || !scene.textures) return undefined;
  const { width, height } = layout;
  const unit = Math.min(width, height);
  const scale = renderScaleOf(scene);
  const angle = layout.runways[0]?.angle ?? 0;
  const grain = noiseTile(96, 0.07);

  const asphalt = surfaceLayer(layout, scale, (context) => {
    // The same fine grain as the apron, without the blotchy mottling that read as dirt.
    fillWith(context, grain, 1, width, height);
    // Slab joints like the apron's, square to each runway: lanes along it, joints across it.
    for (const runway of layout.runways) {
      context.save();
      context.translate(runway.center.x, runway.center.y);
      context.rotate(runway.angle);
      context.beginPath();
      context.rect(-runway.length / 2, -runway.width / 2, runway.length, runway.width);
      context.clip();
      context.strokeStyle = "rgba(20,24,26,0.28)";
      context.lineWidth = Math.max(1, unit * 0.0015);
      const slab = unit * 0.035;
      context.beginPath();
      for (let along = -runway.length / 2 + slab; along < runway.length / 2; along += slab) {
        context.moveTo(along, -runway.width / 2); context.lineTo(along, runway.width / 2);
      }
      for (let across = -runway.width / 2 + runway.width / 4; across < runway.width / 2 - 1; across += runway.width / 4) {
        context.moveTo(-runway.length / 2, across); context.lineTo(runway.length / 2, across);
      }
      context.stroke();
      context.restore();
    }
    // Rubber left by main gear where aircraft touch down, fading along the landing direction.
    for (const zone of layout.landingZones) {
      if (!zone.approach) continue;
      const runway = layout.runways.find((item) => item.id === zone.approach!.runwayId);
      if (!runway) continue;
      context.save();
      context.translate(zone.position.x, zone.position.y);
      context.rotate(zone.angle);
      for (const side of [-1, 1]) {
        const streak = context.createLinearGradient(-runway.width * 0.4, 0, runway.length * 0.16, 0);
        streak.addColorStop(0, "rgba(20,24,26,0)");
        streak.addColorStop(0.2, "rgba(20,24,26,0.22)");
        streak.addColorStop(1, "rgba(20,24,26,0)");
        context.fillStyle = streak;
        context.fillRect(-runway.width * 0.4, side * runway.width * 0.16 - runway.width * 0.07, runway.length * 0.16 + runway.width * 0.4, runway.width * 0.14);
      }
      context.restore();
    }
  }, (context) => paved(context, layout, "asphalt"), "inside");

  const concrete = surfaceLayer(layout, scale, (context) => {
    fillWith(context, grain, 1, width, height);
    // Slab joints in a grid square to the runways.
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate(angle);
    context.strokeStyle = "rgba(40,48,48,0.16)";
    context.lineWidth = Math.max(1, unit * 0.0015);
    const slab = unit * 0.035;
    const reach = Math.hypot(width, height);
    context.beginPath();
    for (let v = -reach; v < reach; v += slab) {
      context.moveTo(v, -reach); context.lineTo(v, reach);
      context.moveTo(-reach, v); context.lineTo(reach, v);
    }
    context.stroke();
    context.restore();
  }, (context) => paved(context, layout, "concrete"), "inside");
  const concreteContext = concrete.getContext("2d")!;
  concreteContext.globalCompositeOperation = "destination-out";
  concreteContext.fillStyle = "#000";
  for (const building of layout.buildings ?? []) {
    // The footprint plus the roof lifted above it, as paintRaisedBuilding draws them.
    const centre = buildingCenterClearOfRunways(building.center, building.width, building.height, layout.runways);
    const lift = unit * (building.kind === "hangar" ? 0.02 : building.kind === "terminal" ? 0.016 : 0.012) * 0.55;
    for (const shift of [0, lift / 2, lift]) {
      concreteContext.beginPath();
      rotatedRectangle({ x: centre.x, y: centre.y - shift }, building.width + 2, building.height + 2, building.angle)
        .forEach((point, index) => (index ? concreteContext.lineTo(point.x, point.y) : concreteContext.moveTo(point.x, point.y)));
      concreteContext.closePath();
      concreteContext.fill();
    }
  }
  if (layout.helipad) {
    concreteContext.beginPath();
    concreteContext.arc(layout.helipad.center.x, layout.helipad.center.y, layout.helipad.radius, 0, Math.PI * 2);
    concreteContext.fill();
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext("2d")!;
  for (const layer of [asphalt, concrete]) context.drawImage(layer, 0, 0);

  const key = `surface-texture-${serial += 1}`;
  scene.textures.addCanvas(key, canvas);
  const image = scene.add.image(0, 0, key).setOrigin(0, 0).setDisplaySize(width, height).setDepth(depth);
  image.once("destroy", () => scene.textures.remove(key));
  return image;
}

const rgb = (color: number) => [(color >> 16) & 255, (color >> 8) & 255, color & 255];
const css = (color: number) => `rgb(${rgb(color).join(",")})`;

/** What the painted ground needs: the field patchwork. */
export interface GroundLayout {
  readonly width: number;
  readonly height: number;
  readonly fieldPolygons: readonly (readonly Vector2[])[];
}

/**
 * The ground under all map scenery, painted once at the render scale: a base colour, a
 * patchwork of flat fields in a few close shades, fine grass speckle, and soft light falloff.
 */
export function paintGroundTexture(
  scene: Phaser.Scene,
  ground: GroundLayout,
  shades: { readonly base: number; readonly fields: readonly number[]; readonly light: number; readonly dark: number },
  depth = -21,
): Phaser.GameObjects.Image | undefined {
  if (typeof document === "undefined" || !scene.textures) return undefined;
  const { width, height } = ground;
  const unit = Math.min(width, height);
  const scale = renderScaleOf(scene);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext("2d")!;
  context.scale(scale, scale);
  context.fillStyle = css(shades.base);
  context.fillRect(0, 0, width, height);
  // Flat fields with crisp edges, drawn like the paved shapes so the ground is as sharp as they are.
  ground.fieldPolygons.forEach((field, index) => {
    context.fillStyle = css(shades.fields[index % shades.fields.length]);
    context.beginPath();
    field.forEach((point, i) => (i ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)));
    context.closePath();
    context.fill();
  });
  // Fine grass: soft speckles a couple of pixels wide in the ground's own greens, never grey.
  fillWith(context, noiseTile(128, 0.16, rgb(shades.light), rgb(shades.dark)), 2, width, height);
  // Soft light falloff: brighter where the airfield sits, gently darker toward the edges.
  const light = context.createRadialGradient(width / 2, height / 2, unit * 0.1, width / 2, height / 2, Math.hypot(width, height) / 2);
  light.addColorStop(0, "rgba(255,255,240,0.10)");
  light.addColorStop(0.55, "rgba(255,255,240,0)");
  light.addColorStop(1, "rgba(20,40,30,0.18)");
  context.fillStyle = light;
  context.fillRect(0, 0, width, height);
  const key = `ground-texture-${serial += 1}`;
  scene.textures.addCanvas(key, canvas);
  const image = scene.add.image(0, 0, key).setOrigin(0, 0).setDisplaySize(width, height).setDepth(depth);
  image.once("destroy", () => scene.textures.remove(key));
  return image;
}

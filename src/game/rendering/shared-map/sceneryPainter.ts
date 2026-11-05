import type Phaser from "phaser";
import type { Vector2 } from "../../../core/types";
import { tracePolygon } from "./geometry";

const centroid = (points: readonly Vector2[]): Vector2 =>
  points.reduce((sum, p) => ({ x: sum.x + p.x / points.length, y: sum.y + p.y / points.length }), { x: 0, y: 0 });
const toward = (points: readonly Vector2[], k: number): Vector2[] => {
  const c = centroid(points);
  return points.map((p) => ({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k }));
};

/**
 * A slate rock ridge as low-poly facets: each face runs from the outline up to
 * a ridge line along the rock's long axis and is shaded by how it faces the
 * north-west light, with snow lying on the lit faces.
 */
export function paintRockRidge(graphics: Phaser.GameObjects.Graphics, ridge: readonly Vector2[], unit: number): void {
  graphics.fillStyle(0x23384a, 0.3);
  tracePolygon(graphics, ridge.map((p) => ({ x: p.x + unit * 0.008, y: p.y + unit * 0.012 })));
  graphics.fillPath();
  graphics.fillStyle(0x4a6276, 1);
  tracePolygon(graphics, ridge);
  graphics.fillPath();
  // The ridge line joins points part-way toward the two outline vertices farthest apart.
  const c = centroid(ridge);
  let [far1, far2] = [ridge[0], ridge[1]];
  for (const a of ridge) for (const b of ridge) {
    if (Math.hypot(a.x - b.x, a.y - b.y) > Math.hypot(far1.x - far2.x, far1.y - far2.y)) [far1, far2] = [a, b];
  }
  const lift = { x: -unit * 0.006, y: -unit * 0.008 };
  const spine = [far1, far2].map((end) => ({ x: c.x + (end.x - c.x) * 0.5 + lift.x, y: c.y + (end.y - c.y) * 0.5 + lift.y }));
  const light = { x: -0.6, y: -0.8 };
  for (let i = 0; i < ridge.length; i += 1) {
    const [a, b] = [ridge[i], ridge[(i + 1) % ridge.length]];
    const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const near = (p: Vector2) => Math.hypot(p.x - middle.x, p.y - middle.y);
    const peak = near(spine[0]) <= near(spine[1]) ? spine[0] : spine[1];
    // Outward normal of this face's base edge decides how much light it catches.
    const normal = { x: b.y - a.y, y: -(b.x - a.x) };
    const length = Math.hypot(normal.x, normal.y) || 1;
    const lit = (normal.x * light.x + normal.y * light.y) / length;
    // Slate blue, the shaded faces near navy, as in a cold northern light.
    graphics.fillStyle(lit > 0.35 ? 0x6f879a : lit > -0.2 ? 0x4a6276 : 0x33475a, 1);
    tracePolygon(graphics, [a, b, peak]);
    graphics.fillPath();
    if (lit > 0.35) {
      graphics.fillStyle(0xf1f6f7, 0.7);
      tracePolygon(graphics, [toward([a, peak], 0.2)[1], toward([b, peak], 0.2)[1], peak]);
      graphics.fillPath();
    }
  }
}

/** A snow-laden pine seen from above: a muted green crown with a white cap offset toward the light. */
export function paintSnowyPine(graphics: Phaser.GameObjects.Graphics, center: Vector2, radius: number, index: number): void {
  graphics.fillStyle(0x51707a, 0.16);
  graphics.fillCircle(center.x + radius * 0.35, center.y + radius * 0.45, radius);
  graphics.fillStyle(index % 3 === 0 ? 0x6f8f80 : 0x5c7d6d, 0.85);
  graphics.fillCircle(center.x, center.y, radius);
  graphics.fillStyle(0xf2f7f7, 0.8);
  graphics.fillCircle(center.x - radius * 0.25, center.y - radius * 0.28, radius * 0.55);
}

/** A small sandbar islet: a pale beach ring around a scrub-green middle. */
export function paintIslet(graphics: Phaser.GameObjects.Graphics, outline: readonly Vector2[]): void {
  graphics.fillStyle(0xbfe2ea, 0.45);
  tracePolygon(graphics, toward(outline, 1.18));
  graphics.fillPath();
  graphics.fillStyle(0xe2cf9f, 1);
  tracePolygon(graphics, outline);
  graphics.fillPath();
  graphics.fillStyle(0x93a865, 0.85);
  tracePolygon(graphics, toward(outline, 0.55));
  graphics.fillPath();
}

/** Faint whitecaps scattered over open water, skipping anything `keep` rejects. */
export function paintWhitecaps(
  graphics: Phaser.GameObjects.Graphics,
  bounds: { readonly width: number; readonly height: number },
  count: number,
  unit: number,
  keep: (point: Vector2) => boolean,
): void {
  graphics.fillStyle(0xf4fbfb, 0.32);
  for (let i = 0; i < count; i += 1) {
    const a = Math.sin((i + 1) * 91.73) * 43758.5453;
    const b = Math.sin((i + 1) * 37.71 + 11) * 43758.5453;
    const point = { x: (a - Math.floor(a)) * bounds.width, y: (b - Math.floor(b)) * bounds.height };
    if (!keep(point)) continue;
    graphics.fillEllipse(point.x, point.y, unit * 0.012, unit * 0.004);
  }
}

/** Broad, soft swell bands across the sea, aligned to `angle`. */
export function paintSwellBands(
  graphics: Phaser.GameObjects.Graphics,
  bounds: { readonly width: number; readonly height: number },
  angle: number,
  color: number,
  unit: number,
): void {
  const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
  const [nx, ny] = [-dy, dx];
  const reach = Math.hypot(bounds.width, bounds.height);
  const center = { x: bounds.width / 2, y: bounds.height / 2 };
  graphics.fillStyle(color, 0.12);
  for (let offset = -reach / 2; offset < reach / 2; offset += unit * 0.22) {
    const band = [
      { x: center.x + nx * offset - dx * reach, y: center.y + ny * offset - dy * reach },
      { x: center.x + nx * offset + dx * reach, y: center.y + ny * offset + dy * reach },
      { x: center.x + nx * (offset + unit * 0.08) + dx * reach, y: center.y + ny * (offset + unit * 0.08) + dy * reach },
      { x: center.x + nx * (offset + unit * 0.08) - dx * reach, y: center.y + ny * (offset + unit * 0.08) - dy * reach },
    ];
    tracePolygon(graphics, band);
    graphics.fillPath();
  }
}

let waveSerial = 0;

/** One seamless tile of soft wave crests: short pale arcs, wrapped across the edges so it repeats invisibly. */
function waveTile(scene: Phaser.Scene, size: number, crests: number, seed: number): string {
  const key = `wave-tile-${(waveSerial += 1)}`;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  context.lineCap = "round";
  for (let i = 0; i < crests; i += 1) {
    const noise = (salt: number) => {
      const value = Math.sin((i + 1) * 12.9898 + (seed + salt) * 78.233) * 43758.5453;
      return value - Math.floor(value);
    };
    const [x, y] = [noise(1) * size, noise(2) * size];
    const span = size * (0.08 + noise(3) * 0.12);
    context.strokeStyle = `rgba(232,246,248,${0.35 + noise(4) * 0.45})`;
    context.lineWidth = 1.2 + noise(5) * 1.6;
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      context.beginPath();
      // Crests run across the tile's x axis, the direction the waves travel.
      context.moveTo(x + dx, y + dy - span / 2);
      context.quadraticCurveTo(x + dx + span * 0.18, y + dy, x + dx, y + dy + span / 2);
      context.stroke();
    }
  }
  scene.textures.addCanvas(key, canvas);
  return key;
}

/**
 * Wave crests that drift slowly across open water along `angle`, in two layers at different scales
 * and speeds so the sea seems to move. Drawn between the painted ground and the scenery, so ships
 * and wakes ride on top; held still when the player prefers reduced motion.
 */
export function addMovingWaves(scene: Phaser.Scene, bounds: { readonly width: number; readonly height: number }, angle: number, depth = -20.5): void {
  if (typeof document === "undefined" || !scene.textures || !scene.add?.tileSprite) return;
  const reach = Math.hypot(bounds.width, bounds.height);
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const layers = [
    { size: 240, crests: 18, seed: 3, alpha: 0.34, speed: 9, scale: 1 },
    { size: 320, crests: 10, seed: 7, alpha: 0.22, speed: 4.5, scale: 1.7 },
  ].map((layer) => {
    const key = waveTile(scene, layer.size, layer.crests, layer.seed);
    const sprite = scene.add.tileSprite(bounds.width / 2, bounds.height / 2, reach / layer.scale, reach / layer.scale, key)
      .setScale(layer.scale).setRotation(angle).setAlpha(layer.alpha).setDepth(depth);
    sprite.once("destroy", () => scene.textures.remove(key));
    return { sprite, layer };
  });
  if (still) return;
  let clock = 0;
  const step = (_time: number, delta: number) => {
    clock += delta / 1000;
    for (const [index, { sprite, layer }] of layers.entries()) {
      sprite.tilePositionX = -clock * layer.speed;
      // A slow rise and fall in strength, out of step between the layers, like passing swells.
      sprite.setAlpha(layer.alpha * (0.75 + 0.25 * Math.sin(clock * 0.6 + index * 2)));
    }
  };
  scene.events.on("update", step);
  scene.events.once("shutdown", () => scene.events.off("update", step));
}

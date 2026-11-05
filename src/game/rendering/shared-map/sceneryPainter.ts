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

/** A ship the moving wash follows: its centre, heading from stern to bow, length, and half its beam at the waterline. */
export interface WashingShip {
  readonly center: Vector2;
  readonly angle: number;
  readonly length: number;
  readonly halfBeam: number;
}

/**
 * Moving foam around ships under way: spray peeling off each bow and running aft along both
 * sides, and churned water streaming out behind each stern and spreading as it fades. Redrawn
 * every frame just above the scenery, so it sits over the painted wakes and under the decks;
 * drawn once, still, when the player prefers reduced motion.
 */
export function addShipWash(scene: Phaser.Scene, ships: readonly WashingShip[], depth = -19.95): void {
  if (!scene.add?.graphics || !ships.length) return;
  const graphics = scene.add.graphics().setDepth(depth);
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const noise = (index: number, salt: number) => {
    const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };
  const draw = (seconds: number) => {
    graphics.clear();
    for (const ship of ships) {
      const [cos, sin] = [Math.cos(ship.angle), Math.sin(ship.angle)];
      const at = (along: number, across: number) => ({ x: ship.center.x + along * cos - across * sin, y: ship.center.y + along * sin + across * cos });
      const fleck = Math.max(1.4, ship.length * 0.006);
      // Bow spray: each fleck is born at the stem and is carried aft and outward along the hull.
      for (let i = 0; i < 36; i += 1) {
        const phase = (seconds * 0.3 + noise(i, 11)) % 1;
        const side = i % 2 ? 1 : -1;
        const along = ship.length * (0.52 - phase * 0.85);
        const across = side * ship.halfBeam * (Math.min(1, phase * 4) * 1.05 + phase * 0.9 + noise(i, 13) * 0.15);
        const point = at(along, across);
        graphics.fillStyle(0xf2f9fa, 0.7 * (1 - phase));
        graphics.fillEllipse(point.x, point.y, fleck * (2.6 + phase * 2.4), fleck * (1.2 + phase));
      }
      // Stern wash: churned water leaving the stern, spreading and thinning as it drifts astern.
      for (let i = 0; i < 34; i += 1) {
        const phase = (seconds * 0.22 + noise(i, 17)) % 1;
        const along = -ship.length * (0.5 + phase * 1.4);
        const across = (noise(i, 19) - 0.5) * ship.halfBeam * (1.4 + phase * 3.2);
        const point = at(along, across);
        graphics.fillStyle(0xf2f9fa, 0.5 * (1 - phase));
        graphics.fillEllipse(point.x, point.y, fleck * (3.4 + phase * 3), fleck * (1.6 + phase * 1.4));
      }
    }
  };
  draw(2.5);
  if (still) return;
  let clock = 2.5;
  const step = (_time: number, delta: number) => {
    clock += delta / 1000;
    draw(clock);
  };
  scene.events.on("update", step);
  scene.events.once("shutdown", () => scene.events.off("update", step));
}


let cloudSerial = 0;

/** Cloud texture size; clouds are scaled from this. */
const CLOUD_SIZE = { width: 512, height: 320 };

/**
 * One cumulus seen from above: a cluster of billows grown outward from the middle, each drawn as a
 * grey-blue shaded underside offset away from the light, a white body over it, and a bright cap
 * toward the north-west sun, so the cloud has volume and soft cauliflower edges.
 */
function cloudTexture(scene: Phaser.Scene, seed: number): string {
  const key = `cloud-${(cloudSerial += 1)}`;
  const { width, height } = CLOUD_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  const noise = (index: number, salt: number) => {
    const value = Math.sin((index + 1) * 12.9898 + (seed + salt) * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };
  // Each seed its own build: how many billows, how wide and deep the cloud spreads, and whether
  // it is one heap or a few separate puffs drifting together.
  const count = 16 + Math.floor(noise(0, 11) * 26);
  const [spreadX, spreadY] = [0.2 + noise(0, 12) * 0.2, 0.1 + noise(0, 13) * 0.18];
  const groups = Array.from({ length: 1 + Math.floor(noise(0, 14) * 3) }, (_, g) => ({
    x: width * (0.5 + (g ? (noise(g, 15) - 0.5) * 0.5 : 0)),
    y: height * (0.5 + (g ? (noise(g, 16) - 0.5) * 0.35 : 0)),
    weight: g ? 0.55 : 1,
  }));
  // Billows: a few big ones near each group's middle, smaller ones spreading toward a ragged rim.
  const billows = Array.from({ length: count }, (_, i) => {
    const group = groups[i % groups.length];
    const angle = noise(i, 1) * Math.PI * 2;
    const reach = Math.sqrt(noise(i, 2));
    const r = height * (0.2 - reach * 0.12) * (0.75 + noise(i, 3) * 0.5) * group.weight;
    return { x: group.x + Math.cos(angle) * reach * width * spreadX * group.weight, y: group.y + Math.sin(angle) * reach * height * spreadY * 1.4 * group.weight, r };
  }).sort((p, q) => q.r - p.r);
  const puff = (x: number, y: number, r: number, inner: string, outer: string, hardness: number) => {
    const gradient = context.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(hardness, inner);
    gradient.addColorStop(1, outer);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  };
  // Shaded undersides first, offset down-right, away from the light.
  for (const { x, y, r } of billows) puff(x + r * 0.22, y + r * 0.28, r, "rgba(168,184,198,0.9)", "rgba(168,184,198,0)", 0.55);
  // White bodies over them, leaving the shade showing along each billow's lower-right edge.
  for (const { x, y, r } of billows) puff(x - r * 0.06, y - r * 0.08, r * 0.92, "rgba(250,252,253,0.97)", "rgba(250,252,253,0)", 0.62);
  // Sunlit caps on the larger billows.
  for (const { x, y, r } of billows.slice(0, 14)) puff(x - r * 0.28, y - r * 0.32, r * 0.45, "rgba(255,255,255,0.9)", "rgba(255,255,255,0)", 0.3);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/**
 * Clouds drifting slowly across the map on the wind, each with its shadow sliding over the ground
 * below and to the side. The clouds sit above the scenery and parked traffic but under routes,
 * aircraft and landing circles, so they never hide play; when one drifts off, it returns on the
 * far side. Where `thinOver` says a cloud covers part of the airfield, it eases to a light haze so
 * runways and stands stay readable. Drawn once, still, when the player prefers reduced motion.
 */
export function addDriftingClouds(
  scene: Phaser.Scene,
  bounds: { readonly width: number; readonly height: number },
  { count = 4, wind = 0.35, speed = 10, depth = 3.5, shadowDepth = -19.5, thinOver }: {
    count?: number; wind?: number; speed?: number; depth?: number; shadowDepth?: number;
    thinOver?: (point: Vector2, radius: number) => boolean;
  } = {},
): void {
  if (typeof document === "undefined" || !scene.textures || !scene.add?.image) return;
  const unit = Math.min(bounds.width, bounds.height);
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const along = { x: Math.cos(wind), y: Math.sin(wind) };
  const across = { x: -along.y, y: along.x };
  const centre = { x: bounds.width / 2, y: bounds.height / 2 };
  const reach = Math.hypot(bounds.width, bounds.height) / 2 + unit * 0.4;
  // Paths across the wind stay within the map, so most clouds are on screen at any moment.
  const span = Math.abs(bounds.width * across.x) + Math.abs(bounds.height * across.y);
  const keys = [0, 1, 2, 3, 4, 5].map((seed) => cloudTexture(scene, seed * 7 + 3));
  let draws = 0;
  /** A fresh pseudo-random number in [0, 1); each call moves on to the next. */
  const random = () => {
    const value = Math.sin((draws += 1) * 91.73 + 37.71) * 43758.5453;
    return value - Math.floor(value);
  };
  type Cloud = {
    cloud: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image;
    opacity: number; haze: number; radius: number; distance: number; offset: number; pace: number;
  };
  /** Gives a cloud a new build, size, stretch, tilt, line across the wind and pace. */
  const dress = (item: Cloud) => {
    const key = keys[Math.floor(random() * keys.length)];
    // Mostly small and middling clouds, now and then a big one.
    const size = unit * (0.26 + random() ** 1.4 * 0.5);
    const scale = size / CLOUD_SIZE.width;
    const stretch = 0.7 + random() * 0.55;
    // Only a slight tilt, so the sunlit side baked into each build stays toward the north-west.
    const tilt = (random() - 0.5) * 0.3;
    for (const image of [item.cloud, item.shadow]) image.setTexture(key).setScale(scale, scale * stretch).setRotation(tilt);
    item.opacity = 0.55 + random() * 0.3;
    item.radius = size * 0.35;
    item.offset = (random() - 0.5) * span;
    item.pace = 0.55 + random() * 0.9;
  };
  const clouds: Cloud[] = Array.from({ length: count }, (_, i) => {
    const item: Cloud = {
      shadow: scene.add.image(0, 0, keys[0]).setTint(0x1d3a2a).setDepth(shadowDepth),
      cloud: scene.add.image(0, 0, keys[0]).setDepth(depth),
      opacity: 1, haze: 1, radius: 0, offset: 0, pace: 1,
      // Spread unevenly along the wind at the start.
      distance: -reach + ((i + random()) / count) * reach * 2,
    };
    dress(item);
    return item;
  });
  const shadowShift = { x: unit * 0.07, y: unit * 0.09 };
  const place = () => {
    for (const item of clouds) {
      const x = centre.x + along.x * item.distance + across.x * item.offset;
      const y = centre.y + along.y * item.distance + across.y * item.offset;
      item.cloud.setPosition(x, y);
      // Ease toward a haze over the airfield and back to full cloud beyond it.
      const target = thinOver?.({ x, y }, item.radius) ? 0.25 : 1;
      item.haze += (target - item.haze) * (still ? 1 : 0.05);
      item.cloud.setAlpha(item.opacity * item.haze);
      item.shadow.setAlpha(0.18 * item.haze);
      item.shadow.setPosition(x + shadowShift.x, y + shadowShift.y);
    }
  };
  place();
  for (const key of keys) scene.events.once("shutdown", () => scene.textures.remove(key));
  if (still) return;
  const step = (_time: number, delta: number) => {
    for (const item of clouds) {
      item.distance += speed * item.pace * (delta / 1000);
      if (item.distance > reach) {
        // Back in from the far side as a different cloud, after a random gap so they never arrive in a train.
        dress(item);
        item.distance = -reach - random() * reach * 0.8;
      }
    }
    place();
  };
  scene.events.on("update", step);
  scene.events.once("shutdown", () => scene.events.off("update", step));
}

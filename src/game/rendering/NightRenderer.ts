import type Phaser from "phaser";
import type { Vector2 } from "../../core/types";
import type { RunwayGuidanceSurface } from "../maps/shared/guidance";
import type { PlayableMapLayout } from "../maps/types";

// Phaser.BlendModes values; a type-only import keeps this file loadable in tests.
const BLEND_ADD = 1;
const BLEND_MULTIPLY = 2;

export const NIGHT_TINT = 0x4a5a86;
export const NIGHT_LIGHT_COLORS = { edge: 0xfff4d6, landing: 0x5dff8a, stop: 0xff4a3d, approach: 0xffffff, pad: 0xd8ff5c } as const;

export interface NightLight {
  readonly x: number;
  readonly y: number;
  readonly color: number;
  /** Halo radius; the bright core is a third of it. */
  readonly size: number;
}

type NightLayout = Pick<PlayableMapLayout, "width" | "height" | "guidanceSurfaces">;

/** Light positions from data every map already has: runway and pad guidance. */
export function nightLightPoints(layout: NightLayout): NightLight[] {
  const unit = Math.min(layout.width, layout.height);
  const dot = unit * 0.006;
  const lights: NightLight[] = [];
  const add = (p: Vector2, color: number, size = dot) => lights.push({ x: p.x, y: p.y, color, size });

  // A runway open at both ends appears twice, once per direction; light it once.
  const runways = new Map<string, RunwayGuidanceSurface[]>();
  for (const surface of layout.guidanceSurfaces) {
    if (surface.kind === "pad") {
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2;
        add({ x: surface.center.x + Math.cos(a) * surface.radius, y: surface.center.y + Math.sin(a) * surface.radius }, NIGHT_LIGHT_COLORS.pad);
      }
      continue;
    }
    const key = `${surface.center.x.toFixed(1)},${surface.center.y.toFixed(1)},${surface.length.toFixed(1)}`;
    runways.set(key, [...(runways.get(key) ?? []), surface]);
  }

  for (const group of runways.values()) {
    const { center, angle, length, width } = group[0];
    const along = { x: Math.cos(angle), y: Math.sin(angle) };
    const across = { x: -along.y, y: along.x };
    const at = (s: number, t: number): Vector2 => ({ x: center.x + along.x * s + across.x * t, y: center.y + along.y * s + across.y * t });
    const edges = Math.max(4, Math.round(length / (unit * 0.045)));
    for (let i = 0; i <= edges; i += 1) {
      const s = -length / 2 + (i / edges) * length;
      add(at(s, width / 2), NIGHT_LIGHT_COLORS.edge);
      add(at(s, -width / 2), NIGHT_LIGHT_COLORS.edge);
    }
    // Aircraft fly along a surface's angle and touch down near its first end.
    for (const side of [-1, 1] as const) {
      const landed = group.some((surface) => Math.cos(surface.angle - angle) * -side > 0);
      for (let i = 0; i < 5; i += 1) add(at((side * length) / 2, -width / 2 + (i / 4) * width), landed ? NIGHT_LIGHT_COLORS.landing : NIGHT_LIGHT_COLORS.stop);
      if (landed) for (let i = 1; i <= 4; i += 1) add(at(side * (length / 2 + i * width * 0.7), 0), NIGHT_LIGHT_COLORS.approach, dot * 1.2);
    }
  }

  return lights;
}

/** Darkens the map art (below depth 0) and bakes its lights once; aircraft, routes and warnings stay above. */
export function drawNight(scene: Phaser.Scene, layout: NightLayout, tint = NIGHT_TINT): [Phaser.GameObjects.Rectangle, Phaser.GameObjects.RenderTexture] {
  const shade = scene.add
    .rectangle(0, 0, layout.width, layout.height, tint)
    .setOrigin(0, 0)
    .setDepth(0)
    .setBlendMode(BLEND_MULTIPLY);
  const graphics = scene.add.graphics();
  for (const light of nightLightPoints(layout)) {
    graphics.fillStyle(light.color, 0.22);
    graphics.fillCircle(light.x, light.y, light.size);
    graphics.fillStyle(light.color, 1);
    graphics.fillCircle(light.x, light.y, light.size / 3);
  }
  const lights = scene.add
    .renderTexture(0, 0, layout.width, layout.height)
    .setOrigin(0, 0)
    .setDepth(1)
    .setBlendMode(BLEND_ADD);
  lights.draw(graphics);
  lights.render();
  graphics.destroy();
  return [shade, lights];
}

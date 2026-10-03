import Phaser from "phaser";
import { AIRCRAFT_OUTLINES } from "../../core/aircraftCollision";
import type { Aircraft } from "../../core/types";
import { AIRCRAFT_STYLE } from "../content";
import { initialRotorPhase, rotorMotion } from "../animation/rotorMotion";
import {
  AIRCRAFT_VISUAL_TOKENS as INK,
  AIRCRAFT_SILHOUETTES,
  LANDED_AIRCRAFT_TOKENS as LANDED,
  aircraftPresentationScale,
} from "./aircraft/visualTokens";

/** Ground scale after touchdown: smaller than in flight so landed traffic recedes. */
export const GROUND_SCALE = 0.5;

function mixColor(from: number, to: number, t: number): number {
  const channel = (shift: number) => Math.round(((from >> shift) & 0xff) + (((to >> shift) & 0xff) - ((from >> shift) & 0xff)) * t);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export interface AircraftViewOptions {
  reducedMotion?: boolean;
  presentationScale?: number;
}

/** Retained vector artwork: no cropped atlas, resampling or changing sprite pivots. */
export class AircraftView {
  readonly container: Phaser.GameObjects.Container;
  readonly ring: Phaser.GameObjects.Arc;
  private readonly innerRing: Phaser.GameObjects.Arc;
  private readonly presentationScale: number;
  private readonly rotorAssembly?: Phaser.GameObjects.Graphics;
  private rotorAngle: number;
  private reducedMotion: boolean;
  private readonly type: Aircraft["type"];
  private readonly outline: Phaser.Math.Vector2[];
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly body: Phaser.GameObjects.Graphics;
  /** 0 = flight colours, 1 = landed colours. */
  private landedBlend = -1;
  /** Scale on the ground, at most GROUND_SCALE and small enough to fit this type's stand. */
  private groundScale = GROUND_SCALE;
  constructor(
    scene: Phaser.Scene,
    aircraft: Aircraft,
    options: AircraftViewOptions = {},
  ) {
    const canvas = scene.game.canvas;
    this.presentationScale =
      options.presentationScale ??
      aircraftPresentationScale(
        aircraft.type,
        {
          width: canvas.clientWidth || canvas.width,
          height: canvas.clientHeight || canvas.height,
        },
        {
          width: scene.scale.gameSize.width,
          height: scene.scale.gameSize.height,
        },
      );
    this.rotorAngle = initialRotorPhase(aircraft.id);
    this.reducedMotion = options.reducedMotion ?? false;
    const spec = AIRCRAFT_SILHOUETTES[aircraft.type];
    this.ring = scene.add
      .circle(0, 0, spec.selectionRadius, 0, 0)
      .setStrokeStyle(4, 0x17352f, 0.9)
      .setVisible(false);
    this.innerRing = scene.add
      .circle(0, 0, spec.selectionRadius, 0, 0)
      .setStrokeStyle(1.8, AIRCRAFT_STYLE[aircraft.type].color, 1)
      .setVisible(false);
    this.type = aircraft.type;
    this.outline = AIRCRAFT_OUTLINES[aircraft.type].map(([x, y]) => new Phaser.Math.Vector2(x, y));
    const shadow = (this.shadow = scene.add.graphics().setPosition(3, 4));
    const body = (this.body = scene.add.graphics());
    this.paint(0);
    const children: Phaser.GameObjects.GameObject[] = [shadow, this.ring, this.innerRing, body];
    if (aircraft.type === "rotor") {
      // A centered, symmetric rotor avoids the lopsided atlas wobble.
      this.rotorAssembly = scene.add.graphics().setPosition(5, 0);
      this.rotorAssembly.fillStyle(INK.bodyHighlight, 0.08);
      this.rotorAssembly.fillCircle(0, 0, 25);
      this.rotorAssembly.fillStyle(INK.keyline, 0.42);
      this.rotorAssembly.fillRoundedRect(-25, -1.5, 50, 3, 1.5);
      this.rotorAssembly.fillRoundedRect(-1.5, -25, 3, 50, 1.5);
      this.rotorAssembly.setRotation(this.rotorAngle);
      children.push(this.rotorAssembly);
      const hub = scene.add.circle(5, 0, 3, INK.bodyHighlight).setStrokeStyle(1.5, INK.keyline);
      children.push(hub);
    }
    this.container = scene.add
      .container(aircraft.position.x, aircraft.position.y, children)
      .setDepth(7)
      .setRotation(aircraft.heading)
      .setScale(this.presentationScale);
  }
  sync(
    aircraft: Aircraft,
    deltaMilliseconds: number,
    running: boolean,
    reducedMotion = this.reducedMotion,
  ): void {
    this.reducedMotion = reducedMotion;
    this.container
      .setPosition(aircraft.position.x, aircraft.position.y)
      .setRotation(aircraft.heading);
    if (this.rotorAssembly && !this.reducedMotion) {
      this.rotorAngle = rotorMotion(
        this.rotorAngle,
        deltaMilliseconds,
        running,
      );
      this.rotorAssembly.setRotation(this.rotorAngle);
    }
    const progress =
      aircraft.state === "landing" ? aircraft.landingProgress : 0;
    // Touchdown settles onto the ground scale; the ground layer then rolls it out and taxis it.
    this.container
      .setScale(this.presentationScale * (1 - progress * (1 - this.groundScale)))
      .setAlpha(1);
  }
  setGroundScale(scale: number): void {
    this.groundScale = scale;
  }
  /**
   * Hand the view to ground traffic: below airborne aircraft, never selectable,
   * muting to landed colours (at once for aircraft that start the shift parked).
   */
  toGround(muteImmediately = false): void {
    this.setSelected(false);
    this.container.setDepth(3);
    this.landedBlend = muteImmediately ? 1 : 0;
    if (muteImmediately) this.paint(1);
  }
  /** Draw the airframe, blending from flight colours (0) to landed colours (1). */
  private paint(landed: number): void {
    const color = AIRCRAFT_STYLE[this.type].color;
    const keyline = mixColor(INK.keyline, LANDED.keyline, landed);
    const livery = mixColor(color, LANDED.livery, landed);
    this.shadow.clear();
    this.shadow.fillStyle(INK.shadow, 0.16 + (LANDED.shadowAlpha - 0.16) * landed);
    this.shadow.fillPoints(this.outline, true);
    const body = this.body.clear();
    body.fillStyle(mixColor(INK.bodyHighlight, LANDED.body, landed), 1);
    body.fillPoints(this.outline, true);
    body.lineStyle(2.4, keyline, 1);
    body.strokePoints(this.outline, true);
    // One generous livery panel and one cockpit remain readable at flight scale.
    body.fillStyle(livery, 1);
    body.fillRoundedRect(-22, -4, this.type === "rotor" ? 37 : 41, 8, 4);
    if (this.type !== "rotor") {
      const wingX = this.type === "liner" ? -7 : -4;
      body.lineStyle(4, livery, 1);
      body.lineBetween(wingX, -19, wingX + 3, -9);
      body.lineBetween(wingX, 19, wingX + 3, 9);
    }
    body.fillStyle(keyline, 1);
    body.fillRoundedRect(this.type === "rotor" ? 14 : 20, -3.5, 6, 7, 2);
  }
  /** Draw a landed aircraft from presentation-only ground state. */
  syncGround(
    state: { readonly position: { x: number; y: number }; readonly heading: number; readonly alpha: number },
    deltaMilliseconds: number,
    rotorRunning: boolean,
  ): void {
    if (this.landedBlend >= 0 && this.landedBlend < 1) {
      this.landedBlend = this.reducedMotion ? 1 : Math.min(1, this.landedBlend + deltaMilliseconds / LANDED.blendMilliseconds);
      this.paint(this.landedBlend);
    }
    this.container
      .setPosition(state.position.x, state.position.y)
      .setRotation(state.heading)
      .setScale(this.presentationScale * this.groundScale)
      .setAlpha(state.alpha);
    if (this.rotorAssembly && !this.reducedMotion) {
      this.rotorAngle = rotorMotion(this.rotorAngle, deltaMilliseconds, rotorRunning);
      this.rotorAssembly.setRotation(this.rotorAngle);
    }
  }
  setSelected(selected: boolean): void {
    this.ring.setVisible(selected);
    this.innerRing.setVisible(selected);
  }
  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
  }
  destroy(): void {
    this.container.destroy(true);
  }
}
export function createAircraftView(
  scene: Phaser.Scene,
  aircraft: Aircraft,
  options?: AircraftViewOptions,
): AircraftView {
  return new AircraftView(scene, aircraft, options);
}

import Phaser from "phaser";
import { AIRCRAFT_OUTLINES } from "../../core/aircraftCollision";
import type { Aircraft } from "../../core/types";
import { AIRCRAFT_STYLE } from "../content";
import { initialRotorPhase, rotorMotion } from "../animation/rotorMotion";
import {
  AIRCRAFT_VISUAL_TOKENS as INK,
  AIRCRAFT_SILHOUETTES,
  aircraftPresentationScale,
} from "./aircraft/visualTokens";

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
    const outline = AIRCRAFT_OUTLINES[aircraft.type].map(([x, y]) => new Phaser.Math.Vector2(x, y));
    const shadow = scene.add.graphics().setPosition(3, 4);
    shadow.fillStyle(INK.shadow, 0.16);
    shadow.fillPoints(outline, true);
    const body = scene.add.graphics();
    body.fillStyle(INK.bodyHighlight, 1);
    body.fillPoints(outline, true);
    body.lineStyle(2.4, INK.keyline, 1);
    body.strokePoints(outline, true);
    const color = AIRCRAFT_STYLE[aircraft.type].color;
    // One generous livery panel and one cockpit remain readable at flight scale.
    body.fillStyle(color, 1);
    body.fillRoundedRect(-22, -4, aircraft.type === "rotor" ? 37 : 41, 8, 4);
    if (aircraft.type !== "rotor") {
      const wingX = aircraft.type === "liner" ? -7 : -4;
      body.lineStyle(4, color, 1);
      body.lineBetween(wingX, -19, wingX + 3, -9);
      body.lineBetween(wingX, 19, wingX + 3, 9);
    }
    body.fillStyle(INK.keyline, 1);
    body.fillRoundedRect(aircraft.type === "rotor" ? 14 : 20, -3.5, 6, 7, 2);
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
    this.container
      .setScale(this.presentationScale * Math.max(0.25, 1 - progress * 0.7))
      .setAlpha(Math.max(0, 1 - progress));
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

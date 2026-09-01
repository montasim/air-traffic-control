import Phaser from 'phaser';
import type { Aircraft, AircraftType, Vector2 } from '../../core/types';
import { AIRCRAFT_STYLE } from '../content';
import { initialRotorPhase, rotorMotion } from '../animation/rotorMotion';
import {
  AIRCRAFT_SILHOUETTES,
  AIRCRAFT_VISUAL_TOKENS,
  aircraftPresentationScale
} from './aircraft/visualTokens';
import {
  COMMUTER_SILHOUETTE,
  LINER_SILHOUETTE
} from './aircraft/silhouettes';

export interface AircraftViewOptions {
  reducedMotion?: boolean;
}

/**
 * A retained-mode aircraft rendering. Geometry is created once; sync() only
 * updates transforms and visibility so the game loop allocates no display
 * objects and redraws no vector paths.
 */
export class AircraftView {
  readonly container: Phaser.GameObjects.Container;
  readonly ring: Phaser.GameObjects.Arc;

  private readonly selectionInnerRing: Phaser.GameObjects.Arc;
  private readonly selectionTicks: Phaser.GameObjects.Graphics;
  private readonly presentationScale: number;
  private readonly rotorAssembly?: Phaser.GameObjects.Container;
  private reducedMotion: boolean;
  private rotorAngle: number;

  constructor(
    scene: Phaser.Scene,
    aircraft: Aircraft,
    options: AircraftViewOptions = {}
  ) {
    const style = AIRCRAFT_STYLE[aircraft.type];
    const silhouette = AIRCRAFT_SILHOUETTES[aircraft.type];
    const canvas = scene.game.canvas;
    this.presentationScale = aircraftPresentationScale(
      aircraft.type,
      {
        width: canvas.clientWidth || canvas.width,
        height: canvas.clientHeight || canvas.height
      },
      {
        width: scene.scale.gameSize.width,
        height: scene.scale.gameSize.height
      }
    );
    this.reducedMotion = options.reducedMotion ?? false;
    this.rotorAngle = initialRotorPhase(aircraft.id);

    this.ring = scene.add.circle(0, 0, silhouette.selectionRadius, 0, 0)
      .setStrokeStyle(
        AIRCRAFT_VISUAL_TOKENS.selectionOuterWidth,
        AIRCRAFT_VISUAL_TOKENS.keyline,
        0.96
      )
      .setVisible(false);
    this.selectionInnerRing = scene.add.circle(0, 0, silhouette.selectionRadius, 0, 0)
      .setStrokeStyle(
        AIRCRAFT_VISUAL_TOKENS.selectionInnerWidth,
        AIRCRAFT_VISUAL_TOKENS.selectionLight,
        0.98
      )
      .setVisible(false);
    this.selectionTicks = scene.add.graphics().setVisible(false);
    drawSelectionTicks(
      this.selectionTicks,
      silhouette.selectionRadius,
      style.color
    );

    const children: Phaser.GameObjects.GameObject[] = [];
    const shadow = scene.add.graphics();
    const body = scene.add.graphics();

    if (aircraft.type === 'rotor') {
      drawRotorBody(shadow, style.color, true);
      drawRotorBody(body, style.color, false);
      children.push(shadow, this.ring, this.selectionInnerRing, this.selectionTicks, body);

      const rotorShadow = scene.add.graphics();
      const rotorBlades = scene.add.graphics();
      drawRotorBlades(rotorShadow, style.color, true);
      drawRotorBlades(rotorBlades, style.color, false);

      this.rotorAssembly = scene.add.container(0, 0, [rotorShadow, rotorBlades]);
      this.rotorAssembly.setRotation(this.rotorAngle);
      children.push(this.rotorAssembly);
    } else {
      drawFixedWing(shadow, aircraft.type, style.color, true);
      drawFixedWing(body, aircraft.type, style.color, false);
      children.push(
        shadow,
        this.ring,
        this.selectionInnerRing,
        this.selectionTicks,
        body
      );
    }

    const navigationLight = scene.add.circle(
      aircraft.type === 'commuter' ? 16 : 19,
      0,
      2.2,
      AIRCRAFT_VISUAL_TOKENS.bodyHighlight,
      0.96
    ).setStrokeStyle(1.2, AIRCRAFT_VISUAL_TOKENS.keyline, 0.88);
    children.push(navigationLight);

    this.container = scene.add.container(
      aircraft.position.x,
      aircraft.position.y,
      children
    );
    this.container
      .setDepth(7)
      .setRotation(aircraft.heading)
      .setScale(this.presentationScale);
    this.applyReducedMotionVisibility();
  }

  /** Updates position, heading, landing scale, and rotor phase in-place. */
  sync(
    aircraft: Aircraft,
    deltaMilliseconds: number,
    running: boolean,
    reducedMotion: boolean = this.reducedMotion
  ): void {
    if (reducedMotion !== this.reducedMotion) this.setReducedMotion(reducedMotion);

    this.container.setPosition(aircraft.position.x, aircraft.position.y);
    this.container.setRotation(aircraft.heading);

    if (this.rotorAssembly && !this.reducedMotion) {
      this.rotorAngle = rotorMotion(this.rotorAngle, deltaMilliseconds, running);
      this.rotorAssembly.setRotation(this.rotorAngle);
    }

    if (aircraft.state === 'landing') {
      const scale = this.presentationScale * Math.max(0.25, 1 - aircraft.landingProgress * 0.7);
      this.container.setScale(scale).setAlpha(Math.max(0, 1 - aircraft.landingProgress));
    } else {
      this.container.setScale(this.presentationScale).setAlpha(1);
    }
  }

  setSelected(selected: boolean): void {
    this.ring.setVisible(selected);
    this.selectionInnerRing.setVisible(selected);
    this.selectionTicks.setVisible(selected);
  }

  setReducedMotion(reducedMotion: boolean): void {
    if (this.reducedMotion === reducedMotion) return;
    this.reducedMotion = reducedMotion;
    this.applyReducedMotionVisibility();
  }

  destroy(): void {
    this.container.destroy(true);
  }

  private applyReducedMotionVisibility(): void {
    // Reduced motion freezes the retained rotor at its deterministic phase;
    // the helicopter never loses its class-defining silhouette.
    this.rotorAssembly?.setVisible(true);
  }
}

export function createAircraftView(
  scene: Phaser.Scene,
  aircraft: Aircraft,
  options?: AircraftViewOptions
): AircraftView {
  return new AircraftView(scene, aircraft, options);
}

function drawRotorBody(
  graphics: Phaser.GameObjects.Graphics,
  accent: number,
  shadow: boolean
): void {
  const offset = shadow ? AIRCRAFT_VISUAL_TOKENS.shadowOffset : ORIGIN;
  graphics.fillStyle(
    shadow ? AIRCRAFT_VISUAL_TOKENS.shadow : AIRCRAFT_VISUAL_TOKENS.body,
    shadow ? AIRCRAFT_VISUAL_TOKENS.shadowAlpha : 1
  );
  if (!shadow) {
    graphics.lineStyle(
      AIRCRAFT_VISUAL_TOKENS.keylineWidth,
      AIRCRAFT_VISUAL_TOKENS.keyline,
      1
    );
  }
  graphics.fillTriangle(
    -20 + offset.x, -5 + offset.y,
    -43 + offset.x, offset.y,
    -20 + offset.x, 5 + offset.y
  );
  graphics.fillEllipse(offset.x, offset.y, 30, 18);
  if (shadow) return;

  graphics.strokeEllipse(0, 0, 30, 18);
  graphics.lineBetween(-20, -5, -43, 0);
  graphics.lineBetween(-43, 0, -20, 5);
  graphics.fillStyle(accent, 0.94);
  graphics.fillEllipse(4, 0, 12, 11);
  graphics.fillStyle(AIRCRAFT_VISUAL_TOKENS.canopy, 1);
  graphics.fillEllipse(8, 0, 7, 8);
  graphics.fillStyle(AIRCRAFT_VISUAL_TOKENS.canopyHighlight, 0.76);
  graphics.fillEllipse(10, -1.5, 2.4, 2.2);
  graphics.fillStyle(accent, 0.9);
  graphics.fillTriangle(-30, -2.5, -39, 0, -30, 2.5);
}

function drawRotorBlades(
  graphics: Phaser.GameObjects.Graphics,
  accent: number,
  shadow: boolean
): void {
  const offset = shadow ? AIRCRAFT_VISUAL_TOKENS.shadowOffset : ORIGIN;
  graphics.fillStyle(
    shadow ? AIRCRAFT_VISUAL_TOKENS.shadow : AIRCRAFT_VISUAL_TOKENS.bodyHighlight,
    shadow ? 0.16 : 1
  );
  if (!shadow) {
    graphics.lineStyle(2.2, AIRCRAFT_VISUAL_TOKENS.keyline, 0.96);
  }
  graphics.fillRoundedRect(-32 + offset.x, -2.7 + offset.y, 64, 5.4, 2.7);
  graphics.fillRoundedRect(-2.7 + offset.x, -32 + offset.y, 5.4, 64, 2.7);
  if (shadow) return;

  graphics.strokeRoundedRect(-32, -2.7, 64, 5.4, 2.7);
  graphics.strokeRoundedRect(-2.7, -32, 5.4, 64, 2.7);
  graphics.fillStyle(accent, 0.94);
  graphics.fillRoundedRect(-31, -2, 7, 4, 2);
  graphics.fillRoundedRect(24, -2, 7, 4, 2);
  graphics.fillRoundedRect(-2, -31, 4, 7, 2);
  graphics.fillRoundedRect(-2, 24, 4, 7, 2);
  graphics.fillStyle(AIRCRAFT_VISUAL_TOKENS.keyline, 1);
  graphics.fillCircle(0, 0, 4.5);
  graphics.fillStyle(accent, 1);
  graphics.fillCircle(0, 0, 2.4);
}

function drawFixedWing(
  graphics: Phaser.GameObjects.Graphics,
  type: Exclude<AircraftType, 'rotor'>,
  accent: number,
  shadow: boolean
): void {
  const points = type === 'liner' ? LINER_SILHOUETTE : COMMUTER_SILHOUETTE;
  const offset = shadow ? AIRCRAFT_VISUAL_TOKENS.shadowOffset : ORIGIN;
  drawPolygon(
    graphics,
    points,
    offset,
    shadow ? AIRCRAFT_VISUAL_TOKENS.shadow : AIRCRAFT_VISUAL_TOKENS.body,
    shadow ? AIRCRAFT_VISUAL_TOKENS.shadowAlpha : 1,
    !shadow
  );
  if (shadow) return;

  if (type === 'liner') {
    graphics.fillStyle(accent, 0.94);
    graphics.fillRoundedRect(-28, -4.2, 9, 8.4, 3);
    graphics.lineStyle(2.4, accent, 0.96);
    graphics.lineBetween(-17, 0, 17, 0);
    graphics.fillStyle(AIRCRAFT_VISUAL_TOKENS.canopy, 1);
    graphics.fillEllipse(24, 0, 7, 7.6);
  } else {
    graphics.fillStyle(accent, 0.94);
    graphics.fillRoundedRect(15, -6, 8, 12, 3);
    graphics.fillTriangle(-22, -6, -28, -11, -25, -1);
    graphics.fillTriangle(-22, 6, -28, 11, -25, 1);
    graphics.fillStyle(AIRCRAFT_VISUAL_TOKENS.canopy, 1);
    graphics.fillEllipse(20, 0, 7, 8.5);
  }
  graphics.fillStyle(AIRCRAFT_VISUAL_TOKENS.canopyHighlight, 0.76);
  graphics.fillEllipse(type === 'liner' ? 25 : 21, -1.3, 2.2, 2.2);
}

function drawPolygon(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly Vector2[],
  offset: Vector2,
  fill: number,
  alpha: number,
  keyline: boolean
): void {
  graphics.fillStyle(fill, alpha);
  if (keyline) {
    graphics.lineStyle(
      AIRCRAFT_VISUAL_TOKENS.keylineWidth,
      AIRCRAFT_VISUAL_TOKENS.keyline,
      1
    );
  }
  graphics.beginPath();
  graphics.moveTo(points[0].x + offset.x, points[0].y + offset.y);
  for (let index = 1; index < points.length; index += 1) {
    graphics.lineTo(points[index].x + offset.x, points[index].y + offset.y);
  }
  graphics.closePath();
  graphics.fillPath();
  if (keyline) graphics.strokePath();
}

function drawSelectionTicks(
  graphics: Phaser.GameObjects.Graphics,
  radius: number,
  accent: number
): void {
  const inner = radius + 5;
  const outer = radius + 12;
  graphics.lineStyle(5.5, AIRCRAFT_VISUAL_TOKENS.keyline, 0.96);
  for (let index = 0; index < 4; index += 1) {
    const angle = index * Math.PI * 0.5;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    graphics.lineBetween(cosine * inner, sine * inner, cosine * outer, sine * outer);
  }
  graphics.lineStyle(2.4, accent, 1);
  for (let index = 0; index < 4; index += 1) {
    const angle = index * Math.PI * 0.5;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    graphics.lineBetween(cosine * inner, sine * inner, cosine * outer, sine * outer);
  }
}

const ORIGIN: Vector2 = { x: 0, y: 0 };

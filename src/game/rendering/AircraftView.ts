import Phaser from 'phaser';
import type { Aircraft, AircraftType, Vector2 } from '../../core/types';
import { AIRCRAFT_STYLE } from '../content';
import { WORLD_LIGHT } from '../palette';
import { initialRotorPhase, rotorMotion } from '../animation/rotorMotion';

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

  private readonly aircraftId: number;
  private readonly rotorAssembly?: Phaser.GameObjects.Container;
  private readonly reducedMotionRotor?: Phaser.GameObjects.Arc;
  private reducedMotion: boolean;
  private rotorAngle: number;

  constructor(
    scene: Phaser.Scene,
    aircraft: Aircraft,
    options: AircraftViewOptions = {}
  ) {
    const style = AIRCRAFT_STYLE[aircraft.type];
    this.aircraftId = aircraft.id;
    this.reducedMotion = options.reducedMotion ?? false;
    this.rotorAngle = initialRotorPhase(aircraft.id);

    this.ring = scene.add.circle(0, 0, 41, style.color, 0.055)
      .setStrokeStyle(2, style.color, 0.82)
      .setVisible(false);

    const children: Phaser.GameObjects.GameObject[] = [this.ring];
    const shadow = scene.add.graphics();
    const body = scene.add.graphics();

    if (aircraft.type === 'rotor') {
      drawRotorBody(shadow, 0x102923, 0.5, SHADOW_OFFSET);
      drawRotorBody(body, style.color, 1, ORIGIN);
      children.push(shadow, body);

      const rotorShadow = scene.add.graphics();
      const rotorBlades = scene.add.graphics();
      drawRotorBlades(rotorShadow, 0x102923, 0.42, SHADOW_OFFSET);
      drawRotorBlades(rotorBlades, style.color, 0.96, ORIGIN);

      this.rotorAssembly = scene.add.container(0, 0, [rotorShadow, rotorBlades]);
      this.rotorAssembly.setRotation(this.rotorAngle);
      children.push(this.rotorAssembly);

      this.reducedMotionRotor = scene.add.circle(0, 0, 27, style.color, 0.1)
        .setStrokeStyle(3, style.color, 0.56);
      children.push(this.reducedMotionRotor);
    } else {
      drawFixedWing(shadow, aircraft.type, 0x102923, 0.5, SHADOW_OFFSET);
      drawFixedWing(body, aircraft.type, style.color, 1, ORIGIN);
      children.push(shadow, body);
    }

    const navigationLight = scene.add.circle(8, 0, 2.5, 0xf7f2df, 0.92);
    children.push(navigationLight);

    this.container = scene.add.container(
      aircraft.position.x,
      aircraft.position.y,
      children
    );
    this.container.setDepth(7).setRotation(aircraft.heading);
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
      const scale = Math.max(0.25, 1 - aircraft.landingProgress * 0.7);
      this.container.setScale(scale).setAlpha(Math.max(0, 1 - aircraft.landingProgress));
    } else {
      this.container.setScale(1).setAlpha(1);
    }
  }

  setSelected(selected: boolean): void {
    this.ring.setVisible(selected);
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
    this.rotorAssembly?.setVisible(!this.reducedMotion);
    this.reducedMotionRotor?.setVisible(this.reducedMotion);
  }
}

export function createAircraftView(
  scene: Phaser.Scene,
  aircraft: Aircraft,
  options?: AircraftViewOptions
): AircraftView {
  return new AircraftView(scene, aircraft, options);
}

const ORIGIN: Vector2 = { x: 0, y: 0 };
const SHADOW_OFFSET: Vector2 = WORLD_LIGHT.aircraftShadow;

function drawRotorBody(
  graphics: Phaser.GameObjects.Graphics,
  color: number,
  alpha: number,
  offset: Vector2
): void {
  graphics.fillStyle(color, alpha);
  graphics.fillTriangle(
    -20 + offset.x, -5 + offset.y,
    -43 + offset.x, offset.y,
    -20 + offset.x, 5 + offset.y
  );
  graphics.fillEllipse(offset.x, offset.y, 30, 18);
}

function drawRotorBlades(
  graphics: Phaser.GameObjects.Graphics,
  color: number,
  alpha: number,
  offset: Vector2
): void {
  graphics.fillStyle(color, alpha);
  graphics.fillRoundedRect(-32 + offset.x, -2 + offset.y, 64, 4, 2);
  graphics.fillRoundedRect(-2 + offset.x, -32 + offset.y, 4, 64, 2);
}

function drawFixedWing(
  graphics: Phaser.GameObjects.Graphics,
  type: Exclude<AircraftType, 'rotor'>,
  color: number,
  alpha: number,
  offset: Vector2
): void {
  graphics.fillStyle(color, alpha);
  const scale = type === 'liner' ? 1 : 0.82;
  const points = FIXED_WING_POINTS;

  graphics.beginPath();
  graphics.moveTo(points[0].x * scale + offset.x, points[0].y * scale + offset.y);
  for (let index = 1; index < points.length; index += 1) {
    graphics.lineTo(
      points[index].x * scale + offset.x,
      points[index].y * scale + offset.y
    );
  }
  graphics.closePath();
  graphics.fillPath();
}

const FIXED_WING_POINTS: readonly Vector2[] = [
  { x: 31, y: 0 },
  { x: 13, y: -5 },
  { x: -3, y: -24 },
  { x: -10, y: -24 },
  { x: -6, y: -6 },
  { x: -21, y: -5 },
  { x: -29, y: -13 },
  { x: -33, y: -11 },
  { x: -27, y: 0 },
  { x: -33, y: 11 },
  { x: -29, y: 13 },
  { x: -21, y: 5 },
  { x: -6, y: 6 },
  { x: -10, y: 24 },
  { x: -3, y: 24 },
  { x: 13, y: 5 }
];

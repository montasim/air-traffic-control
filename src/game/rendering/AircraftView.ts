import type { LiveryId } from '../../progression/liveries';
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
  aircraftLiveryPaint,
} from "./aircraft/visualTokens";

/** Ground scale after touchdown: smaller than in flight so landed traffic recedes. */
export const GROUND_SCALE = 0.5;

function mixColor(from: number, to: number, t: number): number {
  const channel = (shift: number) => Math.round(((from >> shift) & 0xff) + (((to >> shift) & 0xff) - ((from >> shift) & 0xff)) * t);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

type Outline = readonly (readonly [number, number])[];
/**
 * Military airframes seen from above, drawn in each type's place on the carrier maps. Each keeps
 * its civil counterpart's vertex order, so wing shading picks out the same parts, and about its
 * size; drawing only, collision keeps the civil outlines.
 */
export const MILITARY_OUTLINES: Readonly<Record<Aircraft["type"], Outline>> = {
  // A four-engine transport: long straight high wings and a broad tailplane.
  liner: [
    [34,0], [26,-6], [6,-7], [4,-27], [-4,-27], [-4,-7],
    [-22,-6], [-28,-14], [-34,-14], [-31,0], [-34,14], [-28,14],
    [-22,6], [-4,7], [-4,27], [4,27], [6,7], [26,6],
  ],
  // A carrier fighter: a pointed nose, swept wings set well aft, and wide tailplanes.
  commuter: [
    [31,0], [18,-4], [8,-5], [-8,-22], [-14,-22], [-12,-6],
    [-18,-6], [-27,-14], [-31,-13], [-28,0], [-31,13], [-27,14],
    [-18,6], [-12,6], [-14,22], [-8,22], [8,5], [18,4],
  ],
  // A gunship: a slim cabin with stub wings for weapon pods, and a long tail boom.
  rotor: [
    [28,0], [20,-5], [8,-6], [4,-15], [-3,-15], [-5,-6],
    [-10,-5], [-28,-2], [-29,-9], [-33,-9], [-32,0], [-33,9],
    [-29,9], [-28,2], [-10,5], [-5,6], [-3,15], [4,15], [8,6], [20,5],
  ],
};

export interface AircraftViewOptions {
  livery?: LiveryId;
  reducedMotion?: boolean;
  night?: boolean;
  presentationScale?: number;
  /** Draw every type as its military counterpart (the carrier maps). */
  military?: boolean;
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
  private readonly livery: LiveryId;
  private readonly type: Aircraft["type"];
  private readonly military: boolean;
  private readonly outline: Phaser.Math.Vector2[];
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly body: Phaser.GameObjects.Graphics;
  /** 0 = flight colours, 1 = landed colours. */
  private landedBlend = -1;
  /** Scale on the ground, at most GROUND_SCALE and small enough to fit this type's stand. */
  private groundScale = GROUND_SCALE;
  /** Night navigation lights: red port, green starboard, white tail strobe. */
  private readonly navLights: Phaser.GameObjects.Arc[];
  private readonly strobe: Phaser.GameObjects.Arc;
  private night = false;
  private grounded = false;
  private strobeClock = 0;
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
          width: scene.scale.gameSize.width / scene.cameras.main.zoom,
          height: scene.scale.gameSize.height / scene.cameras.main.zoom,
        },
      );
    this.rotorAngle = initialRotorPhase(aircraft.id);
    this.reducedMotion = options.reducedMotion ?? false;
    this.night = options.night ?? false;
    const spec = AIRCRAFT_SILHOUETTES[aircraft.type];
    this.ring = scene.add
      .circle(0, 0, spec.selectionRadius, 0, 0)
      .setStrokeStyle(4, 0x17352f, 0.9)
      .setVisible(false);
    this.innerRing = scene.add
      .circle(0, 0, spec.selectionRadius, 0, 0)
      .setStrokeStyle(1.8, AIRCRAFT_STYLE[aircraft.type].color, 1)
      .setVisible(false);
    this.livery = options.livery ?? 'classic';
    this.type = aircraft.type;
    this.military = Boolean(options.military);
    const outline = (this.military ? MILITARY_OUTLINES : AIRCRAFT_OUTLINES)[aircraft.type];
    this.outline = outline.map(([x, y]) => new Phaser.Math.Vector2(x, y));
    const shadow = (this.shadow = scene.add.graphics().setPosition(3, 4));
    const body = (this.body = scene.add.graphics());
    this.paint(0);
    const children: Phaser.GameObjects.GameObject[] = [shadow, this.ring, this.innerRing, body];
    if (aircraft.type === "rotor") {
      // A centered, symmetric rotor avoids the lopsided atlas wobble.
      this.rotorAssembly = scene.add.graphics().setPosition(5, 0);
      this.rotorAssembly.fillStyle(INK.bodyHighlight, 0.08);
      this.rotorAssembly.fillCircle(0, 0, 25);
      this.rotorAssembly.fillStyle(aircraftLiveryPaint(this.livery, this.type).rotor, 0.42);
      this.rotorAssembly.fillRoundedRect(-25, -1.5, 50, 3, 1.5);
      this.rotorAssembly.fillRoundedRect(-1.5, -25, 3, 50, 1.5);
      this.rotorAssembly.setRotation(this.rotorAngle);
      children.push(this.rotorAssembly);
      const hub = scene.add.circle(5, 0, 3, INK.bodyHighlight).setStrokeStyle(1.5, INK.keyline);
      children.push(hub);
    }
    // Each light sits on the wing, set in from the tip edge so none of it hangs off the airframe:
    // mid-tip on a wing, the forward edge point on a helicopter so it lands on the cabin, not the tail.
    const span = Math.max(...outline.map(([, y]) => y));
    const tipXs = outline.filter(([, y]) => y === span).map(([x]) => x);
    const tipX = aircraft.type === "rotor" ? Math.max(...tipXs) : tipXs.reduce((sum, x) => sum + x, 0) / tipXs.length;
    const tipY = span - 3.5;
    const tail = outline.filter(([, y]) => y === 0).reduce((best, point) => point[0] < best[0] ? point : best);
    this.navLights = [
      scene.add.circle(tipX, -tipY, 2.6, 0xff3b30),
      scene.add.circle(tipX, tipY, 2.6, 0x34e36a),
    ];
    this.strobe = scene.add.circle(tail[0], 0, 2.6, 0xffffff);
    children.push(...this.navLights, this.strobe);
    this.updateLights();
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
    // Airborne shadows fall far from the aircraft and close in through the landing.
    this.placeShadow(aircraft.heading, aircraft.state === "landing" ? 1 - aircraft.landingProgress : 1);
    if (this.rotorAssembly && !this.reducedMotion) {
      this.rotorAngle = rotorMotion(
        this.rotorAngle,
        deltaMilliseconds,
        running,
      );
      this.rotorAssembly.setRotation(this.rotorAngle);
    }
    this.strobeClock = (this.strobeClock + deltaMilliseconds) % 1000;
    this.updateLights();
    const progress =
      aircraft.state === "landing" ? aircraft.landingProgress : 0;
    // Touchdown settles onto the ground scale; the ground layer then rolls it out and taxis it.
    this.container
      .setScale(this.presentationScale * (1 - progress * (1 - this.groundScale)))
      .setAlpha(1);
  }
  /**
   * The shadow keeps one world direction, down and right from a north-west light, whatever the
   * heading: the offset is turned back by the container's rotation. Altitude 1 is cruising, 0 on the ground.
   */
  private placeShadow(heading: number, altitude: number): void {
    const x = 3 + altitude * 9;
    const y = 4 + altitude * 12;
    const cos = Math.cos(heading), sin = Math.sin(heading);
    this.shadow.setPosition(x * cos + y * sin, -x * sin + y * cos).setAlpha(1 - altitude * 0.3);
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
    this.grounded = true;
    this.updateLights();
    this.landedBlend = muteImmediately ? 1 : 0;
    if (muteImmediately) this.paint(1);
  }
  /** Draw the airframe, blending from flight colours (0) to landed colours (1). */
  private paint(landed: number): void {
    const paint = aircraftLiveryPaint(this.livery, this.type);
    const keyline = mixColor(INK.keyline, LANDED.keyline, landed);
    const edge = mixColor(paint.edge, LANDED.keyline, landed);
    this.shadow.clear();
    this.shadow.fillStyle(INK.shadow, 0.28 + (LANDED.shadowAlpha - 0.28) * landed);
    this.shadow.fillPoints(this.outline, true);
    const body = this.body.clear();
    body.fillStyle(mixColor(paint.body, LANDED.body, landed), 1);
    body.fillPoints(this.outline, true);
    // Wings and tailplanes sit lower than the fuselage, so they read a shade darker.
    if (this.type !== "rotor") {
      body.fillStyle(INK.keyline, 0.14);
      for (const [from, to] of [[2, 5], [13, 16], [6, 9], [9, 12]]) body.fillPoints(this.outline.slice(from, to + 1), true);
    }
    // Midnight needs a pale edge on dark scenery, backed by dark ink on snow.
    if (this.livery === 'midnight') {
      body.lineStyle(4.4, keyline, 1);
      body.strokePoints(this.outline, true);
    }
    // A bold outline keeps the silhouette crisp against busier, textured ground.
    body.lineStyle(3, edge, 1);
    body.strokePoints(this.outline, true);
    // One generous livery panel and one cockpit remain readable at flight scale.
    body.fillStyle(mixColor(paint.panel, LANDED.livery, landed), 1);
    body.fillRoundedRect(paint.panelX, -paint.panelHeight / 2, paint.panelWidth, paint.panelHeight, Math.min(4, paint.panelHeight / 2));
    // Military airframes carry no airline wing stripe; their own details are drawn below instead.
    if (this.type !== "rotor" && !this.military) {
      const wingX = this.type === "liner" ? -7 : -4;
      body.lineStyle(paint.wingWidth, mixColor(paint.wing, LANDED.livery, landed), 1);
      body.lineBetween(wingX, -19, wingX + 3, -9);
      body.lineBetween(wingX, 19, wingX + 3, 9);
    }
    // Engines under the wings and a light catching the spine give the airframe some depth.
    if (this.type !== "rotor" && !this.military) {
      body.fillStyle(mixColor(INK.keyline, LANDED.keyline, landed), 0.85);
      const engineX = this.type === "liner" ? 0 : 2;
      body.fillEllipse(engineX, -13, 8, 4);
      body.fillEllipse(engineX, 13, 8, 4);
    }
    body.fillStyle(0xffffff, 0.28 * (1 - landed));
    body.fillRoundedRect(this.type === "rotor" ? -14 : -22, -1, this.type === "rotor" ? 26 : 42, 2, 1);
    body.fillStyle(mixColor(paint.cockpit, LANDED.keyline, landed), 1);
    const ink = mixColor(INK.keyline, LANDED.keyline, landed);
    if (this.military && this.type === "commuter") {
      // A long bubble canopy forward, and twin exhaust nozzles at the tail.
      body.fillRoundedRect(10, -2.5, 13, 5, 2.5);
      body.fillStyle(ink, 0.85);
      body.fillRoundedRect(-30, -3.5, 5, 3, 1);
      body.fillRoundedRect(-30, 0.5, 5, 3, 1);
    } else if (this.military && this.type === "liner") {
      // A short flight deck, and four engines along the straight wing.
      body.fillRoundedRect(24, -3.5, 6, 7, 2);
      body.fillStyle(ink, 0.85);
      for (const y of [-19, -11, 11, 19]) body.fillEllipse(8, y, 9, 3.5);
    } else if (this.military) {
      // A two-seat gunship canopy, and a weapon pod under each stub wing.
      body.fillRoundedRect(10, -2.5, 12, 5, 2.5);
      body.fillStyle(ink, 0.85);
      for (const y of [-12, 12]) body.fillRoundedRect(-4, y - 1.5, 9, 3, 1.5);
    } else body.fillRoundedRect(this.type === "rotor" ? 14 : 20, -3.5, 6, 7, 2);
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
    this.placeShadow(state.heading, 0);
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
    this.updateLights();
  }
  setNight(night: boolean): void {
    this.night = night;
    this.updateLights();
  }
  /** Lights show in flight at night; the strobe flashes briefly once a second, or stays on with reduced motion. */
  private updateLights(): void {
    const on = this.night && !this.grounded;
    for (const light of this.navLights) light.setVisible(on);
    this.strobe.setVisible(on && (this.reducedMotion || this.strobeClock < 120));
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

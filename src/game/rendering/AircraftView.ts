import type { LiveryId } from '../../progression/liveries';
import Phaser from "phaser";
import { AIRCRAFT_OUTLINES } from "../../core/aircraftCollision";
import type { Aircraft } from "../../core/types";
import { AIRCRAFT_STYLE } from "../content";
import { withoutAbandonedTexture } from "./shared-map/composer";
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

/**
 * Each type's night light. A cone's length matches the aircraft's speed, so it shows roughly how far ahead
 * it will be: long and narrow for the fast airliner, medium for the commuter. The helicopter carries a
 * searchlight instead: a short, wide spill ending in the brightest pool, just ahead of its nose, which also
 * tells it apart in the dark.
 */
const NIGHT_LIGHTS: Readonly<Record<Aircraft["type"], { readonly reach: number; readonly spread: number; readonly glow: number; readonly pool: number }>> = {
  liner: { reach: 135, spread: 0.24, glow: 0.05, pool: 0.05 },
  commuter: { reach: 105, spread: 0.3, glow: 0.05, pool: 0.05 },
  rotor: { reach: 58, spread: 0.55, glow: 0.035, pool: 0.055 },
};

/**
 * The aircraft's light, in its own coordinates: a cone spreading ahead of the nose and ending in a pool of
 * light, built from faint layers so it is brightest along its middle and fades out at its edges and far end.
 * Drawn with additive blending, it lights the ground it falls on.
 */
function paintHeadlightBeam(graphics: Phaser.GameObjects.Graphics, nose: number, type: Aircraft["type"]): void {
  const { reach, spread: angle, glow, pool } = NIGHT_LIGHTS[type];
  const color = 0xfff4d6;
  for (let layer = 0; layer < 6; layer += 1) {
    const share = 1 - layer * 0.14;
    const spread = Math.tan(angle * share);
    const far = nose + reach * share;
    const points = [new Phaser.Math.Vector2(nose - 2, -2.5)];
    // The far edge is a gentle arc rather than a straight cut.
    for (let i = 0; i <= 8; i += 1) {
      const t = i / 8 - 0.5;
      points.push(new Phaser.Math.Vector2(far - Math.abs(t) * reach * 0.12 * share, t * 2 * reach * spread));
    }
    points.push(new Phaser.Math.Vector2(nose - 2, 2.5));
    graphics.fillStyle(color, glow);
    graphics.fillPoints(points, true);
  }
  if (type === "rotor") {
    // The searchlight's pool: round, and brightest at its heart; many faint layers so it shades without rings.
    for (let layer = 0; layer < 6; layer += 1) {
      graphics.fillStyle(color, pool);
      graphics.fillCircle(nose + reach * 0.62, 0, reach * (0.55 - layer * 0.075));
    }
    return;
  }
  // A brighter pool where the beam meets the ground.
  for (let layer = 0; layer < 3; layer += 1) {
    graphics.fillStyle(color, pool);
    graphics.fillEllipse(nose + reach * 0.72, 0, reach * (0.5 - layer * 0.12), reach * (0.36 - layer * 0.09));
  }
}

/** The airframe in flight colours (landed 0) or landed colours (1), in its own coordinates. */
function paintAirframe(body: Phaser.GameObjects.Graphics, outline: Phaser.Math.Vector2[], type: Aircraft["type"], livery: LiveryId, military: boolean, landed: number): void {
    const paint = aircraftLiveryPaint(livery, type);
    const keyline = mixColor(INK.keyline, LANDED.keyline, landed);
    const edge = mixColor(paint.edge, LANDED.keyline, landed);
    body.fillStyle(mixColor(paint.body, LANDED.body, landed), 1);
    body.fillPoints(outline, true);
    // Wings and tailplanes sit lower than the fuselage, so they read a shade darker.
    if (type !== "rotor") {
      body.fillStyle(INK.keyline, 0.14);
      for (const [from, to] of [[2, 5], [13, 16], [6, 9], [9, 12]]) body.fillPoints(outline.slice(from, to + 1), true);
    }
    // Midnight needs a pale edge on dark scenery, backed by dark ink on snow.
    if (livery === 'midnight') {
      body.lineStyle(4.4, keyline, 1);
      body.strokePoints(outline, true);
    }
    // A bold outline keeps the silhouette crisp against busier, textured ground.
    body.lineStyle(3, edge, 1);
    body.strokePoints(outline, true);
    // One generous livery panel and one cockpit remain readable at flight scale.
    body.fillStyle(mixColor(paint.panel, LANDED.livery, landed), 1);
    body.fillRoundedRect(paint.panelX, -paint.panelHeight / 2, paint.panelWidth, paint.panelHeight, Math.min(4, paint.panelHeight / 2));
    // Military airframes carry no airline wing stripe; their own details are drawn below instead.
    if (type !== "rotor" && !military) {
      const wingX = type === "liner" ? -7 : -4;
      body.lineStyle(paint.wingWidth, mixColor(paint.wing, LANDED.livery, landed), 1);
      body.lineBetween(wingX, -19, wingX + 3, -9);
      body.lineBetween(wingX, 19, wingX + 3, 9);
    }
    // Engines under the wings and a light catching the spine give the airframe some depth.
    if (type !== "rotor" && !military) {
      body.fillStyle(mixColor(INK.keyline, LANDED.keyline, landed), 0.85);
      const engineX = type === "liner" ? 0 : 2;
      body.fillEllipse(engineX, -13, 8, 4);
      body.fillEllipse(engineX, 13, 8, 4);
    }
    body.fillStyle(0xffffff, 0.28 * (1 - landed));
    body.fillRoundedRect(type === "rotor" ? -14 : -22, -1, type === "rotor" ? 26 : 42, 2, 1);
    body.fillStyle(mixColor(paint.cockpit, LANDED.keyline, landed), 1);
    const ink = mixColor(INK.keyline, LANDED.keyline, landed);
    if (military && type === "commuter") {
      // A long bubble canopy forward, and twin exhaust nozzles at the tail.
      body.fillRoundedRect(10, -2.5, 13, 5, 2.5);
      body.fillStyle(ink, 0.85);
      body.fillRoundedRect(-30, -3.5, 5, 3, 1);
      body.fillRoundedRect(-30, 0.5, 5, 3, 1);
    } else if (military && type === "liner") {
      // A short flight deck, and four engines along the straight wing.
      body.fillRoundedRect(24, -3.5, 6, 7, 2);
      body.fillStyle(ink, 0.85);
      for (const y of [-19, -11, 11, 19]) body.fillEllipse(8, y, 9, 3.5);
    } else if (military) {
      // A two-seat gunship canopy, and a weapon pod under each stub wing.
      body.fillRoundedRect(10, -2.5, 12, 5, 2.5);
      body.fillStyle(ink, 0.85);
      for (const y of [-12, 12]) body.fillRoundedRect(-4, y - 1.5, 9, 3, 1.5);
    } else body.fillRoundedRect(type === "rotor" ? 14 : 20, -3.5, 6, 7, 2);
}

/**
 * Draws `draw` once into a shared texture named `key`, `half` units either side of the origin at `scale`
 * texture pixels per unit, and returns the key. Every aircraft of a kind shows the same texture: live
 * vector shapes were re-triangulated every frame for every aircraft, the main cost of a busy shift.
 */
function bakedTexture(scene: Phaser.Scene, key: string, half: number, scale: number, draw: (graphics: Phaser.GameObjects.Graphics) => void): string {
  if (scene.textures.exists(key)) return key;
  const size = Math.ceil(half * 2 * scale);
  const texture = withoutAbandonedTexture(scene, () => scene.textures.addDynamicTexture(key, size, size)!, (made) => made);
  texture.camera.setOrigin(0, 0).setZoom(scale);
  const graphics = scene.make.graphics({ x: half, y: half }, false);
  draw(graphics);
  texture.draw(graphics);
  texture.render();
  graphics.destroy();
  return key;
}

/** Aircraft artwork baked once per type, livery and look into textures, then moved and turned. */
export class AircraftView {
  readonly container: Phaser.GameObjects.Container;
  readonly ring: Phaser.GameObjects.Arc;
  private readonly innerRing: Phaser.GameObjects.Arc;
  private readonly presentationScale: number;
  private readonly rotorAssembly?: Phaser.GameObjects.Image;
  private rotorAngle: number;
  private reducedMotion: boolean;
  private readonly livery: LiveryId;
  private readonly type: Aircraft["type"];
  private readonly military: boolean;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly body: Phaser.GameObjects.Image;
  /** The landed colours, fading in over the flight colours after touchdown. */
  private readonly landedBody: Phaser.GameObjects.Image;
  private shadowFill = 0.28;
  /** 0 = flight colours, 1 = landed colours. */
  private landedBlend = -1;
  /** Scale on the ground, at most GROUND_SCALE and small enough to fit this type's stand. */
  private groundScale = GROUND_SCALE;
  /** Night lights: landing lights at the nose throwing a beam ahead, and a red beacon that flashes. */
  private readonly headlight: Phaser.GameObjects.Image;
  private readonly noseLight: Phaser.GameObjects.Arc;
  private readonly beacon: Phaser.GameObjects.Arc[];
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
    const points = outline.map(([x, y]) => new Phaser.Math.Vector2(x, y));
    // Texture pixels per unit: as many as the screen shows, doubled so turned edges stay smooth.
    const shown = (scene.cameras?.main?.zoom ?? 1) * this.presentationScale;
    const sharp = Math.round(shown * 2 * 100) / 100;
    const kind = `${this.military ? "military" : "civil"}-${aircraft.type}`;
    const image = (key: string, scale: number) => scene.add.image(0, 0, key).setScale(1 / scale);
    const shadow = (this.shadow = image(bakedTexture(scene, `aircraft-shadow-${kind}-${sharp}`, 40, sharp, (graphics) => {
      graphics.fillStyle(INK.shadow, 1);
      graphics.fillPoints(points, true);
    }), sharp).setPosition(3, 4));
    const airframe = (landed: 0 | 1) => image(bakedTexture(scene, `aircraft-${kind}-${this.livery}-${landed}-${sharp}`, 40, sharp,
      (graphics) => paintAirframe(graphics, points, aircraft.type, this.livery, this.military, landed)), sharp);
    const body = (this.body = airframe(0));
    this.landedBody = airframe(1).setVisible(false);
    // The landing lights' beam lies on the ground ahead, under the airframe, glowing where it falls.
    // It is soft, so it bakes at screen sharpness.
    const nose = Math.max(...outline.map(([x]) => x));
    const beamScale = Math.round(shown * 100) / 100;
    this.headlight = image(bakedTexture(scene, `aircraft-beam-${kind}-${beamScale}`, nose + NIGHT_LIGHTS[aircraft.type].reach + 4, beamScale,
      (graphics) => paintHeadlightBeam(graphics, nose, aircraft.type)), beamScale).setBlendMode(Phaser.BlendModes.ADD);
    const children: Phaser.GameObjects.GameObject[] = [shadow, this.headlight, this.ring, this.innerRing, body, this.landedBody];
    if (aircraft.type === "rotor") {
      // A centered, symmetric rotor avoids the lopsided atlas wobble.
      this.rotorAssembly = image(bakedTexture(scene, `aircraft-rotor-${this.livery}-${sharp}`, 27, sharp, (graphics) => {
        graphics.fillStyle(INK.bodyHighlight, 0.08);
        graphics.fillCircle(0, 0, 25);
        graphics.fillStyle(aircraftLiveryPaint(this.livery, aircraft.type).rotor, 0.42);
        graphics.fillRoundedRect(-25, -1.5, 50, 3, 1.5);
        graphics.fillRoundedRect(-1.5, -25, 3, 50, 1.5);
      }), sharp).setPosition(5, 0).setRotation(this.rotorAngle);
      children.push(this.rotorAssembly);
      const hub = scene.add.circle(5, 0, 3, INK.bodyHighlight).setStrokeStyle(1.5, INK.keyline);
      children.push(hub);
    }
    // The lamps themselves sit just inside the nose; the red beacon at the tail, with a soft glow.
    this.noseLight = scene.add.circle(nose - 3, 0, 2.4, 0xfffbe8);
    const beaconX = outline.filter(([, y]) => y === 0).reduce((best, [x]) => Math.min(best, x), Infinity);
    this.beacon = [
      scene.add.circle(beaconX, 0, 6.5, 0xff2a1f, 0.35).setBlendMode(Phaser.BlendModes.ADD),
      scene.add.circle(beaconX, 0, 2.6, 0xff3b30),
    ];
    children.push(this.noseLight, ...this.beacon);
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
  /**
   * By day the shadow falls to the south-east, further the higher the aircraft. At night there is no sun:
   * nothing in the air casts a shadow, and a landed aircraft keeps only a soft contact shadow underneath,
   * fading in as it touches down.
   */
  private placeShadow(heading: number, altitude: number): void {
    const reach = this.night ? 0.15 : 1;
    const x = (3 + altitude * 9) * reach;
    const y = (4 + altitude * 12) * reach;
    const cos = Math.cos(heading), sin = Math.sin(heading);
    this.shadow.setPosition(x * cos + y * sin, -x * sin + y * cos).setAlpha(this.shadowFill * (this.night ? (1 - altitude) * 0.55 : 1 - altitude * 0.3));
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
    if (muteImmediately) this.blendToLanded(1);
  }
  /** Fades from flight colours (0) to landed colours (1): the landed airframe over the flight one, which never shows through. */
  private blendToLanded(landed: number): void {
    this.landedBody.setVisible(landed > 0).setAlpha(landed);
    this.body.setVisible(landed < 1);
    this.shadowFill = 0.28 + (LANDED.shadowAlpha - 0.28) * landed;
  }
  /** Draw a landed aircraft from presentation-only ground state. */
  syncGround(
    state: { readonly position: { x: number; y: number }; readonly heading: number; readonly alpha: number },
    deltaMilliseconds: number,
    rotorRunning: boolean,
  ): void {
    if (this.landedBlend >= 0 && this.landedBlend < 1) {
      this.landedBlend = this.reducedMotion ? 1 : Math.min(1, this.landedBlend + deltaMilliseconds / LANDED.blendMilliseconds);
      this.blendToLanded(this.landedBlend);
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
  /** Lights show in flight at night; the beacon flashes briefly once a second, or stays on with reduced motion. */
  private updateLights(): void {
    const on = this.night && !this.grounded;
    this.headlight.setVisible(on);
    this.noseLight.setVisible(on);
    const flash = on && (this.reducedMotion || this.strobeClock < 150);
    for (const light of this.beacon) light.setVisible(flash);
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

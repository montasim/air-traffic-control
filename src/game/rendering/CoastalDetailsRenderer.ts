import Phaser from 'phaser';
import type { Vector2 } from '../../core/types';
import {
  SALTMARSH_COLORS,
  type AirfieldPropAnchor,
  type SaltmarshLayout
} from '../maps/saltmarsh';
import {
  SALTMARSH_PALETTE,
  WORLD_DETAIL_BUDGETS,
  WORLD_LIGHT,
  colorToCss,
  resolveWorldDetailLevel,
  type WorldDetailLevel
} from '../palette';
import { DISPLAY_FONT_STACK } from '../typography';

const LIGHT = SALTMARSH_COLORS.runwayMark;
const MID = SALTMARSH_COLORS.sand;
const DARK = SALTMARSH_COLORS.runway;
const BUILDING = SALTMARSH_COLORS.airport;

export interface CoastalDetailsPaintOptions {
  detail?: WorldDetailLevel | string;
  detailLevel?: WorldDetailLevel | string;
}

export interface CoastalDetailsRenderOptions extends CoastalDetailsPaintOptions {
  depth?: number;
  labelDepth?: number;
}

/** Labels are returned so a static compositor can rasterize and destroy them. */
export interface StaticWorldLabelSpec {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly angle: number;
  readonly fontSize: number;
  readonly color: number;
  readonly alpha: number;
}

function localPoint(
  anchor: Pick<AirfieldPropAnchor, 'position' | 'angle'>,
  along: number,
  across = 0
): Vector2 {
  const forwardX = Math.cos(anchor.angle);
  const forwardY = Math.sin(anchor.angle);
  return {
    x: anchor.position.x + forwardX * along - forwardY * across,
    y: anchor.position.y + forwardY * along + forwardX * across
  };
}

function rotatedRectangle(
  center: Vector2,
  width: number,
  height: number,
  angle: number
): readonly Vector2[] {
  const frame = { position: center, angle };
  return [
    localPoint(frame, -width / 2, -height / 2),
    localPoint(frame, width / 2, -height / 2),
    localPoint(frame, width / 2, height / 2),
    localPoint(frame, -width / 2, height / 2)
  ];
}

function tracePolygon(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly Vector2[]
): void {
  if (points.length < 2) return;
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    graphics.lineTo(points[index].x, points[index].y);
  }
  graphics.closePath();
}

function drawBuildingShell(
  graphics: Phaser.GameObjects.Graphics,
  prop: AirfieldPropAnchor,
  width: number,
  height: number
): void {
  const corners = rotatedRectangle(prop.position, width, height, prop.angle);
  const shadow = corners.map((point) => ({
    x: point.x + WORLD_LIGHT.structureShadow.x,
    y: point.y + WORLD_LIGHT.structureShadow.y
  }));
  graphics.fillStyle(SALTMARSH_PALETTE.polderShadow, 0.32);
  tracePolygon(graphics, shadow);
  graphics.fillPath();
  graphics.fillStyle(BUILDING, 0.86);
  tracePolygon(graphics, corners);
  graphics.fillPath();
  graphics.lineStyle(1.4, SALTMARSH_PALETTE.roofHighlight, 0.26);
  graphics.lineBetween(corners[0].x, corners[0].y, corners[1].x, corners[1].y);
  graphics.lineBetween(corners[0].x, corners[0].y, corners[3].x, corners[3].y);
  graphics.lineStyle(1.2, DARK, 0.54);
  graphics.lineBetween(corners[1].x, corners[1].y, corners[2].x, corners[2].y);
  graphics.lineBetween(corners[2].x, corners[2].y, corners[3].x, corners[3].y);
}

function drawWindsock(
  graphics: Phaser.GameObjects.Graphics,
  prop: AirfieldPropAnchor
): void {
  const mastBase = localPoint(prop, -prop.size * 0.36);
  graphics.lineStyle(Math.max(1.5, prop.size * 0.08), LIGHT, 0.48);
  graphics.lineBetween(mastBase.x, mastBase.y, prop.position.x, prop.position.y);
  graphics.fillStyle(DARK, 0.9);
  graphics.fillCircle(mastBase.x, mastBase.y, Math.max(2, prop.size * 0.1));

  const sock = [
    localPoint(prop, 0, -prop.size * 0.21),
    localPoint(prop, prop.size, -prop.size * 0.1),
    localPoint(prop, prop.size * 0.9, prop.size * 0.1),
    localPoint(prop, 0, prop.size * 0.21)
  ];
  graphics.fillStyle(SALTMARSH_PALETTE.safetyRed, 0.82);
  tracePolygon(graphics, sock);
  graphics.fillPath();
  graphics.lineStyle(1, LIGHT, 0.4);
  for (const progress of [0.34, 0.66]) {
    const upper = localPoint(prop, prop.size * progress, -prop.size * (0.21 - progress * 0.11));
    const lower = localPoint(prop, prop.size * progress, prop.size * (0.21 - progress * 0.11));
    graphics.lineBetween(upper.x, upper.y, lower.x, lower.y);
  }
}

function drawHangar(
  graphics: Phaser.GameObjects.Graphics,
  prop: AirfieldPropAnchor
): void {
  const width = prop.size;
  const height = prop.size * 0.48;
  drawBuildingShell(graphics, prop, width, height);

  const ridgeStart = localPoint(prop, -width * 0.48);
  const ridgeEnd = localPoint(prop, width * 0.48);
  graphics.lineStyle(1.5, LIGHT, 0.28);
  graphics.lineBetween(ridgeStart.x, ridgeStart.y, ridgeEnd.x, ridgeEnd.y);

  graphics.lineStyle(2, DARK, 0.68);
  for (const progress of [-0.28, 0, 0.28]) {
    const doorStart = localPoint(prop, progress * width, height * 0.2);
    const doorEnd = localPoint(prop, progress * width, height * 0.47);
    graphics.lineBetween(doorStart.x, doorStart.y, doorEnd.x, doorEnd.y);
  }
}

function drawServiceBuilding(
  graphics: Phaser.GameObjects.Graphics,
  prop: AirfieldPropAnchor
): void {
  const width = prop.size;
  const height = prop.size * 0.58;
  drawBuildingShell(graphics, prop, width, height);

  const roofA = localPoint(prop, -width * 0.28, -height * 0.12);
  const roofB = localPoint(prop, width * 0.28, -height * 0.12);
  const roofC = localPoint(prop, width * 0.28, height * 0.12);
  const roofD = localPoint(prop, -width * 0.28, height * 0.12);
  graphics.fillStyle(MID, 0.2);
  tracePolygon(graphics, [roofA, roofB, roofC, roofD]);
  graphics.fillPath();

  drawServiceCart(graphics, prop);
}

function drawServiceCart(
  graphics: Phaser.GameObjects.Graphics,
  prop: AirfieldPropAnchor
): void {
  const center = localPoint(prop, prop.size * 0.78, prop.size * 0.16);
  const frame = { position: center, angle: prop.angle };
  const body = rotatedRectangle(center, prop.size * 0.34, prop.size * 0.16, prop.angle);
  graphics.fillStyle(SALTMARSH_PALETTE.serviceRoad, 0.62);
  tracePolygon(graphics, body);
  graphics.fillPath();
  graphics.lineStyle(1, DARK, 0.62);
  tracePolygon(graphics, body);
  graphics.strokePath();

  const cab = localPoint(frame, prop.size * 0.08);
  graphics.fillStyle(LIGHT, 0.3);
  graphics.fillCircle(cab.x, cab.y, Math.max(1.5, prop.size * 0.055));
  graphics.fillStyle(DARK, 0.78);
  for (const [along, across] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]] as const) {
    const wheel = localPoint(frame, prop.size * along, prop.size * across);
    graphics.fillCircle(wheel.x, wheel.y, Math.max(1.25, prop.size * 0.035));
  }
}

function drawFuelFarm(
  graphics: Phaser.GameObjects.Graphics,
  prop: AirfieldPropAnchor
): void {
  const radius = Math.max(4, prop.size * 0.22);
  const first = localPoint(prop, 0, -prop.size * 0.28);
  const second = localPoint(prop, 0, prop.size * 0.28);
  for (const tank of [first, second]) {
    graphics.fillStyle(SALTMARSH_PALETTE.polderShadow, 0.26);
    graphics.fillCircle(
      tank.x + WORLD_LIGHT.structureShadow.x,
      tank.y + WORLD_LIGHT.structureShadow.y,
      radius
    );
    graphics.fillStyle(MID, 0.28);
    graphics.fillCircle(tank.x, tank.y, radius);
    graphics.lineStyle(1.5, LIGHT, 0.38);
    graphics.strokeCircle(tank.x, tank.y, radius);
    graphics.fillStyle(DARK, 0.64);
    graphics.fillCircle(tank.x, tank.y, Math.max(1.5, radius * 0.18));
  }
  graphics.lineStyle(1.5, SALTMARSH_PALETTE.safetyRed, 0.34);
  graphics.lineBetween(first.x, first.y, second.x, second.y);
}

function drawPerimeterFence(
  graphics: Phaser.GameObjects.Graphics,
  prop: AirfieldPropAnchor
): void {
  const halfLength = prop.size / 2;
  const gateHalf = prop.size * 0.11;
  const left = localPoint(prop, -halfLength);
  const leftGate = localPoint(prop, -gateHalf);
  const rightGate = localPoint(prop, gateHalf);
  const right = localPoint(prop, halfLength);
  graphics.lineStyle(1.5, LIGHT, 0.3);
  graphics.lineBetween(left.x, left.y, leftGate.x, leftGate.y);
  graphics.lineBetween(rightGate.x, rightGate.y, right.x, right.y);

  graphics.fillStyle(LIGHT, 0.42);
  for (let index = -5; index <= 5; index += 1) {
    if (index === -1 || index === 0 || index === 1) continue;
    const post = localPoint(prop, (index / 10) * prop.size);
    graphics.fillCircle(post.x, post.y, Math.max(1.2, prop.size * 0.012));
  }

  const gateDepth = prop.size * 0.1;
  const gateA = localPoint(prop, -gateHalf, -gateDepth);
  const gateB = localPoint(prop, gateHalf, -gateDepth);
  graphics.lineStyle(1.5, SALTMARSH_PALETTE.safetyRed, 0.48);
  graphics.lineBetween(leftGate.x, leftGate.y, gateA.x, gateA.y);
  graphics.lineBetween(gateA.x, gateA.y, gateB.x, gateB.y);
  graphics.lineBetween(gateB.x, gateB.y, rightGate.x, rightGate.y);
}

function drawUtilityYard(
  graphics: Phaser.GameObjects.Graphics,
  prop: AirfieldPropAnchor
): void {
  const yardWidth = prop.size;
  const yardHeight = prop.size * 0.62;
  const yard = rotatedRectangle(prop.position, yardWidth, yardHeight, prop.angle);
  graphics.fillStyle(DARK, 0.24);
  tracePolygon(graphics, yard);
  graphics.fillPath();
  graphics.lineStyle(1.25, LIGHT, 0.28);
  tracePolygon(graphics, yard);
  graphics.strokePath();

  for (const [along, across] of [[-0.24, -0.16], [0.06, -0.12], [0.22, 0.16]] as const) {
    const boxCenter = localPoint(prop, prop.size * along, prop.size * across);
    const box = rotatedRectangle(boxCenter, prop.size * 0.22, prop.size * 0.16, prop.angle);
    graphics.fillStyle(SALTMARSH_COLORS.serviceRoad, 0.36);
    tracePolygon(graphics, box);
    graphics.fillPath();
    graphics.lineStyle(1, LIGHT, 0.24);
    tracePolygon(graphics, box);
    graphics.strokePath();
  }

  // Paired outfall pipes make the utility anchor read as the polder pump yard.
  graphics.lineStyle(Math.max(1.2, prop.size * 0.035), SALTMARSH_PALETTE.drainageWater, 0.58);
  for (const across of [-0.09, 0.09]) {
    const start = localPoint(prop, prop.size * 0.46, prop.size * across);
    const finish = localPoint(prop, prop.size * 0.86, prop.size * across);
    graphics.lineBetween(start.x, start.y, finish.x, finish.y);
  }
}

function drawProp(
  graphics: Phaser.GameObjects.Graphics,
  prop: AirfieldPropAnchor
): void {
  switch (prop.kind) {
    case 'windsock':
      drawWindsock(graphics, prop);
      return;
    case 'hangar':
      drawHangar(graphics, prop);
      return;
    case 'service':
      drawServiceBuilding(graphics, prop);
      return;
    case 'fuel':
      drawFuelFarm(graphics, prop);
      return;
    case 'fence':
      drawPerimeterFence(graphics, prop);
      return;
    case 'utility':
      drawUtilityYard(graphics, prop);
      return;
  }
}

function readableAngle(angle: number): number {
  let normalized = Math.atan2(Math.sin(angle), Math.cos(angle));
  if (normalized > Math.PI / 2) normalized -= Math.PI;
  if (normalized < -Math.PI / 2) normalized += Math.PI;
  return normalized;
}

function paintSigns(
  graphics: Phaser.GameObjects.Graphics,
  layout: SaltmarshLayout,
  detail: WorldDetailLevel
): StaticWorldLabelSpec[] {
  const unit = Math.min(layout.width, layout.height);
  const fontSize = Math.max(10, Math.min(14, unit * 0.014));
  const labels: StaticWorldLabelSpec[] = [];
  const showFacilityLabels = WORLD_DETAIL_BUDGETS[detail].showFacilityLabels;

  // The layout contract currently exposes exactly A, B, FUEL, and OPS. The
  // slice is a hard ceiling so scenery can never create an unbounded text set.
  for (const sign of layout.signs.slice(0, 4)) {
    if (sign.kind === 'facility' && !showFacilityLabels) continue;
    const angle = readableAngle(sign.angle);
    const boardWidth = Math.max(fontSize * 1.45, sign.label.length * fontSize * 0.62 + 9);
    const boardHeight = fontSize + 7;
    const board = rotatedRectangle(sign.position, boardWidth, boardHeight, angle);
    graphics.fillStyle(DARK, sign.kind === 'taxiway' ? 0.9 : 0.78);
    tracePolygon(graphics, board);
    graphics.fillPath();
    graphics.lineStyle(
      1,
      sign.kind === 'taxiway' ? SALTMARSH_PALETTE.taxiwayMarking : LIGHT,
      0.46
    );
    tracePolygon(graphics, board);
    graphics.strokePath();

    labels.push({
      x: sign.position.x,
      y: sign.position.y,
      text: sign.label,
      angle,
      fontSize,
      color: LIGHT,
      alpha: 0.72
    });
  }
  return labels;
}

/**
 * Paint facilities into a caller-owned static layer and return bounded label
 * specs for optional RenderTexture compositing.
 */
export function paintCoastalDetails(
  graphics: Phaser.GameObjects.Graphics,
  layout: SaltmarshLayout,
  options: CoastalDetailsPaintOptions = {}
): readonly StaticWorldLabelSpec[] {
  const detail = resolveWorldDetailLevel(options.detailLevel ?? options.detail);
  for (const prop of layout.propAnchors) drawProp(graphics, prop);
  return paintSigns(graphics, layout, detail);
}

/** Backwards-compatible retained renderer with caller-controlled depths. */
export function renderCoastalDetails(
  scene: Phaser.Scene,
  layout: SaltmarshLayout,
  options: CoastalDetailsRenderOptions = {}
): Phaser.GameObjects.Graphics {
  const depth = options.depth ?? -4;
  const graphics = scene.add.graphics().setDepth(depth);
  const labels = paintCoastalDetails(graphics, layout, options);
  for (const label of labels) {
    scene.add.text(label.x, label.y, label.text, {
      color: colorToCss(label.color),
      fontFamily: DISPLAY_FONT_STACK,
      fontSize: `${label.fontSize}px`,
      fontStyle: 'bold'
    }).setOrigin(0.5)
      .setRotation(label.angle)
      .setAlpha(label.alpha)
      .setDepth(options.labelDepth ?? depth + 1);
  }
  return graphics;
}

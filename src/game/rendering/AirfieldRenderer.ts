import Phaser from 'phaser';
import type { Vector2 } from '../../core/types';
import type { MapRunway, SaltmarshLayout } from '../maps/saltmarsh';
import {
  SALTMARSH_PALETTE,
  WORLD_DETAIL_BUDGETS,
  WORLD_LIGHT,
  resolveWorldDetailLevel,
  type WorldDetailLevel
} from '../palette';

export interface AirfieldPaintOptions {
  detail?: WorldDetailLevel | string;
  detailLevel?: WorldDetailLevel | string;
}

export interface AirfieldRenderOptions extends AirfieldPaintOptions {
  depth?: number;
  includePavements?: boolean;
  includeWear?: boolean;
}

export interface AirfieldEnvironmentGeometry {
  readonly outerPolder: readonly Vector2[];
  readonly raisedPlatform: readonly Vector2[];
  readonly drainageRing: readonly Vector2[];
  readonly perimeterRoad: readonly Vector2[];
  readonly perimeterFence: readonly Vector2[];
  readonly causeway: readonly Vector2[];
  readonly gate: Vector2;
  readonly gradedStrips: readonly (readonly Vector2[])[];
  readonly approachClearZones: readonly (readonly Vector2[])[];
}

const POLDER_POINTS = {
  landscape: [
    [0.505, 0.195], [0.68, 0.155], [0.895, 0.18], [0.985, 0.275],
    [0.97, 0.43], [0.9, 0.57], [0.735, 0.67], [0.575, 0.62],
    [0.49, 0.5], [0.475, 0.33]
  ],
  portrait: [
    [0.29, 0.145], [0.57, 0.105], [0.86, 0.125], [1.025, 0.225],
    [1.015, 0.34], [0.925, 0.43], [0.72, 0.5], [0.485, 0.47],
    [0.315, 0.365], [0.255, 0.235]
  ],
  square: [
    [0.385, 0.205], [0.63, 0.16], [0.83, 0.195], [0.95, 0.3],
    [0.935, 0.455], [0.84, 0.585], [0.64, 0.655], [0.445, 0.59],
    [0.345, 0.455], [0.34, 0.305]
  ]
} as const;

const CAUSEWAY_POINTS = {
  landscape: [[0.88, 0.555], [0.955, 0.52], [1.04, 0.46]],
  portrait: [[0.91, 0.415], [0.98, 0.43], [1.055, 0.47]],
  square: [[0.825, 0.57], [0.92, 0.61], [1.05, 0.65]]
} as const;

function normalizedPoints(
  layout: SaltmarshLayout,
  points: readonly (readonly [number, number])[]
): Vector2[] {
  return points.map(([x, y]) => ({ x: x * layout.width, y: y * layout.height }));
}

function polygonCenter(points: readonly Vector2[]): Vector2 {
  const total = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 }
  );
  return { x: total.x / points.length, y: total.y / points.length };
}

function scalePolygon(points: readonly Vector2[], scale: number): Vector2[] {
  const center = polygonCenter(points);
  return points.map((point) => ({
    x: center.x + (point.x - center.x) * scale,
    y: center.y + (point.y - center.y) * scale
  }));
}

function offsetPolygon(points: readonly Vector2[], x: number, y: number): Vector2[] {
  return points.map((point) => ({ x: point.x + x, y: point.y + y }));
}

function tracePolygon(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly Vector2[]
): void {
  if (points.length < 3) return;
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    graphics.lineTo(points[index].x, points[index].y);
  }
  graphics.closePath();
}

function strokePolyline(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly Vector2[],
  close = false
): void {
  if (points.length < 2) return;
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    graphics.lineTo(points[index].x, points[index].y);
  }
  if (close) graphics.closePath();
  graphics.strokePath();
}

function localPoint(runway: MapRunway, along: number, across = 0): Vector2 {
  const forwardX = Math.cos(runway.angle);
  const forwardY = Math.sin(runway.angle);
  return {
    x: runway.center.x + forwardX * along - forwardY * across,
    y: runway.center.y + forwardY * along + forwardX * across
  };
}

function runwayRectangle(
  runway: MapRunway,
  lengthPad: number,
  widthPad: number
): readonly Vector2[] {
  const halfLength = runway.length / 2 + lengthPad;
  const halfWidth = runway.width / 2 + widthPad;
  return [
    localPoint(runway, -halfLength, -halfWidth),
    localPoint(runway, halfLength, -halfWidth),
    localPoint(runway, halfLength, halfWidth),
    localPoint(runway, -halfLength, halfWidth)
  ];
}

function approachClearZone(runway: MapRunway, end: -1 | 1): readonly Vector2[] {
  const threshold = end * (runway.length / 2 + runway.width * 0.18);
  const far = end * (runway.length / 2 + runway.width * 2.45);
  const nearHalfWidth = runway.width * 0.88;
  const farHalfWidth = runway.width * 1.34;
  return [
    localPoint(runway, threshold, -nearHalfWidth),
    localPoint(runway, far, -farHalfWidth),
    localPoint(runway, far, farHalfWidth),
    localPoint(runway, threshold, nearHalfWidth)
  ];
}

function interpolate(first: Vector2, second: Vector2, progress: number): Vector2 {
  return {
    x: first.x + (second.x - first.x) * progress,
    y: first.y + (second.y - first.y) * progress
  };
}

function distance(first: Vector2, second: Vector2): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function deterministicUnit(index: number, salt: number): number {
  let value = Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(salt + 17, 0x119de1f3);
  value ^= value >>> 16;
  value = Math.imul(value, 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 0xffffffff;
}

/** Pure, deterministic geometry derived from the existing layout seam. */
export function createAirfieldEnvironmentGeometry(
  layout: SaltmarshLayout
): AirfieldEnvironmentGeometry {
  const outerPolder = normalizedPoints(layout, POLDER_POINTS[layout.variant]);
  const causeway = normalizedPoints(layout, CAUSEWAY_POINTS[layout.variant]);
  return {
    outerPolder,
    raisedPlatform: scalePolygon(outerPolder, 0.955),
    drainageRing: scalePolygon(outerPolder, 0.87),
    perimeterRoad: scalePolygon(outerPolder, 0.915),
    perimeterFence: scalePolygon(outerPolder, 0.975),
    causeway,
    gate: interpolate(causeway[0], causeway[1], 0.2),
    gradedStrips: layout.runways.map((runway) =>
      runwayRectangle(runway, runway.width * 0.36, runway.width * 0.92)
    ),
    approachClearZones: layout.runways.flatMap((runway) => [
      approachClearZone(runway, -1),
      approachClearZone(runway, 1)
    ])
  };
}

function paintCauseway(
  graphics: Phaser.GameObjects.Graphics,
  geometry: AirfieldEnvironmentGeometry,
  unit: number
): void {
  const shadowOffset = Math.max(0.8, unit / 900);
  const shadow = geometry.causeway.map((point) => ({
    x: point.x + WORLD_LIGHT.polderShadow.x * shadowOffset,
    y: point.y + WORLD_LIGHT.polderShadow.y * shadowOffset
  }));
  graphics.lineStyle(Math.max(22, unit * 0.042), SALTMARSH_PALETTE.polderShadow, 0.3);
  strokePolyline(graphics, shadow);
  graphics.lineStyle(Math.max(20, unit * 0.039), SALTMARSH_PALETTE.revetment, 0.96);
  strokePolyline(graphics, geometry.causeway);
  graphics.lineStyle(Math.max(8, unit * 0.015), SALTMARSH_PALETTE.serviceRoad, 0.74);
  strokePolyline(graphics, geometry.causeway);
  graphics.lineStyle(Math.max(1.2, unit * 0.002), SALTMARSH_PALETTE.marking, 0.16);
  strokePolyline(graphics, geometry.causeway);
}

function paintPolderRelief(
  graphics: Phaser.GameObjects.Graphics,
  geometry: AirfieldEnvironmentGeometry,
  unit: number
): void {
  const shadowScale = Math.max(0.8, unit / 900);
  graphics.fillStyle(SALTMARSH_PALETTE.polderShadow, 0.34);
  tracePolygon(graphics, offsetPolygon(
    geometry.outerPolder,
    WORLD_LIGHT.polderShadow.x * shadowScale,
    WORLD_LIGHT.polderShadow.y * shadowScale
  ));
  graphics.fillPath();

  graphics.fillStyle(SALTMARSH_PALETTE.revetment, 0.94);
  tracePolygon(graphics, geometry.outerPolder);
  graphics.fillPath();
  graphics.lineStyle(Math.max(1.5, unit * 0.0022), SALTMARSH_PALETTE.saltFilm, 0.18);
  strokePolyline(graphics, geometry.outerPolder, true);

  graphics.fillStyle(SALTMARSH_PALETTE.raisedTurf, 1);
  tracePolygon(graphics, geometry.raisedPlatform);
  graphics.fillPath();
  graphics.lineStyle(Math.max(1.25, unit * 0.0018), SALTMARSH_PALETTE.roofHighlight, 0.12);
  strokePolyline(graphics, geometry.raisedPlatform.slice(0, 5), false);
}

function paintGrading(
  graphics: Phaser.GameObjects.Graphics,
  layout: SaltmarshLayout,
  geometry: AirfieldEnvironmentGeometry,
  detail: WorldDetailLevel
): void {
  graphics.fillStyle(SALTMARSH_PALETTE.gradedTurf, 0.5);
  for (const zone of geometry.approachClearZones) {
    tracePolygon(graphics, zone);
    graphics.fillPath();
  }
  graphics.fillStyle(SALTMARSH_PALETTE.gradedTurf, 0.82);
  for (const strip of geometry.gradedStrips) {
    tracePolygon(graphics, strip);
    graphics.fillPath();
  }

  if (detail === 'mobile') return;
  graphics.lineStyle(1, SALTMARSH_PALETTE.saltFilm, 0.1);
  for (const runway of layout.runways) {
    for (const end of [-1, 1] as const) {
      for (const across of [-0.62, 0, 0.62]) {
        const start = localPoint(
          runway,
          end * (runway.length / 2 + runway.width * 0.35),
          runway.width * across
        );
        const finish = localPoint(
          runway,
          end * (runway.length / 2 + runway.width * 2.18),
          runway.width * across * 1.45
        );
        graphics.lineBetween(start.x, start.y, finish.x, finish.y);
      }
    }
  }
}

function paintDrainage(
  graphics: Phaser.GameObjects.Graphics,
  layout: SaltmarshLayout,
  geometry: AirfieldEnvironmentGeometry,
  unit: number
): void {
  graphics.lineStyle(Math.max(5, unit * 0.007), SALTMARSH_PALETTE.drainageEdge, 0.36);
  strokePolyline(graphics, geometry.drainageRing, true);
  graphics.lineStyle(Math.max(2.5, unit * 0.0038), SALTMARSH_PALETTE.drainageWater, 0.92);
  strokePolyline(graphics, geometry.drainageRing, true);

  for (const runway of layout.runways) {
    for (const side of [-1, 1]) {
      const start = localPoint(runway, -runway.length * 0.39, side * runway.width * 1.52);
      const finish = localPoint(runway, runway.length * 0.39, side * runway.width * 1.52);
      graphics.lineStyle(Math.max(2, unit * 0.0028), SALTMARSH_PALETTE.drainageWater, 0.58);
      graphics.lineBetween(start.x, start.y, finish.x, finish.y);
    }
  }

  // Culvert bars make the causeway/drainage crossing legible without labels.
  const causewayAngle = Math.atan2(
    geometry.causeway[1].y - geometry.causeway[0].y,
    geometry.causeway[1].x - geometry.causeway[0].x
  );
  const crossX = Math.cos(causewayAngle + Math.PI / 2);
  const crossY = Math.sin(causewayAngle + Math.PI / 2);
  const culvert = interpolate(geometry.causeway[0], geometry.causeway[1], 0.38);
  graphics.lineStyle(Math.max(1.3, unit * 0.0018), SALTMARSH_PALETTE.marking, 0.28);
  for (const offset of [-3, 3]) {
    graphics.lineBetween(
      culvert.x + Math.cos(causewayAngle) * offset - crossX * unit * 0.012,
      culvert.y + Math.sin(causewayAngle) * offset - crossY * unit * 0.012,
      culvert.x + Math.cos(causewayAngle) * offset + crossX * unit * 0.012,
      culvert.y + Math.sin(causewayAngle) * offset + crossY * unit * 0.012
    );
  }
}

function paintRoadAndFence(
  graphics: Phaser.GameObjects.Graphics,
  geometry: AirfieldEnvironmentGeometry,
  unit: number,
  detail: WorldDetailLevel
): void {
  graphics.lineStyle(Math.max(7, unit * 0.01), SALTMARSH_PALETTE.asphalt, 0.22);
  strokePolyline(graphics, geometry.perimeterRoad, true);
  graphics.lineStyle(Math.max(3.5, unit * 0.005), SALTMARSH_PALETTE.serviceRoad, 0.55);
  strokePolyline(graphics, geometry.perimeterRoad, true);

  graphics.lineStyle(Math.max(1, unit * 0.0015), SALTMARSH_PALETTE.fence, 0.42);
  const fence = geometry.perimeterFence;
  for (let index = 0; index < fence.length; index += 1) {
    const start = fence[index];
    const finish = fence[(index + 1) % fence.length];
    if (distance(interpolate(start, finish, 0.5), geometry.gate) < unit * 0.06) continue;
    graphics.lineBetween(start.x, start.y, finish.x, finish.y);
  }

  const budget = WORLD_DETAIL_BUDGETS[detail];
  graphics.fillStyle(SALTMARSH_PALETTE.fence, 0.48);
  for (let index = 0; index < budget.fencePosts; index += 1) {
    const edgeProgress = (index / budget.fencePosts) * fence.length;
    const edgeIndex = Math.floor(edgeProgress) % fence.length;
    const progress = edgeProgress - Math.floor(edgeProgress);
    const post = interpolate(fence[edgeIndex], fence[(edgeIndex + 1) % fence.length], progress);
    if (distance(post, geometry.gate) < unit * 0.035) continue;
    graphics.fillCircle(post.x, post.y, Math.max(0.9, unit * 0.00135));
  }

  const causewayAngle = Math.atan2(
    geometry.causeway[1].y - geometry.causeway[0].y,
    geometry.causeway[1].x - geometry.causeway[0].x
  );
  const crossX = Math.cos(causewayAngle + Math.PI / 2);
  const crossY = Math.sin(causewayAngle + Math.PI / 2);
  const gateHalf = unit * 0.015;
  graphics.lineStyle(Math.max(1.5, unit * 0.002), SALTMARSH_PALETTE.safetyRed, 0.58);
  graphics.lineBetween(
    geometry.gate.x - crossX * gateHalf,
    geometry.gate.y - crossY * gateHalf,
    geometry.gate.x + crossX * gateHalf,
    geometry.gate.y + crossY * gateHalf
  );
  graphics.fillStyle(SALTMARSH_PALETTE.fence, 0.84);
  graphics.fillCircle(
    geometry.gate.x - crossX * gateHalf,
    geometry.gate.y - crossY * gateHalf,
    Math.max(1.4, unit * 0.0018)
  );
  graphics.fillCircle(
    geometry.gate.x + crossX * gateHalf,
    geometry.gate.y + crossY * gateHalf,
    Math.max(1.4, unit * 0.0018)
  );
}

function smoothedPath(points: readonly Vector2[], subdivisions: number): Vector2[] {
  if (points.length < 3) return [...points];
  const result: Vector2[] = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const start = interpolate(previous, corner, 0.62);
    const finish = interpolate(corner, next, 0.38);
    if (distance(result[result.length - 1], start) > 0.1) result.push(start);
    for (let step = 1; step <= subdivisions; step += 1) {
      const progress = step / subdivisions;
      const inverse = 1 - progress;
      result.push({
        x: inverse * inverse * start.x + 2 * inverse * progress * corner.x + progress * progress * finish.x,
        y: inverse * inverse * start.y + 2 * inverse * progress * corner.y + progress * progress * finish.y
      });
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

/** Paint the raised island and its civil infrastructure below paved surfaces. */
export function paintAirfieldGround(
  graphics: Phaser.GameObjects.Graphics,
  layout: SaltmarshLayout,
  options: AirfieldPaintOptions = {}
): void {
  const detail = resolveWorldDetailLevel(options.detailLevel ?? options.detail);
  const unit = Math.min(layout.width, layout.height);
  const geometry = createAirfieldEnvironmentGeometry(layout);
  paintCauseway(graphics, geometry, unit);
  paintPolderRelief(graphics, geometry, unit);
  paintGrading(graphics, layout, geometry, detail);
  paintDrainage(graphics, layout, geometry, unit);
  paintRoadAndFence(graphics, geometry, unit, detail);
}

/**
 * Paints apron and smoothly filleted taxiway ribbons. Runways and their labels
 * remain owned by the existing map renderer during incremental integration.
 */
export function paintAirfieldPavements(
  graphics: Phaser.GameObjects.Graphics,
  layout: SaltmarshLayout,
  options: AirfieldPaintOptions = {}
): void {
  const detail = resolveWorldDetailLevel(options.detailLevel ?? options.detail);
  graphics.fillStyle(SALTMARSH_PALETTE.concrete, 0.96);
  tracePolygon(graphics, layout.apron);
  graphics.fillPath();
  graphics.lineStyle(1.25, SALTMARSH_PALETTE.concreteEdge, 0.48);
  strokePolyline(graphics, layout.apron, true);

  const subdivisions = detail === 'mobile' ? 4 : detail === 'tablet' ? 6 : 8;
  for (const taxiway of layout.taxiways) {
    const centerline = smoothedPath(taxiway.path, subdivisions);
    graphics.lineStyle(taxiway.width + 5, SALTMARSH_PALETTE.revetment, 0.82);
    strokePolyline(graphics, centerline);
    graphics.lineStyle(taxiway.width, SALTMARSH_PALETTE.asphalt, 1);
    strokePolyline(graphics, centerline);
    graphics.fillStyle(SALTMARSH_PALETTE.asphalt, 1);
    graphics.fillCircle(centerline[0].x, centerline[0].y, taxiway.width / 2);
    graphics.fillCircle(
      centerline[centerline.length - 1].x,
      centerline[centerline.length - 1].y,
      taxiway.width / 2
    );
    graphics.lineStyle(
      Math.max(1.2, taxiway.width * 0.1),
      SALTMARSH_PALETTE.taxiwayMarking,
      0.64
    );
    strokePolyline(graphics, centerline);
  }
}

/** Paint deterministic runway rubber, repairs, taxi polish, and apron stains. */
export function paintAirfieldSurfaceWear(
  graphics: Phaser.GameObjects.Graphics,
  layout: SaltmarshLayout,
  options: AirfieldPaintOptions = {}
): void {
  const detail = resolveWorldDetailLevel(options.detailLevel ?? options.detail);
  const budget = WORLD_DETAIL_BUDGETS[detail];
  const runwayMarks = Math.max(6, Math.floor(budget.wearMarks / layout.runways.length));

  for (let runwayIndex = 0; runwayIndex < layout.runways.length; runwayIndex += 1) {
    const runway = layout.runways[runwayIndex];
    graphics.lineStyle(Math.max(1.2, runway.width * 0.026), SALTMARSH_PALETTE.asphaltRubber, 0.19);
    for (let index = 0; index < runwayMarks; index += 1) {
      const end = index % 2 === 0 ? -1 : 1;
      const longitudinalJitter = deterministicUnit(index, runwayIndex * 11 + 3) - 0.5;
      const lateralJitter = deterministicUnit(index, runwayIndex * 17 + 9) - 0.5;
      const along = end * runway.length * (0.2 + longitudinalJitter * 0.075);
      const across = lateralJitter * runway.width * 0.38;
      const length = runway.width * (0.24 + deterministicUnit(index, 31) * 0.42);
      const start = localPoint(runway, along - length / 2, across);
      const finish = localPoint(runway, along + length / 2, across);
      graphics.lineBetween(start.x, start.y, finish.x, finish.y);
    }

    if (detail !== 'mobile') {
      graphics.lineStyle(Math.max(0.8, runway.width * 0.016), SALTMARSH_PALETTE.concreteEdge, 0.16);
      for (const progress of [-0.08, 0.12]) {
        const center = localPoint(runway, runway.length * progress);
        const edgeA = localPoint(runway, runway.length * progress, -runway.width * 0.46);
        const edgeB = localPoint(runway, runway.length * progress, runway.width * 0.46);
        graphics.lineBetween(edgeA.x, edgeA.y, center.x, center.y);
        graphics.lineBetween(center.x, center.y, edgeB.x, edgeB.y);
      }
    }
  }

  for (const taxiway of layout.taxiways) {
    const centerline = smoothedPath(taxiway.path, detail === 'desktop' ? 8 : 4);
    graphics.lineStyle(
      Math.max(1.4, taxiway.width * 0.18),
      SALTMARSH_PALETTE.asphaltWorn,
      0.3
    );
    strokePolyline(graphics, centerline);
  }

  graphics.fillStyle(SALTMARSH_PALETTE.asphaltRubber, 0.16);
  const standLimit = detail === 'mobile' ? 1 : layout.parkingStands.length;
  for (const stand of layout.parkingStands.slice(0, standLimit)) {
    graphics.fillEllipse(
      stand.position.x + Math.cos(stand.angle) * stand.length * 0.08,
      stand.position.y + Math.sin(stand.angle) * stand.length * 0.08,
      Math.max(5, stand.length * 0.22),
      Math.max(3, stand.length * 0.1)
    );
  }
}

/** Convenience retained renderer; integration may instead call the paint phases. */
export function renderAirfieldEnvironment(
  scene: Phaser.Scene,
  layout: SaltmarshLayout,
  options: AirfieldRenderOptions = {}
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setDepth(options.depth ?? -8);
  paintAirfieldGround(graphics, layout, options);
  if (options.includePavements ?? true) paintAirfieldPavements(graphics, layout, options);
  if (options.includeWear ?? true) paintAirfieldSurfaceWear(graphics, layout, options);
  return graphics;
}

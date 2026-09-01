import Phaser from 'phaser';
import type { Vector2 } from '../../core/types';
import type { MapRunway, SaltmarshLayout } from '../maps/saltmarsh';
import {
  SALTMARSH_PALETTE,
  colorToCss,
  type WorldDetailLevel
} from '../palette';
import { DISPLAY_FONT_STACK } from '../typography';
import {
  paintAirfieldGround,
  paintAirfieldPavements,
  paintAirfieldSurfaceWear
} from './AirfieldRenderer';
import {
  paintCoastalDetails,
  type StaticWorldLabelSpec
} from './CoastalDetailsRenderer';
import { paintSaltmarshTerrain } from './SaltmarshTerrainRenderer';

export interface SaltmarshRenderOptions {
  readonly detailLevel: WorldDetailLevel;
}

function path(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly Vector2[],
  close = true
): void {
  if (points.length < 2) return;
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    graphics.lineTo(points[index].x, points[index].y);
  }
  if (close) graphics.closePath();
}

function localPoint(runway: MapRunway, along: number, across = 0): Vector2 {
  const forwardX = Math.cos(runway.angle);
  const forwardY = Math.sin(runway.angle);
  const rightX = -forwardY;
  const rightY = forwardX;
  return {
    x: runway.center.x + forwardX * along + rightX * across,
    y: runway.center.y + forwardY * along + rightY * across
  };
}

function runwayCorners(runway: MapRunway, lengthPad = 0, widthPad = 0): Vector2[] {
  const halfLength = runway.length / 2 + lengthPad;
  const halfWidth = runway.width / 2 + widthPad;
  return [
    localPoint(runway, -halfLength, -halfWidth),
    localPoint(runway, halfLength, -halfWidth),
    localPoint(runway, halfLength, halfWidth),
    localPoint(runway, -halfLength, halfWidth)
  ];
}

function paintRunwaySurfaces(
  graphics: Phaser.GameObjects.Graphics,
  layout: SaltmarshLayout
): void {
  for (const runway of layout.runways) {
    graphics.fillStyle(SALTMARSH_PALETTE.revetment, 0.94);
    path(graphics, runwayCorners(runway, runway.width * 0.24, runway.width * 0.34));
    graphics.fillPath();
    graphics.fillStyle(SALTMARSH_PALETTE.asphalt, 1);
    path(graphics, runwayCorners(runway));
    graphics.fillPath();
    graphics.lineStyle(
      Math.max(1.25, runway.width * 0.035),
      SALTMARSH_PALETTE.runwayEdge,
      0.46
    );
    path(graphics, runwayCorners(runway));
    graphics.strokePath();
  }
}

function paintOperationalRunways(
  graphics: Phaser.GameObjects.Graphics,
  layout: SaltmarshLayout
): StaticWorldLabelSpec[] {
  const labels: StaticWorldLabelSpec[] = [];

  for (const runway of layout.runways) {
    const zone = layout.landingZones.find((candidate) => candidate.id === runway.zoneId);
    const halfLength = runway.length / 2;
    const halfWidth = runway.width / 2;

    const edgeStart = -halfLength + runway.width * 0.42;
    const edgeEnd = halfLength - runway.width * 0.42;
    graphics.lineStyle(
      Math.max(1.2, runway.width * 0.035),
      SALTMARSH_PALETTE.marking,
      0.72
    );
    for (const side of [-1, 1]) {
      const from = localPoint(runway, edgeStart, side * halfWidth * 0.84);
      const to = localPoint(runway, edgeEnd, side * halfWidth * 0.84);
      graphics.lineBetween(from.x, from.y, to.x, to.y);
    }

    const thresholdInset = runway.width * 0.55;
    const thresholdBarLength = runway.width * 0.52;
    const thresholdCount = runway.width >= 44 ? 5 : 4;
    graphics.lineStyle(
      Math.max(1.5, runway.width * 0.06),
      SALTMARSH_PALETTE.marking,
      0.92
    );
    for (const endSign of [-1, 1]) {
      const thresholdAlong = endSign * (halfLength - thresholdInset);
      for (let index = 0; index < thresholdCount; index += 1) {
        const across = Phaser.Math.Linear(
          -halfWidth * 0.67,
          halfWidth * 0.67,
          index / (thresholdCount - 1)
        );
        const from = localPoint(runway, thresholdAlong, across);
        const to = localPoint(
          runway,
          thresholdAlong - endSign * thresholdBarLength,
          across
        );
        graphics.lineBetween(from.x, from.y, to.x, to.y);
      }
    }

    const dashLength = Math.max(10, runway.length * 0.038);
    const dashGap = dashLength * 1.75;
    const centerlineLimit = halfLength - runway.width * 2.3;
    graphics.lineStyle(
      Math.max(1.8, runway.width * 0.055),
      SALTMARSH_PALETTE.marking,
      0.82
    );
    for (let along = -centerlineLimit; along < centerlineLimit; along += dashGap) {
      const from = localPoint(runway, along);
      const to = localPoint(runway, Math.min(along + dashLength, centerlineLimit));
      graphics.lineBetween(from.x, from.y, to.x, to.y);
    }

    graphics.lineStyle(
      Math.max(2.5, runway.width * 0.1),
      SALTMARSH_PALETTE.marking,
      0.78
    );
    for (const endSign of [-1, 1]) {
      const aimingAlong = endSign * runway.length * 0.22;
      for (const side of [-1, 1]) {
        const from = localPoint(
          runway,
          aimingAlong - runway.width * 0.24,
          side * runway.width * 0.24
        );
        const to = localPoint(
          runway,
          aimingAlong + runway.width * 0.24,
          side * runway.width * 0.24
        );
        graphics.lineBetween(from.x, from.y, to.x, to.y);
      }
    }

    const lightSegments = Math.max(
      7,
      Math.floor(runway.length / Math.max(38, runway.width * 1.15))
    );
    graphics.fillStyle(SALTMARSH_PALETTE.runwayLight, 0.72);
    for (let index = 1; index < lightSegments; index += 1) {
      const along = Phaser.Math.Linear(-halfLength, halfLength, index / lightSegments);
      for (const side of [-1, 1]) {
        const light = localPoint(runway, along, side * (halfWidth + runway.width * 0.14));
        graphics.fillCircle(light.x, light.y, Math.max(1.25, runway.width * 0.03));
      }
    }

    if (zone) {
      const rightX = -Math.sin(runway.angle);
      const rightY = Math.cos(runway.angle);
      const beaconOffset = runway.width * 0.66;
      graphics.fillStyle(zone.color, 0.98);
      for (const side of [-1, 1]) {
        graphics.fillCircle(
          zone.position.x + rightX * beaconOffset * side,
          zone.position.y + rightY * beaconOffset * side,
          Math.max(2.5, runway.width * 0.065)
        );
      }
    }

    const labelInset = runway.width * 1.45;
    const fontSize = Math.max(14, runway.width * 0.32);
    const negative = localPoint(runway, -halfLength + labelInset);
    const positive = localPoint(runway, halfLength - labelInset);
    labels.push(
      {
        x: negative.x,
        y: negative.y,
        text: runway.designators[0],
        angle: runway.angle,
        fontSize,
        color: zone?.color ?? SALTMARSH_PALETTE.marking,
        alpha: 1
      },
      {
        x: positive.x,
        y: positive.y,
        text: runway.designators[1],
        angle: runway.angle + Math.PI,
        fontSize,
        color: SALTMARSH_PALETTE.marking,
        alpha: 0.86
      }
    );
  }

  return labels;
}

function paintOperationalGroundMarkings(
  graphics: Phaser.GameObjects.Graphics,
  layout: SaltmarshLayout
): StaticWorldLabelSpec[] {
  const labels: StaticWorldLabelSpec[] = [];
  for (const marker of layout.holdShortMarkers) {
    const directionX = Math.cos(marker.angle);
    const directionY = Math.sin(marker.angle);
    const normalX = -directionY;
    const normalY = directionX;
    graphics.lineStyle(1.8, SALTMARSH_PALETTE.taxiwayMarking, 0.9);
    for (const offset of [-2.5, 2.5]) {
      const centerX = marker.position.x + normalX * offset;
      const centerY = marker.position.y + normalY * offset;
      graphics.lineBetween(
        centerX - directionX * marker.width * 0.5,
        centerY - directionY * marker.width * 0.5,
        centerX + directionX * marker.width * 0.5,
        centerY + directionY * marker.width * 0.5
      );
    }
  }

  for (const stand of layout.parkingStands) {
    const forwardX = Math.cos(stand.angle);
    const forwardY = Math.sin(stand.angle);
    const rightX = -forwardY;
    const rightY = forwardX;
    const nose = {
      x: stand.position.x + forwardX * stand.length * 0.42,
      y: stand.position.y + forwardY * stand.length * 0.42
    };
    graphics.lineStyle(1.5, SALTMARSH_PALETTE.taxiwayMarking, 0.58);
    graphics.lineBetween(
      stand.position.x - forwardX * stand.length * 0.46,
      stand.position.y - forwardY * stand.length * 0.46,
      nose.x,
      nose.y
    );
    graphics.lineBetween(
      nose.x - rightX * stand.length * 0.16,
      nose.y - rightY * stand.length * 0.16,
      nose.x + rightX * stand.length * 0.16,
      nose.y + rightY * stand.length * 0.16
    );
    labels.push({
      x: stand.position.x - forwardX * stand.length * 0.28,
      y: stand.position.y - forwardY * stand.length * 0.28,
      text: stand.label,
      angle: stand.angle,
      fontSize: Math.max(9, stand.length * 0.24),
      color: SALTMARSH_PALETTE.taxiwayMarking,
      alpha: 0.68
    });
  }

  const zone = layout.landingZones.find((candidate) => candidate.id === layout.helipad.zoneId);
  const surfaceRadius = Math.min(
    layout.helipad.radius,
    (zone?.captureRadius ?? layout.helipad.radius) * 0.86
  );
  graphics.fillStyle(SALTMARSH_PALETTE.revetment, 0.94);
  graphics.fillCircle(layout.helipad.center.x, layout.helipad.center.y, surfaceRadius * 1.15);
  graphics.fillStyle(SALTMARSH_PALETTE.asphalt, 1);
  graphics.fillCircle(layout.helipad.center.x, layout.helipad.center.y, surfaceRadius);
  graphics.lineStyle(2.2, SALTMARSH_PALETTE.marking, 0.72);
  graphics.strokeCircle(layout.helipad.center.x, layout.helipad.center.y, surfaceRadius * 0.77);
  graphics.fillStyle(SALTMARSH_PALETTE.runwayLight, 0.68);
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI * 0.25;
    graphics.fillCircle(
      layout.helipad.center.x + Math.cos(angle) * surfaceRadius * 0.9,
      layout.helipad.center.y + Math.sin(angle) * surfaceRadius * 0.9,
      1.5
    );
  }
  labels.push({
    x: layout.helipad.center.x,
    y: layout.helipad.center.y,
    text: 'H',
    angle: 0,
    fontSize: Math.max(22, surfaceRadius * 0.82),
    color: zone?.color ?? SALTMARSH_PALETTE.marking,
    alpha: 1
  });
  return labels;
}

function temporaryGraphics(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.make.graphics({ x: 0, y: 0 }, false);
}

function temporaryLabel(
  scene: Phaser.Scene,
  label: StaticWorldLabelSpec
): Phaser.GameObjects.Text {
  return scene.make.text({
    x: label.x,
    y: label.y,
    text: label.text,
    style: {
      color: colorToCss(label.color),
      fontFamily: DISPLAY_FONT_STACK,
      fontSize: `${label.fontSize}px`,
      fontStyle: 'bold'
    },
    add: false
  }, false).setOrigin(0.5).setRotation(label.angle).setAlpha(label.alpha);
}

/** Composes the complete static world once into one native-size texture. */
export function renderSaltmarshMap(
  scene: Phaser.Scene,
  layout: SaltmarshLayout,
  { detailLevel }: SaltmarshRenderOptions
): void {
  const options = { detailLevel };
  const layers: Phaser.GameObjects.Graphics[] = [];
  const labels: StaticWorldLabelSpec[] = [];
  const texts: Phaser.GameObjects.Text[] = [];

  const terrain = temporaryGraphics(scene);
  paintSaltmarshTerrain(terrain, layout, options);
  layers.push(terrain);

  const ground = temporaryGraphics(scene);
  paintAirfieldGround(ground, layout, options);
  layers.push(ground);

  const pavements = temporaryGraphics(scene);
  paintAirfieldPavements(pavements, layout, options);
  paintRunwaySurfaces(pavements, layout);
  layers.push(pavements);

  const wear = temporaryGraphics(scene);
  paintAirfieldSurfaceWear(wear, layout, options);
  layers.push(wear);

  const markings = temporaryGraphics(scene);
  labels.push(...paintOperationalRunways(markings, layout));
  labels.push(...paintOperationalGroundMarkings(markings, layout));
  layers.push(markings);

  const facilities = temporaryGraphics(scene);
  labels.push(...paintCoastalDetails(facilities, layout, options));
  layers.push(facilities);

  const staticWorld = scene.add.renderTexture(0, 0, layout.width, layout.height)
    .setOrigin(0, 0)
    .setDepth(-20);
  try {
    for (const layer of layers) staticWorld.draw(layer);
    for (const label of labels) {
      const text = temporaryLabel(scene, label);
      texts.push(text);
      staticWorld.draw(text);
    }
    staticWorld.render();
  } finally {
    for (const text of texts) text.destroy();
    for (const layer of layers) layer.destroy();
  }
}

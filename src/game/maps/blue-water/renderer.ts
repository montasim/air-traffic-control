import type Phaser from 'phaser';
import type { WorldDetailLevel } from '../../palette';
import {
  addMovingWaves,
  addShipWash,
  clearOfAirfield,
  composeStaticMap,
  paintAirfieldGround,
  paintAirfieldGuides,
  paintCarrierDeck,
  paintCarrierIsland,
  paintCarrierWake,
  paintEscortShip,
  deterministicUnit,
  paintGroundTexture,
  paintHelipad,
  paintMarkedRunway,
  paintSurfaceTexture,
  paintSwellBands,
  paintWhitecaps,
  type CivilMapPalette,
} from '../../rendering/shared-map';
import type { BlueWaterLayout } from './layout';

/** Deep, slightly green ocean; the deck is the only hard surface. */
export const BLUE_WATER_PALETTE: CivilMapPalette = {
  terrain: 0x3d7486,
  terrainLight: 0x4d8597,
  terrainDark: 0x2f6070,
  fieldLine: 0x5b92a2,
  water: 0x3d7486,
  waterEdge: 0x7fb3c0,
  waterShallow: 0x5a96a6,
  airportGround: 0x56636a,
  asphalt: 0x505e60,
  asphaltEdge: 0xb0baa6,
  apron: 0x6b777c,
  marking: 0xf4efda,
  taxiwayMarking: 0xd4c29b,
  building: 0x8c9599,
  buildingRoof: 0xb3bbbd,
  shadow: 0x0d2730,
  vegetation: 0x3d7486,
  vegetationLight: 0x4d8597,
};

/** Broad, soft patches of deeper and shallower-looking water, so the open sea never reads as one flat colour. */
function paintDepthPatches(graphics: Phaser.GameObjects.Graphics, layout: BlueWaterLayout, unit: number): void {
  for (let i = 0; i < 12; i += 1) {
    const x = deterministicUnit(i, 901) * layout.width;
    const y = deterministicUnit(i, 907) * layout.height;
    const [w, h] = [unit * (0.45 + deterministicUnit(i, 911) * 0.4), unit * (0.2 + deterministicUnit(i, 919) * 0.2)];
    // Stacked faint rings, widest first, so each patch fades out with no hard edge.
    graphics.fillStyle(i % 3 === 0 ? BLUE_WATER_PALETTE.terrainLight : BLUE_WATER_PALETTE.terrainDark, 0.06);
    for (let ring = 1; ring >= 0.3; ring -= 0.14) graphics.fillEllipse(x, y, w * ring, h * ring);
  }
}

/**
 * The escort group sailing in company with the carrier, placed by shares of the carrier's length
 * ahead (x) and to starboard (y): two destroyers screening ahead and to port, and a supply ship
 * keeping station off the starboard quarter.
 */
const ESCORTS = [
  { x: 0.74, y: -0.4, length: 0.2, kind: 'destroyer' },
  { x: 0.05, y: 0.42, length: 0.19, kind: 'destroyer' },
  { x: -0.3, y: -0.42, length: 0.24, kind: 'supply' },
] as const;

/** Where each escort sails this time: only those fully on screen and clear of the approaches. */
function escortPlacements(layout: BlueWaterLayout) {
  const { carrier } = layout;
  const [cos, sin] = [Math.cos(carrier.angle), Math.sin(carrier.angle)];
  return ESCORTS.flatMap((escort) => {
    const [dx, dy] = [escort.x * carrier.length, escort.y * carrier.length];
    const center = { x: carrier.center.x + dx * cos - dy * sin, y: carrier.center.y + dx * sin + dy * cos };
    const length = carrier.length * escort.length;
    const reach = length * 0.55;
    if (center.x < reach || center.y < reach || center.x > layout.width - reach || center.y > layout.height - reach) return [];
    if (!clearOfAirfield(layout, center, reach)) return [];
    return [{ center, length, kind: escort.kind }];
  });
}

/** A broad, soft band of sun glint across the sea, brightest along its middle. */
function paintSunGlint(graphics: Phaser.GameObjects.Graphics, layout: BlueWaterLayout, unit: number): void {
  graphics.fillStyle(0xe8f6f8, 0.03);
  for (let ring = 1; ring >= 0.25; ring -= 0.15) graphics.fillEllipse(layout.width * 0.72, layout.height * 0.28, unit * 1.3 * ring, unit * 0.55 * ring);
}

export function renderBlueWaterMap(scene: Phaser.Scene, layout: BlueWaterLayout, detailLevel: WorldDetailLevel): void {
  // Open ocean with a fine sparkle of foam-white and deep shade.
  paintGroundTexture(scene, { width: layout.width, height: layout.height, fieldPolygons: [] }, {
    base: BLUE_WATER_PALETTE.water,
    fields: [],
    light: 0x9fd0dc,
    dark: 0x1d4d5d,
  });
  const escorts = escortPlacements(layout);
  composeStaticMap(scene, layout, detailLevel, {
    scenery: ({ graphics, unit }) => {
      paintDepthPatches(graphics, layout, unit);
      paintSwellBands(graphics, layout, layout.carrier.angle + 0.5, BLUE_WATER_PALETTE.terrainDark, unit);
      paintWhitecaps(graphics, layout, detailLevel === 'mobile' ? 50 : 130, unit, (point) => clearOfAirfield(layout, point, unit * 0.04));
      paintSunGlint(graphics, layout, unit);
      paintCarrierWake(graphics, layout.carrier);
      for (const escort of escorts) paintEscortShip(graphics, escort.center, layout.carrier.angle, escort.length, unit, escort.kind);
    },
    operational: ({ graphics, unit }) => {
      paintCarrierDeck(graphics, layout.carrier, unit);
      paintAirfieldGround(graphics, layout, BLUE_WATER_PALETTE, detailLevel);
      // The deck lanes take the same marked runway as every other map.
      // Both lanes take the same class, so only the first carries the sign; the second's would overlap it.
      layout.runways.forEach((runway, index) => paintMarkedRunway(graphics, runway, BLUE_WATER_PALETTE, layout.landingZones, index === 0));
      paintAirfieldGuides(graphics, layout, BLUE_WATER_PALETTE, detailLevel);
      for (const pad of layout.helipads) paintHelipad(graphics, pad, BLUE_WATER_PALETTE);
    },
    detail: ({ graphics, unit }) => paintCarrierIsland(graphics, layout.carrier, unit),
  });
  // Wave crests drifting across the swell bands, so the open sea moves.
  addMovingWaves(scene, layout, layout.carrier.angle + 0.5 + Math.PI / 2);
  // Moving spray at every bow and churned water behind every stern, so the group is under way.
  const { carrier } = layout;
  addShipWash(scene, [
    { center: carrier.center, angle: carrier.angle, length: carrier.length, halfBeam: carrier.beam * 0.5 },
    ...escorts.map((escort) => ({ center: escort.center, angle: carrier.angle, length: escort.length, halfBeam: escort.length * (escort.kind === 'supply' ? 0.08 : 0.06) })),
  ]);
  // Runways only: the asphalt grain and rubber, with no apron or taxiway texture on this map.
  paintSurfaceTexture(scene, { ...layout, taxiways: [], apron: [], extraAprons: [], helipadApron: undefined });
}

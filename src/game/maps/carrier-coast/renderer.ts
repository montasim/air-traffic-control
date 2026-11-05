import type Phaser from 'phaser';
import type { Vector2 } from '../../../core/types';
import type { WorldDetailLevel } from '../../palette';
import {
  clearOfAirfield,
  composeStaticMap,
  paintAirfieldGround,
  paintAirfieldGuides,
  paintCanopy,
  paintCarrierDeck,
  paintCarrierIsland,
  paintCarrierWake,
  paintControlTower,
  paintGroundTexture,
  paintHelipad,
  paintMarkedRunway,
  paintRaisedBuilding,
  paintShadedTree,
  paintSurfaceTexture,
  paintWhitecaps,
  strokePolyline,
  type CivilMapPalette,
} from '../../rendering/shared-map';
import { pointInPolygon } from '../shared/apronLayout';
import type { CarrierCoastLayout } from './layout';

/** Warm sand above a clear coastal sea, joined by a band of shore green. */
export const CARRIER_COAST_PALETTE: CivilMapPalette = {
  terrain: 0xd8c597,
  terrainLight: 0xe6d6ad,
  terrainDark: 0xc2ad7e,
  fieldLine: 0xc9b585,
  water: 0x4f9ab9,
  waterEdge: 0x9fd2df,
  waterShallow: 0x79bcd3,
  airportGround: 0xcdbd93,
  asphalt: 0x505e60,
  asphaltEdge: 0xb0baa6,
  apron: 0x969487,
  marking: 0xf4efda,
  taxiwayMarking: 0xd4c29b,
  building: 0xb8b9a3,
  buildingRoof: 0xeee4c9,
  shadow: 0x4c5a4a,
  vegetation: 0x8e9d55,
  vegetationLight: 0xa8b56a,
};
const BEACH = 0xeadcb2;
const DUNE_GRASS = 0xc7c48e;

/** The coastline moved `distance` along its normal, positive toward the sea (away from the land's far side). */
function offsetCoast(layout: CarrierCoastLayout, distance: number): Vector2[] {
  const { coastline } = layout;
  const far = layout.land[coastline.length];
  return coastline.map((point, i) => {
    const [a, b] = [coastline[Math.max(0, i - 1)], coastline[Math.min(coastline.length - 1, i + 1)]];
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    if (normal.x * (far.x - point.x) + normal.y * (far.y - point.y) > 0) normal = { x: -normal.x, y: -normal.y };
    return { x: point.x + normal.x * distance, y: point.y + normal.y * distance };
  });
}

const scaledAbout = (outline: readonly Vector2[], factor: number) => {
  const c = outline.reduce((sum, p) => ({ x: sum.x + p.x / outline.length, y: sum.y + p.y / outline.length }), { x: 0, y: 0 });
  return outline.map((p) => ({ x: c.x + (p.x - c.x) * factor, y: c.y + (p.y - c.y) * factor }));
};

/**
 * The sea, beach and land as painted-ground polygons, in order: a pale shelf off the shore, the
 * beach, dune grass behind it and the sand inland; then shallows, beach and grass on every islet.
 */
function coastGround(layout: CarrierCoastLayout, unit: number): { polygons: Vector2[][]; colors: number[] } {
  const tail = layout.land.slice(layout.coastline.length);
  const band = (distance: number) => [...offsetCoast(layout, distance), ...tail];
  const palette = CARRIER_COAST_PALETTE;
  const polygons = [band(unit * 0.07), band(0), band(-unit * 0.03), band(-unit * 0.07)];
  const colors = [palette.waterShallow, BEACH, DUNE_GRASS, palette.terrain];
  for (const islet of layout.islets) {
    polygons.push(scaledAbout(islet, 1.25), [...islet], scaledAbout(islet, 0.6));
    colors.push(palette.waterShallow, BEACH, DUNE_GRASS);
  }
  return { polygons, colors };
}

export function renderCarrierCoastMap(scene: Phaser.Scene, layout: CarrierCoastLayout, detailLevel: WorldDetailLevel): void {
  const unit = Math.min(layout.width, layout.height);
  const ground = coastGround(layout, unit);
  paintGroundTexture(scene, { width: layout.width, height: layout.height, fieldPolygons: ground.polygons }, {
    base: CARRIER_COAST_PALETTE.water,
    // One colour per polygon, in coastGround's order.
    fields: ground.colors,
    light: 0xf6f1df,
    dark: 0x4f7470,
  });
  const ashore = (point: Vector2) => pointInPolygon(point, ground.polygons[0]) || layout.islets.some((islet) => pointInPolygon(point, scaledAbout(islet, 1.3)));
  composeStaticMap(scene, layout, detailLevel, {
    scenery: ({ graphics, unit }) => {
      // The sea, beach and sand are painted underneath by paintGroundTexture; this layer adds surf, whitecaps and trees.
      graphics.lineStyle(unit * 0.008, 0xffffff, 0.55);
      strokePolyline(graphics, offsetCoast(layout, unit * 0.012));
      graphics.lineStyle(unit * 0.004, 0xffffff, 0.35);
      strokePolyline(graphics, offsetCoast(layout, unit * 0.04));
      paintWhitecaps(graphics, layout, detailLevel === 'mobile' ? 40 : 90, unit, (point) => !ashore(point) && clearOfAirfield(layout, point, unit * 0.04));
      paintCarrierWake(graphics, layout.carrier);
      const budget = detailLevel === 'mobile' ? 30 : 60;
      layout.scrub.slice(0, budget).forEach((bush, index) => {
        if (clearOfAirfield(layout, bush.center, bush.radius)) paintShadedTree(graphics, bush.center, bush.radius, CARRIER_COAST_PALETTE, index);
      });
      // A few palms crowding the middle of each islet.
      paintCanopy(graphics, layout.islets.flatMap((islet) => scaledAbout(islet, 0.35).filter((_, i) => i % 2 === 0)
        .map((p) => ({ x: p.x, y: p.y, r: unit * 0.009 }))), CARRIER_COAST_PALETTE);
    },
    operational: ({ graphics, unit }) => {
      paintCarrierDeck(graphics, layout.carrier, unit);
      paintAirfieldGround(graphics, layout, CARRIER_COAST_PALETTE, detailLevel);
      // The land runway and the deck lane both take the same marked runway as every other map.
      for (const runway of layout.runways) paintMarkedRunway(graphics, runway, CARRIER_COAST_PALETTE, layout.landingZones);
      paintAirfieldGuides(graphics, layout, CARRIER_COAST_PALETTE, detailLevel);
      for (const pad of layout.helipads) paintHelipad(graphics, pad, CARRIER_COAST_PALETTE);
    },
    detail: ({ graphics, unit }) => {
      for (const building of layout.buildings) paintRaisedBuilding(graphics, building, CARRIER_COAST_PALETTE, unit, layout.runways.slice(0, 1));
      paintControlTower(graphics, layout, CARRIER_COAST_PALETTE);
      paintCarrierIsland(graphics, layout.carrier, unit);
    },
  });
  // Runways only: the asphalt grain and rubber, with no apron or taxiway texture on this map.
  paintSurfaceTexture(scene, { ...layout, taxiways: [], apron: [], extraAprons: [], helipadApron: undefined }, { raisedBuildings: true });
}

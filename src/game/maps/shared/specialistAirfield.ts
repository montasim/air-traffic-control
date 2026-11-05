import { PHASER_TEXT_STYLES } from '../../typography';
import type Phaser from 'phaser';
import type { LandingZone, Vector2 } from '../../../core/types';
import { AIRCRAFT_COLORS, type WorldDetailLevel } from '../../palette';
import { composeStaticMap, paintAirfieldGround, paintAirfieldGuides, paintMarkedRunway, paintSurfaceTexture, paintHelipad, clearOfAirfield, paintCanopy, paintWhitecaps, deterministicUnit, fieldPatchwork, MAP_DETAIL_BUDGETS, nearRiver, addMovingWaves, paintControlTower, paintShoreRocks, raggedOutline, strokePolyline, paintForests, paintGroundTexture, paintHedgerows, paintRaisedBuilding, paintShadedTree, paintShoredPool, type MapBuilding } from '../../rendering/shared-map';
import { RIVER_BEND_PALETTE } from '../river-bend/render';
import type { PlayableMapLayout, MapLayoutVariant } from '../types';
import type { MapRunway, MapHelipad, MapTaxiway } from './airfield';
import { createAirfieldGuidanceSurfaces } from './guidance';
import { pointInPolygon } from './apronLayout';

export type SpecialistKind = 'military' | 'business' | 'passenger' | 'cargo' | 'rescue';
/** Authored coordinates are fractions of viewport; runway lengths use the shorter side. */
export interface AirportPlan {
  runways: readonly [number, number, number, number][];
  pads: readonly [number, number][];
  terminal: readonly [number, number];
}
/** A small apron fixture (shelter, container, gate, kiosk) drawn in a row by the terminal. */
export interface SpecialistFixture {
  readonly id: string;
  readonly center: Vector2;
  readonly width: number;
  readonly height: number;
  readonly angle: number;
  readonly index: number;
}
export interface SpecialistLayout extends PlayableMapLayout {
  kind: SpecialistKind;
  runways: MapRunway[];
  helipads: MapHelipad[];
  taxiways: MapTaxiway[];
  apron: Vector2[];
  buildings: MapBuilding[];
  /** Laid out with the buildings so stands, taxiways, and cleanup all see them. */
  fixtures: SpecialistFixture[];
  /** Buildings sit at the apron ends, stands in the middle; rescue pads keep their own layout. */
  buildingsAtApronEnds: boolean;
}
export function createSpecialistLayout(width: number, height: number, kind: SpecialistKind, plans: Record<'portrait' | 'landscape', AirportPlan>): SpecialistLayout {
  const portrait = width / height < 1.4;
  const variant: MapLayoutVariant = width / height > 1.18 ? 'landscape' : width / height < .85 ? 'portrait' : 'square';
  const plan = plans[portrait ? 'portrait' : 'landscape'];
  const u = Math.min(width, height);
  const point = (x: number, y: number) => ({ x: x * width, y: y * height });
  const runways: MapRunway[] = plan.runways.map(([x,y,length,angle], i) => ({
    id: `${kind}-runway-${i}`, zoneId: `${kind}-zone-${i}`, accepts: i === 0 ? 'liner' : 'commuter',
    center: point(x,y), length: length * u, width: (i === 0 ? .045 : .038) * u, angle,
    designators: ['09', '27']
  }));
  const terminal = point(...plan.terminal);
  // With buildings at the ends the apron runs a little longer, leaving its middle for the stands.
  const reach = kind === 'rescue' ? 0 : .05;
  const apron = [[-.2-reach,-.09],[.2+reach,-.09],[.22+reach,.1],[-.18-reach,.11]].map(([x,y]) => ({ x: terminal.x + x*u, y: terminal.y + y*u }));
  const helipads = plan.pads.map(([x,y], i) => ({ center: point(x,y), radius: u * .037, zoneId: `${kind}-pad-${i}` }));
  const buildings: MapBuilding[] = [{ id: 'terminal', center: terminal, width: u * (kind === 'passenger' ? .22 : .13), height: u * .045, angle: 0, kind: 'terminal' }];
  if (kind === 'cargo') for (const side of [-1, 1]) buildings.push({ id: `warehouse-${side}`, center: { x: terminal.x + side*u*.11, y: terminal.y-u*.015 }, width:u*.065,height:u*.055,angle:0,kind:'hangar' });
  const count = kind === 'military' ? 4 : kind === 'cargo' ? 5 : kind === 'passenger' ? 3 : 2;
  const fixtures: SpecialistFixture[] = Array.from({ length: count }, (_, i) => {
    const x = terminal.x + (i - (count - 1) / 2) * u * .055;
    // Passenger gates are piers off the terminal's airside face; the others stand in a row in front of it.
    if (kind === 'passenger') return { id: `fixture-${i}`, center: { x, y: terminal.y - u * .0375 }, width: u * .016, height: u * .045, angle: 0, index: i };
    const [fw, fh] = kind === 'military' ? [.042, .03] : kind === 'cargo' ? [.041, .024] : [.036, .03];
    return { id: `fixture-${i}`, center: { x, y: terminal.y + u * .055 }, width: u * fw, height: u * fh, angle: 0, index: i };
  });
  const taxiways: MapTaxiway[] = runways.map((r,i) => ({ id: `taxi-${i}`, connects: [r.id,'apron'], width: u * .018, path: [{...r.center}, { x: terminal.x + (i ? .09 : -.09)*u, y: terminal.y }, terminal] }));
  const landingZones: LandingZone[] = runways.map(r => ({ id: r.zoneId, label: r.accepts === 'liner' ? 'L' : 'C', accepts: r.accepts, position: { x: r.center.x - Math.cos(r.angle)*r.length*.34, y: r.center.y - Math.sin(r.angle)*r.length*.34 }, angle: r.angle, captureRadius: u * .026, color: AIRCRAFT_COLORS[r.accepts] }));
  landingZones.push(...helipads.map((p,i) => ({ id:p.zoneId, label: helipads.length > 1 ? `H${i+1}` : 'H', accepts:'rotor' as const, position:p.center, angle:0, captureRadius:p.radius*.7, color:AIRCRAFT_COLORS.rotor })));
  const guidanceSurfaces = createAirfieldGuidanceSurfaces({runways});
  for (const p of helipads) guidanceSurfaces.push({kind:'pad',zoneId:p.zoneId,center:p.center,angle:0,radius:p.radius});
  // Rescue pads keep their own islets; every other field settles its pad onto the apron once stands are placed.
  return {width,height,variant,kind,runways,helipads,helipadsOnApron:kind !== 'rescue',taxiways,apron,buildings,fixtures,buildingsAtApronEnds:kind !== 'rescue',landingZones,guidanceSurfaces,hudExclusionZones:[{id:'score',x:0,y:0,width:width*.3,height:height*.12},{id:'pause',x:width*.86,y:height*.85,width:width*.14,height:height*.15},{id:'speed',x:0,y:height*.85,width:width*.14,height:height*.15}]};
}

/**
 * Each land field's own countryside: ground and field shades, speckle, tree colours, how much
 * of the edge is forest, and whether a pond sits in the quiet corner.
 */
const COUNTRYSIDE: Record<Exclude<SpecialistKind, 'rescue'>, {
  base: number; fields: number[]; light: number; dark: number; vegetation: number; vegetationLight: number; forest: number; pond: boolean;
}> = {
  // Olive drab around a military base, with dense woods on its fringe.
  military: { base: 0x788760, fields: [0x7c8b63, 0x75845d, 0x818f67, 0x72815b], light: 0xc4cc9e, dark: 0x485536, vegetation: 0x46593a, vegetationLight: 0x7b8f5c, forest: 0.5, pond: false },
  // Kept parkland around the business field: brighter grass, scattered trees and a pond.
  business: { base: 0x92a779, fields: [0x96ab7d, 0x8ea375, 0x9bb082, 0x8ca173], light: 0xdbe6bc, dark: 0x5c7148, vegetation: 0x4f6d45, vegetationLight: 0x8fad70, forest: 0.3, pond: true },
  // Grey-green farmland round the big passenger airport.
  passenger: { base: 0x83947a, fields: [0x86977d, 0x7f9076, 0x8b9b81, 0x7d8e74], light: 0xd2dcc0, dark: 0x515f49, vegetation: 0x4e6646, vegetationLight: 0x86a06e, forest: 0.25, pond: true },
  // Dusty, worn ground round the freight yards, with only a few trees.
  cargo: { base: 0xa29a83, fields: [0xa69e87, 0x9e967f, 0xaba38c, 0x9a927c], light: 0xe0d8bf, dark: 0x6b6452, vegetation: 0x5e6a4a, vegetationLight: 0x8f9a70, forest: 0.12, pond: false },
};

export function renderSpecialistAirfield(scene: Phaser.Scene, layout: SpecialistLayout, detailLevel: WorldDetailLevel): void {
  if (layout.kind === 'rescue') return renderRescueAirfield(scene, layout, detailLevel);
  const { width: w, height: h, kind } = layout;
  const u = Math.min(w, h);
  const land = COUNTRYSIDE[kind];
  const palette = { ...RIVER_BEND_PALETTE, terrain: land.base, vegetation: land.vegetation, vegetationLight: land.vegetationLight, apron: kind === 'cargo' ? 0x969487 : 0x89938a };
  const budget = MAP_DETAIL_BUDGETS[detailLevel];
  const terminal = layout.buildings[0].center;
  const road = [{ x: 0, y: h * .86 }, { x: w * .44, y: h * .86 }, terminal];
  const fields = fieldPatchwork(w, h, u * .22);
  // A pond in the quiet lower-left, if the airfield leaves it clear.
  const pondCenter = { x: w * .2, y: h * .7 };
  const pond = land.pond && clearOfAirfield(layout, pondCenter, u * .12) && !nearRiver(road, u * .018, pondCenter, u * .1)
    ? Array.from({ length: 10 }, (_, i) => {
      const turn = (i / 10) * Math.PI * 2;
      const reach = u * (.055 + deterministicUnit(i, 701) * .02);
      return { x: pondCenter.x + Math.cos(turn) * reach * 1.4, y: pondCenter.y + Math.sin(turn) * reach };
    })
    : undefined;
  const avoid = (point: Vector2, radius: number) => nearRiver(road, u * .018, point, radius + u * .01)
    || (pond !== undefined && Math.hypot(point.x - pondCenter.x, point.y - pondCenter.y) < radius + u * .11);
  paintGroundTexture(scene, { width: w, height: h, fieldPolygons: fields }, { base: land.base, fields: land.fields, light: land.light, dark: land.dark });
  composeStaticMap(scene, layout, detailLevel, {
    scenery: ({ graphics: g }) => {
      // The ground and fields are painted underneath by paintGroundTexture; this layer holds scenery on top.
      if (pond) paintShoredPool(g, pond, palette);
      paintHedgerows(g, layout, fields, palette, avoid);
      paintForests(g, layout, palette, Math.round(budget.trees * land.forest), avoid);
      g.lineStyle(u * .018, 0xc7c8ac, .5);
      g.lineBetween(road[0].x, road[0].y, road[1].x, road[1].y);
      g.lineBetween(road[1].x, road[1].y, road[2].x, road[2].y);
    },
    operational: ({ graphics: g }) => {
      paintAirfieldGround(g, layout, palette, detailLevel);
      for (const runway of layout.runways) paintMarkedRunway(g, runway, palette, layout.landingZones);
      paintAirfieldGuides(g, layout, palette, detailLevel);
      for (const pad of layout.helipads) paintHelipad(g, pad, palette);
    },
    detail: ({ graphics: g }) => {
      for (const building of layout.buildings) paintRaisedBuilding(g, building, palette, u, layout.runways);
      paintControlTower(g, layout, palette);
      paintFixtures(g, layout);
      if (kind !== 'cargo') for (let i = 0; i < (detailLevel === 'mobile' ? 8 : 16); i++) {
        const at = { x: w * .055 + i * u * .028, y: h * .62 + Math.sin(i * .7) * u * .014 };
        if (clearOfAirfield(layout, at, u * .008) && !avoid(at, u * .008)) paintShadedTree(g, at, u * .008, palette, i);
      }
    }
  });
  paintSurfaceTexture(scene, { ...layout, cutouts: layout.fixtures }, { raisedBuildings: true });
}

/** The small apron fixtures in a row by the terminal: shelters, containers, gates or kiosks. */
function paintFixtures(g: Phaser.GameObjects.Graphics, layout: SpecialistLayout): void {
  const { kind } = layout;
  const u = Math.min(layout.width, layout.height);
  for (const { center: { x, y }, width: fw, height: fh, index: i } of layout.fixtures) {
    if (kind === 'military') { g.fillStyle(0x4d6652); g.fillRoundedRect(x - fw / 2, y - fh / 2, fw, fh, u * .012); g.fillStyle(0xb2b59b); g.fillRect(x - u * .014, y + u * .004, u * .028, u * .006); }
    else if (kind === 'cargo') { g.fillStyle(i % 2 ? 0x647f79 : 0xb89b72); g.fillRect(x - fw / 2, y - fh / 2, fw, fh); g.lineStyle(1, 0xf4efda, .3); g.lineBetween(x, y - fh / 2, x, y + fh / 2); }
    else if (kind === 'passenger') { g.fillStyle(0xd4ccb2); g.fillRect(x - fw / 2, y - fh / 2, fw, fh); }
    else { g.fillStyle(0xc3c2a6); g.fillRoundedRect(x - fw / 2, y - fh / 2, fw, fh, u * .004); }
  }
}

/** The rescue field's main island and one islet per offshore pad, as outlines. */
function rescueIslands(layout: SpecialistLayout): Vector2[][] {
  const u = Math.min(layout.width, layout.height);
  const [r0, r1] = layout.runways;
  const minX = Math.min(...[r0, r1].map(r => r.center.x - r.length / 2)) - .055 * u;
  const maxX = Math.max(...[r0, r1].map(r => r.center.x + r.length / 2)) + .055 * u;
  const top = Math.min(r0.center.y, r1.center.y) - .08 * u;
  const bottom = Math.max(r0.center.y, r1.center.y) + .08 * u;
  const coast = [[minX-u*.035,top+u*.1],[minX+u*.02,top-u*.02],[minX+(maxX-minX)*.36,top-u*.045],[maxX-u*.12,top-u*.018],[maxX+u*.025,top+u*.06],[maxX+u*.04,bottom-u*.12],[maxX-u*.045,bottom+u*.035],[minX+(maxX-minX)*.52,bottom+u*.015],[minX+u*.04,bottom+u*.05],[minX-u*.04,bottom-u*.06]].map(([x, y]) => ({ x, y }));
  const islets = layout.helipads.map(pad => Array.from({ length: 9 }, (_, i) => {
    const a = i * Math.PI * 2 / 9, r = 1 + .08 * Math.sin(i * 3);
    return { x: pad.center.x + Math.cos(a) * u * .095 * r, y: pad.center.y + Math.sin(a) * u * .078 * r };
  }));
  return [coast, ...islets];
}

const scaledAbout = (outline: readonly Vector2[], factor: number) => {
  const c = outline.reduce((sum, p) => ({ x: sum.x + p.x / outline.length, y: sum.y + p.y / outline.length }), { x: 0, y: 0 });
  return outline.map(p => ({ x: c.x + (p.x - c.x) * factor, y: c.y + (p.y - c.y) * factor }));
};

function renderRescueAirfield(scene: Phaser.Scene, layout: SpecialistLayout, detailLevel: WorldDetailLevel): void {
  const { width:w, height:h } = layout;
  const u = Math.min(w,h);
  const sea = 0x5e93a2;
  const palette = { ...RIVER_BEND_PALETTE, terrain: 0x8fa87b, water: sea, waterEdge: 0xd9cfa2, waterShallow: 0x8cbcc4, vegetation: 0x4a7448, vegetationLight: 0x86aa6c };
  // Each island's shore broken into a ragged line, as on Carrier Coast.
  const islands = rescueIslands(layout).map(outline => raggedOutline(outline, u));
  // Each island as three rings of the painted ground: pale shallows, a sandy beach, then grass.
  const rings = islands.flatMap(outline => [raggedOutline(scaledAbout(outline, 1.16), u), outline, raggedOutline(scaledAbout(outline, outline === islands[0] ? .94 : .8), u)]);
  // The open sea at the bottom, moving waves over it, then the islands as their own layer on top,
  // so the waves only ever show on open water.
  const shades = { base: sea, light: 0xc4dde0, dark: 0x3f6d78 };
  paintGroundTexture(scene, { width: w, height: h, fieldPolygons: [] }, { ...shades, fields: [] });
  addMovingWaves(scene, layout, -0.6);
  paintGroundTexture(scene, { width: w, height: h, fieldPolygons: rings, clipTo: islands.map((_, i) => rings[i * 3]) }, {
    ...shades,
    fields: islands.flatMap(() => [palette.waterShallow, 0xd9cfa2, palette.terrain]),
  }, -20.4);
  const onLand = (point: Vector2) => islands.some(outline => pointInPolygon(point, scaledAbout(outline, 1.2)));
  const grass = islands.map((outline, i) => scaledAbout(outline, i ? .7 : .88));
  composeStaticMap(scene,layout,detailLevel,{
    scenery:({graphics:g}) => {
      // The sea and islands are painted underneath by paintGroundTexture; this layer adds surf, rocks, whitecaps and palms.
      paintWhitecaps(g, layout, detailLevel === 'mobile' ? 40 : 90, u, point => !onLand(point));
      islands.forEach((outline, i) => {
        // Surf breaking on the beach, and a fainter line where the swell first lifts offshore.
        g.lineStyle(Math.max(1.5, u * .004), 0xf6fbfb, .8);
        strokePolyline(g, [...outline, outline[0]]);
        g.lineStyle(Math.max(1, u * .0025), 0xf6fbfb, .35);
        strokePolyline(g, [...scaledAbout(outline, 1.08), scaledAbout(outline, 1.08)[0]]);
        paintShoreRocks(g, outline, u, (i ? 10 : 34) * (detailLevel === 'mobile' ? .5 : 1), 751 + i * 7);
      });
      const crowns: { x: number; y: number; r: number }[] = [];
      for (let i = 0; i < MAP_DETAIL_BUDGETS[detailLevel].trees * 6; i++) {
        const island = grass[i % grass.length];
        const xs = island.map(p => p.x), ys = island.map(p => p.y);
        const point = { x: Math.min(...xs) + deterministicUnit(i, 711) * (Math.max(...xs) - Math.min(...xs)), y: Math.min(...ys) + deterministicUnit(i, 719) * (Math.max(...ys) - Math.min(...ys)) };
        const r = u * (.007 + deterministicUnit(i, 727) * .007);
        // A small clump of crowns around each spot, so trees read as groves rather than dots.
        for (let k = 0; k < 5; k++) {
          const crown = { x: point.x + (deterministicUnit(i * 5 + k, 733) - .5) * r * 4, y: point.y + (deterministicUnit(i * 5 + k, 739) - .5) * r * 4 };
          if (pointInPolygon(crown, island) && clearOfAirfield(layout, crown, r + u * .02)) crowns.push({ ...crown, r });
        }
      }
      paintCanopy(g, crowns, palette);
    },
    operational:({graphics:g}) => {
      paintAirfieldGround(g,layout,palette,detailLevel);
      for(const runway of layout.runways) paintMarkedRunway(g,runway,palette,layout.landingZones);
      paintAirfieldGuides(g,layout,palette,detailLevel);
      for(const pad of layout.helipads) paintHelipad(g,pad,palette);
    },
    detail:({graphics:g}) => {
      for(const building of layout.buildings) paintRaisedBuilding(g,building,palette,u,layout.runways);
      paintControlTower(g,layout,palette);
      paintFixtures(g,layout);
      for(const pad of layout.helipads) {g.fillStyle(0xfff5df);g.fillRect(pad.center.x+u*.052,pad.center.y-u*.012,u*.022,u*.024);g.fillStyle(0xb86d55);g.fillRect(pad.center.x+u*.061,pad.center.y-u*.008,u*.004,u*.016);g.fillRect(pad.center.x+u*.055,pad.center.y-u*.002,u*.016,u*.004);}
    }
  });
  paintSurfaceTexture(scene, { ...layout, cutouts: layout.fixtures }, { raisedBuildings: true });
  layout.helipads.forEach((pad,i) => scene.add.text(pad.center.x, pad.center.y+pad.radius+u*.008, `H${i+1}`, { ...PHASER_TEXT_STYLES.airfieldMarking, fontSize: `${Math.max(10,u*.021)}px`, color: '#203d39', backgroundColor: '#fff5df', padding: { x: 3, y: 1 } }).setOrigin(.5,0).setDepth(-19));
}

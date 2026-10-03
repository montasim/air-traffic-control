import { PHASER_TEXT_STYLES } from '../../typography';
import type Phaser from 'phaser';
import type { LandingZone, Vector2 } from '../../../core/types';
import { AIRCRAFT_COLORS, type WorldDetailLevel } from '../../palette';
import { composeStaticMap, paintAirfieldGround, paintRunway, paintHelipad, paintBuilding, paintTree, tracePolygon, clearOfAirfield, type MapBuilding } from '../../rendering/shared-map';
import { RIVER_BEND_PALETTE } from '../river-bend/render';
import type { PlayableMapLayout, MapLayoutVariant } from '../types';
import type { MapRunway, MapHelipad, MapTaxiway } from './airfield';
import { createAirfieldGuidanceSurfaces } from './guidance';

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
  const helipads = plan.pads.map(([x,y], i) => ({ center: point(x,y), radius: u * .037, zoneId: `${kind}-pad-${i}` }));
  const terminal = point(...plan.terminal);
  const apron = [[-.2,-.09],[.2,-.09],[.22,.1],[-.18,.11]].map(([x,y]) => ({ x: terminal.x + x*u, y: terminal.y + y*u }));
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
  return {width,height,variant,kind,runways,helipads,taxiways,apron,buildings,fixtures,landingZones,guidanceSurfaces,hudExclusionZones:[{id:'score',x:0,y:0,width:width*.3,height:height*.12},{id:'pause',x:width*.86,y:height*.85,width:width*.14,height:height*.15}]};
}

export function renderSpecialistAirfield(scene: Phaser.Scene, layout: SpecialistLayout, detailLevel: WorldDetailLevel): void {
  const { width:w, height:h, kind } = layout;
  const u = Math.min(w,h);
  const colors = { military:0x788760, business:0x92a779, passenger:0x83947a, cargo:0xa29a83, rescue:0x719fa4 };
  const palette = {...RIVER_BEND_PALETTE, terrain:colors[kind], apron:kind === 'cargo' ? 0x969487 : 0x89938a};
  const terminal = layout.buildings[0].center;
  composeStaticMap(scene,layout,detailLevel,{
    scenery:({graphics:g}) => {
      g.fillStyle(colors[kind]);g.fillRect(0,0,w,h);
      if(kind === 'rescue') {
        // Main island under the fixed-wing field; offshore pads sit on distinct islets.
        const r0=layout.runways[0], r1=layout.runways[1];
        const minX=Math.min(...[r0,r1].map(r=>r.center.x-r.length/2))-.055*u;
        const maxX=Math.max(...[r0,r1].map(r=>r.center.x+r.length/2))+.055*u;
        const top=Math.min(r0.center.y,r1.center.y)-.08*u;
        const bottom=Math.max(r0.center.y,r1.center.y)+.08*u;
        const coast = [[minX-u*.035,top+u*.1],[minX+u*.02,top-u*.02],[minX+(maxX-minX)*.36,top-u*.045],[maxX-u*.12,top-u*.018],[maxX+u*.025,top+u*.06],[maxX+u*.04,bottom-u*.12],[maxX-u*.045,bottom+u*.035],[minX+(maxX-minX)*.52,bottom+u*.015],[minX+u*.04,bottom+u*.05],[minX-u*.04,bottom-u*.06]].map(([x,y])=>({x,y}));
        g.fillStyle(0xc9c6a0);tracePolygon(g,coast);g.fillPath();
        const cx=(minX+maxX)/2,cy=(top+bottom)/2;
        g.fillStyle(0x8fa87b);tracePolygon(g,coast.map(p=>({x:cx+(p.x-cx)*.96,y:cy+(p.y-cy)*.92})));g.fillPath();
        for(const pad of layout.helipads) {
          const island=Array.from({length:9},(_,i)=>{const a=i*Math.PI*2/9,r=1+.08*Math.sin(i*3);return {x:pad.center.x+Math.cos(a)*u*.095*r,y:pad.center.y+Math.sin(a)*u*.078*r};});
          g.fillStyle(0xc9c6a0);tracePolygon(g,island);g.fillPath();
          g.fillStyle(0x93a77c);tracePolygon(g,island.map(p=>({x:pad.center.x+(p.x-pad.center.x)*.82,y:pad.center.y+(p.y-pad.center.y)*.82})));g.fillPath();
        }
      } else {
        // Large, quiet terrain shapes keep routes legible without repeating field lines.
        g.fillStyle(kind === 'cargo' ? 0x8d8c7b : 0x637e55,.18);
        g.fillRoundedRect(w*.04,h*.15,w*.29,h*.23,u*.03);
        g.fillRoundedRect(w*.07,h*.69,w*.38,h*.22,u*.04);
        g.lineStyle(u*.018,0xc7c8ac,.35);g.lineBetween(0,h*.86,w*.44,h*.86);g.lineBetween(w*.44,h*.86,terminal.x,terminal.y);
      }
    },
    operational:({graphics:g}) => {
      paintAirfieldGround(g,layout,palette,detailLevel);
      for(const runway of layout.runways) paintRunway(g,runway,palette,0);
      for(const pad of layout.helipads) paintHelipad(g,pad,palette);
    },
    detail:({graphics:g}) => {
      for(const building of layout.buildings) paintBuilding(g,building,palette,layout.runways);
      for(const {center:{x,y},width:fw,height:fh,index:i} of layout.fixtures) {
        if(kind === 'military') {g.fillStyle(0x4d6652);g.fillRoundedRect(x-fw/2,y-fh/2,fw,fh,u*.012);g.fillStyle(0xb2b59b);g.fillRect(x-u*.014,y+u*.004,u*.028,u*.006);}
        else if(kind === 'cargo') {g.fillStyle(i%2 ? 0x647f79 : 0xb89b72);g.fillRect(x-fw/2,y-fh/2,fw,fh);g.lineStyle(1,0xf4efda,.3);g.lineBetween(x,y-fh/2,x,y+fh/2);}
        else if(kind === 'passenger') {g.fillStyle(0xd4ccb2);g.fillRect(x-fw/2,y-fh/2,fw,fh);}
        else {g.fillStyle(0xc3c2a6);g.fillRoundedRect(x-fw/2,y-fh/2,fw,fh,u*.004);}
      }
      if(kind === 'rescue') for(const pad of layout.helipads) {g.fillStyle(0xfff5df);g.fillRect(pad.center.x+u*.052,pad.center.y-u*.012,u*.022,u*.024);g.fillStyle(0xb86d55);g.fillRect(pad.center.x+u*.061,pad.center.y-u*.008,u*.004,u*.016);g.fillRect(pad.center.x+u*.055,pad.center.y-u*.002,u*.016,u*.004);}
      if(kind !== 'rescue' && kind !== 'cargo') for(let i=0;i<(detailLevel==='mobile'?8:16);i++) {
        const at={x:w*.055+i*u*.028,y:h*.62+Math.sin(i*.7)*u*.014};
        if(clearOfAirfield(layout,at,u*.008)) paintTree(g,at,u*.008,palette,i);
      }
    }
  },{materialTextureKey:`terrain:arcade:${kind==='cargo'?'mineral':'meadow'}`});
  if (kind === 'rescue') layout.helipads.forEach((pad,i) => scene.add.text(pad.center.x, pad.center.y+pad.radius+u*.008, `H${i+1}`, { ...PHASER_TEXT_STYLES.airfieldMarking, fontSize: `${Math.max(10,u*.021)}px`, color: '#203d39', backgroundColor: '#fff5df', padding: { x: 3, y: 1 } }).setOrigin(.5,0).setDepth(-19));
}

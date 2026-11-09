import type { Vector2 } from '../../core/types';
import type { MapId } from '../maps/mapIds';
import type { PlayableMapLayout } from '../maps/types';
import type { MapRunway, MapTaxiway } from '../maps/shared/airfield';
import type { Carrier } from '../maps/shared/carrier';
import { deterministicUnit, rotatedRectangle, smoothPath } from '../rendering/shared-map/geometry';

export const ATLAS_CELLS = { grass: 0, asphalt: 1, building: 2, tree: 3, cloud: 4, liner: 5, commuter: 6, rotor: 7 } as const;
export type AtlasCell = keyof typeof ATLAS_CELLS;
export type ArtLayer =
  | { kind: 'polygon'; points: readonly Vector2[]; color: number; order: number; water?: boolean }
  | { kind: 'sprite'; cell: AtlasCell; center: Vector2; width: number; height: number; angle: number; order: number };

/** Structural scenery contract: operational geometry always comes from the prepared map. */
interface ArtLayout extends PlayableMapLayout {
  runways?: readonly MapRunway[];
  taxiways?: readonly MapTaxiway[];
  apron?: readonly Vector2[];
  westApron?: readonly Vector2[];
  buildings?: readonly { center: Vector2; width: number; height: number; angle: number }[];
  fixtures?: readonly { center: Vector2; width: number; height: number; angle: number }[];
  fieldPolygons?: readonly (readonly Vector2[])[];
  tidalPools?: readonly (readonly Vector2[])[];
  water?: readonly (readonly Vector2[])[];
  rocks?: readonly (readonly Vector2[])[];
  land?: readonly Vector2[];
  sea?: readonly Vector2[];
  islets?: readonly (readonly Vector2[])[];
  treeBelt?: readonly { center: Vector2; radius: number }[];
  riverBankTrees?: readonly { center: Vector2; radius: number }[];
  pines?: readonly { center: Vector2; radius: number }[];
  scrub?: readonly { center: Vector2; radius: number }[];
  riverPath?: readonly Vector2[];
  riverWidth?: number;
  river?: { centerline: readonly Vector2[]; width: number; shelfWidth: number };
  coastFragments?: readonly { points: readonly Vector2[] }[];
  carrier?: Carrier;
  bridges?: readonly { center: Vector2; length: number; width: number; angle: number }[];
  scenicRunways?: readonly { center: Vector2; length: number; width: number; angle: number }[];
  serviceLandmark?: { center: Vector2; width: number; height: number; angle: number };
  serviceRoads?: readonly (readonly Vector2[])[];
}

export const MAP_GROUND: Record<MapId, number> = {
  'saltmarsh-gateway': 0x87ac5e, 'river-bend': 0x8ea36b, 'desert-parallel': 0xcbb48a,
  'twin-banks': 0xb2a477, 'falcon-air-base': 0x788760, 'executive-point': 0x92a779,
  'metro-international': 0x83947a, 'freight-junction': 0xa29a83, 'island-rescue': 0x4c9eae,
  'frost-crossing': 0xc9dcd9, 'carrier-coast': 0x91a67b, 'blue-water': 0x387e9b,
};

/** Serializable artwork used by both the Blender authoring pipeline and the responsive compositor. */
export function buildMapArt(mapId: MapId, source: PlayableMapLayout): ArtLayer[] {
  const layout = source as ArtLayout;
  const { width: w, height: h } = layout, unit = Math.min(w, h);
  const layers: ArtLayer[] = [];
  const polygon = (points: readonly Vector2[], color: number, order: number, water = false) => {
    if (points.length >= 3) layers.push({ kind: 'polygon', points, color, order, water });
  };
  const rect = (center: Vector2, width: number, height: number, angle: number, color: number, order: number) => polygon(rotatedRectangle(center,width,height,angle),color,order);
  const sprite = (cell: AtlasCell, center: Vector2, width: number, height: number, angle: number, order: number) => layers.push({kind:'sprite',cell,center,width,height,angle,order});
  const path = (points: readonly Vector2[], width: number, color: number, order: number, water = false) => {
    for (let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i];
      polygon(rotatedRectangle({x:(a.x+b.x)/2,y:(a.y+b.y)/2},Math.hypot(a.x-b.x,a.y-b.y)+width*.12,width,Math.atan2(b.y-a.y,b.x-a.x)),color,order,water);
    }
  };
  const circle = (center: Vector2, radius: number) => Array.from({length:33},(_,i)=>({x:center.x+Math.cos(i*Math.PI/16)*radius,y:center.y+Math.sin(i*Math.PI/16)*radius}));
  const ocean = mapId === 'blue-water' || mapId === 'island-rescue';
  polygon([{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}],MAP_GROUND[mapId],0,ocean);
  for (const [i,field] of (layout.fieldPolygons ?? []).entries()) polygon(field,MAP_GROUND[mapId]+(i%2?0x080806:-0x060604),1);
  if (layout.river) {
    polygon([...layout.river.centerline,{x:w,y:h},{x:w,y:0}],0x829b6e,1);
    const river=smoothPath(layout.river.centerline,10);
    path(river,layout.river.width+layout.river.shelfWidth,0xc2c5a2,2);
    path(river,layout.river.width,0x6c949c,3,true);
  }
  if (layout.riverPath) {
    const river=smoothPath(layout.riverPath,10),width=layout.riverWidth!;
    path(river,width+unit*.018,0xc0c6a2,2);path(river,width,0x719fa4,3,true);
  }
  for (const pool of [...layout.tidalPools??[],...layout.water??[],...layout.coastFragments?.map(c=>c.points)??[],...(layout.sea?[layout.sea]:[])]) polygon(pool,mapId==='frost-crossing'?0x72a6b3:0x438fac,3,true);
  for (const island of layout.islets??[]) polygon(island,0xa2b78a,4);
  for (const rock of layout.rocks??[]) polygon(rock,0x7c8d92,4);
  if (mapId==='island-rescue') {
    // Separate islands follow the actual rescue destinations, including all four pads.
    for (const zone of layout.landingZones) polygon(circle(zone.position,zone.captureRadius*(zone.accepts==='rotor'?2.4:4)),0x9faf79,4);
    if(layout.apron) polygon(layout.apron.map(p=>({x:p.x+(p.x-w/2)*.1,y:p.y+(p.y-h/2)*.1})),0x9faf79,4);
    for(const runway of layout.runways??[])rect(runway.center,runway.length+unit*.07,runway.width+unit*.1,runway.angle,0x9faf79,4);
  }
  for(const road of layout.serviceRoads??[])path(road,unit*.006,0xb7b39a,4);
  const trees=[...layout.treeBelt??[],...layout.riverBankTrees??[],...layout.pines??[],...layout.scrub??[]];
  for(const tree of trees)sprite('tree',tree.center,tree.radius*2.6,tree.radius*2.6,0,5);
  // Specialist fields retain distinct terrain and authored terminal/fixture arrangements.
  if(!ocean && trees.length===0 && !layout.carrier) {
    for(let i=0;i<36;i++) {
      const center={x:deterministicUnit(i,11)*w,y:deterministicUnit(i,19)*h};
      if(center.x>w*.1&&center.x<w*.9&&center.y>h*.1&&center.y<h*.9)continue;
      sprite('tree',center,unit*.028,unit*.028,0,5);
    }
  }
  for(const apron of [layout.apron,layout.westApron])if(apron)polygon(apron,0x969d94,6);
  if(layout.carrier) {
    polygon(layout.carrier.hull,0x343f48,5);polygon(layout.carrier.deck,0x6d777b,6);
    const island=layout.carrier.island;sprite('building',island.center,island.width,island.height,island.angle,12);
  }
  for(const bridge of layout.bridges??[])rect(bridge.center,bridge.length,bridge.width,bridge.angle,0x77776b,6);
  for(const runway of layout.scenicRunways??[])rect(runway.center,runway.length,runway.width,runway.angle,0x7e8475,6);
  for(const taxi of layout.taxiways??[])path(taxi.path,taxi.width,0x666d70,7);
  for(const runway of layout.runways??[]) {
    rect(runway.center,runway.length+4,runway.width+4,runway.angle,0xc8ccc2,8);
    sprite('asphalt',runway.center,runway.length,runway.width,runway.angle,9);
    const at=(x:number,y=0)=>({x:runway.center.x+Math.cos(runway.angle)*x-Math.sin(runway.angle)*y,y:runway.center.y+Math.sin(runway.angle)*x+Math.cos(runway.angle)*y});
    for(let x=-.36;x<.4;x+=.08)rect(at(runway.length*x),runway.length*.04,2,runway.angle,0xfbf8ee,10);
    for(const sign of [-1,1])for(const share of [-.32,-.16,.16,.32])rect(at(sign*runway.length*.44,runway.width*share),runway.width*.6,runway.width*.07,runway.angle,0xfbf8ee,10);
  }
  for(const taxi of layout.taxiways??[])path(taxi.path,1.5,0xf0c64a,10);
  for(const lane of layout.apronMarkings?.taxilanes??[])path(lane.path,1.5,0xf0c64a,10);
  for(const stand of layout.apronMarkings?.stands??[]) {
    path([stand.entry,stand.position],1.5,0xf0c64a,10);
    rect(stand.position,stand.length,1.5,stand.angle,0xf0c64a,10);
    rect(stand.position,1.5,stand.width,stand.angle,0xf0c64a,10);
  }
  for(const surface of layout.guidanceSurfaces)if(surface.kind==='pad') {
    const {center,radius}=surface;polygon(circle(center,radius),0x666d70,9);path(circle(center,radius),2,0xfbf8ee,10);
    rect(center,radius,3,0,0xfbf8ee,10);
    for(const sign of [-1,1])rect({x:center.x+sign*radius/2,y:center.y},3,radius*1.2,0,0xfbf8ee,10);
  }
  for(const building of [...layout.buildings??[],...layout.fixtures??[],...(layout.serviceLandmark?[layout.serviceLandmark]:[])])sprite('building',building.center,building.width,building.height,building.angle,12);
  return layers.sort((a,b)=>a.order-b.order);
}

import { FlightOverlay } from '../rendering/FlightOverlay';
import * as THREE from 'three';
import type { Aircraft, AircraftType, Vector2 } from '../../core/types';
import type { MapId } from '../maps/mapIds';
import type { PlayableMapLayout } from '../maps/types';
import type { WorldDetailLevel } from '../palette';
import type { LiveryId } from '../../progression/liveries';
import { AIRCRAFT_OUTLINES } from '../../core/aircraftCollision';
import { MemoryLedger } from '../runtime/diagnostics';
import { Scene } from '../art/CanvasScene';
import { ThreeArtwork } from '../art/ThreeArtwork';
import { paintOriginalMap } from '../art/originalMaps';
import { drawUnder } from '../rendering/shared-map/lighting';
import { flattenBakedLayers } from '../rendering/shared-map/composer';
import { drawNight } from '../rendering/NightRenderer';
import { createAircraftView, type AircraftView } from '../rendering/AircraftView';

type Actor={view:AircraftView;aircraft:Aircraft;scale:number;grounded:boolean;alpha:number};
/** The original artwork and animations, rasterized once and presented by Three.js. */
export class MapWorld {
  readonly group=new THREE.Group();
  private source!:Scene;
  private bridge!:ThreeArtwork;
  ui!:FlightOverlay;
  get routes(){return this.ui.routeGraphics;}
  private actors=new Map<number,Actor>();
  private weather=true;
  private clock=0;
  constructor(readonly mapId:MapId,readonly layout:PlayableMapLayout,private readonly ledger:MemoryLedger,
    private readonly livery:LiveryId='classic',private readonly detail:WorldDetailLevel='desktop',private night=false,private readonly density=1,private readonly emit:(event:string,...args:any[])=>void=()=>{}){this.rebuild();}
  private rebuild(){
    const actors=[...this.actors.values()];this.actors.clear();
    this.bridge?.dispose();this.source?.destroy();this.group.clear();
    this.source=new Scene(this.layout.width,this.layout.height,this.density);
    drawUnder(this.night,()=>paintOriginalMap(this.source,this.mapId,this.layout,this.detail));
    flattenBakedLayers(this.source,this.layout.width,this.layout.height);
    if(this.night)drawNight(this.source,this.layout);
    this.source.events.emit('night-mode',this.night);this.source.events.emit('weather-mode',this.weather);
    this.ui=new FlightOverlay(this.source,this.layout,this.emit);
    this.bridge=new ThreeArtwork(this.source,this.density);this.group.add(this.bridge.group);
    for(const actor of actors)this.place(actor.aircraft,actor.scale,actor.grounded,actor.alpha);
    this.sync();
  }
  private place(aircraft:Aircraft,scale:number,grounded:boolean,alpha:number){
    let actor=this.actors.get(aircraft.id);
    if(!actor){
      const view=createAircraftView(this.source,aircraft,{livery:this.livery,presentationScale:1,night:this.night,
        military:this.mapId==='carrier-coast'||this.mapId==='blue-water'});
      actor={view,aircraft,scale,grounded:false,alpha};this.actors.set(aircraft.id,actor);
    }
    actor.aircraft=aircraft;actor.scale=scale;actor.alpha=alpha;
    if(grounded&&!actor.grounded)actor.view.toGround(aircraft.id<0);
    actor.grounded=grounded;this.syncActor(actor,0,false);
  }
  private syncActor(actor:Actor,delta:number,running:boolean){
    if(actor.grounded){actor.view.setGroundScale(actor.scale);actor.view.syncGround({...actor.aircraft,alpha:actor.alpha},delta*1000,running);}
    else {actor.view.sync(actor.aircraft,delta*1000,running);actor.view.container.setScale(actor.scale);}
  }
  aircraft(id:number,type:AircraftType,position:Vector2,heading:number,spriteSize:number,grounded=false,alpha=1,original?:Aircraft){
    const xs=AIRCRAFT_OUTLINES[type].map(([x])=>x),scale=spriteSize*.75/(Math.max(...xs)-Math.min(...xs));
    const aircraft=original??{id,type,position,heading,speed:0,collisionRadius:0,state:'flying',hasEntered:true,landingProgress:0} as Aircraft;
    this.place(aircraft,scale,grounded,alpha);
  }
  retainAircraft(ids:Set<number>){for(const[id,actor]of this.actors)if(!ids.has(id)){actor.view.destroy();this.actors.delete(id);}}
  selectAircraft(id:number|undefined){for(const [key,actor]of this.actors)actor.view.setSelected(key===id);}
  update(seconds:number,reduced:boolean){
    if(!reduced){this.clock+=seconds;this.source.events.emit('update',this.clock*1000,seconds*1000);}
    for(const actor of this.actors.values()){actor.view.setReducedMotion(reduced);this.syncActor(actor,seconds,true);}
  }
  setWeather(value:boolean){this.weather=value;this.source.events.emit('weather-mode',value);}
  setNight(value:boolean){if(value!==this.night){this.night=value;this.rebuild();}}
  sync(){this.bridge.sync();const bytes=this.bridge.memoryBytes();this.ledger.set('original-artwork',bytes,bytes);}
  dispose(){this.bridge.dispose();this.source.destroy();this.actors.clear();this.group.clear();this.ledger.delete('original-artwork');}
}

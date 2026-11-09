import * as THREE from 'three';
import type { Aircraft, SimulationSnapshot, Vector2 } from '../../core/types';
import type { DifficultyId } from '../../core/difficulty';
import { aircraftSelectionRadius } from '../../core/aircraftSelection';
import { AIRCRAFT_OUTLINES } from '../../core/aircraftCollision';
import { resolveLandingTarget, type LandingTargetingResult, type PointerPrecision } from '../../core/landingTargeting';
import { MAX_HOLDING } from '../../core/Simulation';
import { trafficProfileById } from '../maps/trafficProfiles';
import { aircraftPresentationScale } from '../rendering/aircraft/visualTokens';
import { GroundTraffic } from '../ground/groundTraffic';
import { SessionController } from '../runtime/SessionController';
import { RuntimeEventBus } from '../runtime/events';
import { FrameMetrics, MemoryLedger, sampledHeapBytes } from '../runtime/diagnostics';
import type { GameplayRuntime, GameplaySession, SavedSession } from '../runtime/types';
import type { RuntimeOptions } from '../runtime/types';
import { mountGameDiagnostics } from '../../ui/gameDiagnostics';
import { drawingSize, pointerToWorld } from './projection';
import { MapWorld } from './MapWorld';


/** Shared gameplay runtime for every airfield. */
export class ThreeRuntime implements GameplayRuntime, GameplaySession {
  readonly events = new RuntimeEventBus();
  readonly world: Readonly<{ width: number; height: number }>;
  readonly metrics = new FrameMetrics();
  private readonly ledger = new MemoryLedger();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly layout;
  private readonly session: SessionController;
  private readonly scales;
  private readonly groundScales;
  private readonly ground: GroundTraffic;
  private readonly previousAircraft = new Map<number, Aircraft>();
  private presentation?: MapWorld;


  private disposeDiagnostics?: () => void;
  private readonly abort = new AbortController();
  private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');
  private disposed = false;
  private ready = false;
  private active = false;
  private frameId = 0;
  private lastFrame = 0;
  private resultTimer?: number;
  private speed = 1;
  private night: boolean;
  private weather = true;
  private lastHudSecond = -1;
  private pointer?: number;
  private selected?: number;
  private precision: PointerPrecision = 'mouse';
  private points: Vector2[] = [];
  private target: LandingTargetingResult = { status: 'neutral' };

  constructor(private readonly options: RuntimeOptions) {
    this.world = Object.freeze({ ...options.world });
    this.night = options.night;
    this.layout = options.map.prepare({ ...this.world, twoEndLanding: options.twoEndLanding, detailLevel: options.detailLevel ?? (options.mobile?'mobile':'desktop') }).layout;
    this.scales = { liner: aircraftPresentationScale('liner', {width:innerWidth,height:innerHeight}, this.world),
      commuter: aircraftPresentationScale('commuter', {width:innerWidth,height:innerHeight}, this.world),
      rotor: aircraftPresentationScale('rotor', {width:innerWidth,height:innerHeight}, this.world) };
    this.groundScales = { ...this.scales };
    let gap = 0;
    for (const type of ['liner','commuter','rotor'] as const) {
      const xs = AIRCRAFT_OUTLINES[type].map(([x]) => x);
      const length = (Math.max(...xs)-Math.min(...xs))*this.scales[type];
      const stand = this.layout.apronMarkings?.stands.find(item => item.accepts === type);
      this.groundScales[type] = this.scales[type]*(stand ? Math.min(.5, stand.length*.92/length) : .5);
      if(type!=='rotor')gap = Math.max(gap, length*this.groundScales[type]/this.scales[type]*2);
    }
    this.ground = new GroundTraffic(this.layout.groundRoutes ?? {}, {unit:Math.min(this.world.width,this.world.height),gap});
    this.session = new SessionController({ zones:this.layout.landingZones,world:this.world,
      traffic:trafficProfileById(options.map.trafficProfileId),collisionScales:this.scales });
    this.renderer = new THREE.WebGLRenderer({ antialias:true,depth:false,stencil:false,alpha:false,powerPreference:'low-power' });
    this.renderer.setClearColor(0x87ac5e);
    const size = drawingSize(this.world,2_000_000);
    this.renderer.setSize(size.width,size.height,false);
    this.ledger.set('drawing-buffers',0,size.width*size.height*8);
    const canvas = this.renderer.domElement;
    canvas.dataset.renderer = 'three';
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block;';
    document.querySelector('#game')!.append(canvas);
    this.camera = new THREE.OrthographicCamera(0,this.world.width,0,this.world.height,.1,100);
    this.camera.position.z = 10;
    const signal = this.abort.signal;
    canvas.addEventListener('pointerdown',this.pointerDown,{signal});
    canvas.addEventListener('pointermove',this.pointerMove,{signal});
    canvas.addEventListener('pointerup',this.pointerUp,{signal});
    canvas.addEventListener('pointercancel',this.cancelPointer,{signal});
    canvas.addEventListener('lostpointercapture',this.cancelPointer,{signal});
    canvas.addEventListener('webglcontextlost',event => {event.preventDefault();this.pauseRun();this.sleep();},{signal});
    canvas.addEventListener('webglcontextrestored',() => options.onContextRestored(),{signal});
    void this.load().catch(error => { if (!this.disposed) this.events.emit('runtime-error', error); });
  }

  private async load() {
    // Yield one task so DeferredRuntime can subscribe before scene-ready is emitted.
    await new Promise<void>(resolve=>setTimeout(resolve,0));
    if(this.disposed)return;
    this.presentation = new MapWorld(this.options.map.id,this.layout,this.ledger,this.options.livery,
      this.options.detailLevel??(this.options.mobile?'mobile':'desktop'),this.night,
      Math.min(1.5,this.renderer.domElement.width/this.world.width),(event,...args)=>this.events.emit(event,...args));
    this.scene.add(this.presentation.group);
    this.setNight(this.night);
    this.setWeather(this.weather);
    this.disposeDiagnostics = mountGameDiagnostics({metrics:this.metrics,phase:()=>this.getPhase(),sessionId:()=>this.session.runId,canvas:()=>this.renderer.domElement,
      memory:()=>{const memory=this.ledger.snapshot();return {heap:sampledHeapBytes(),externalCpu:memory.cpu,gpu:memory.gpu,complete:false};}});
    this.seedParkedAircraft();
    this.ready = true;
    this.events.emit('scene-ready',{...this.world,mapId:this.options.map.id,variant:this.layout.variant,hudExclusionZones:this.layout.hudExclusionZones});
    this.wake();
  }

  // CSS fills the game host even when mobile browser chrome changes its height.
  // Keep the logical world stable: pointerToWorld uses the actual canvas bounds,
  // so saved games and in-progress routes remain aligned without cropping.
  get running() {return this.active;}
  getSession() {return this.ready && !this.disposed ? this : undefined;}
  wake() {
    if (this.disposed || this.active || !this.ready) return;
    this.active=true;this.lastFrame=0;this.frameId=requestAnimationFrame(this.tick);
  }
  sleep() {this.active=false;cancelAnimationFrame(this.frameId);}
  captureFrame(callback:(canvas:HTMLCanvasElement)=>void) {
    if(this.disposed)return;
    this.events.once('frame',()=>callback(this.renderer.domElement));this.wake();
  }
  private tick = (now:number) => {
    if(!this.active || this.disposed || !this.presentation)return;
    const delta=this.lastFrame ? Math.min(.1,(now-this.lastFrame)/1000) : 0;
    this.lastFrame=now;
    let started=performance.now();
    this.session.simulation.update(delta*this.speed);
    const snapshot=this.session.simulation.snapshot();
    this.metrics.record('simulation',performance.now()-started);
    started=performance.now();
    this.syncAircraft(snapshot,delta*this.speed);
    this.metrics.record('aircraft',performance.now()-started);
    started=performance.now();
    this.presentation.ui.update(delta*1000,this.motion.matches);
    this.drawRoutes(snapshot);
    this.metrics.record('routes',performance.now()-started);
    if(snapshot.phase==='running')this.presentation.update(delta,this.motion.matches);
    this.processEvents(snapshot);
    const second=Math.floor(snapshot.elapsed);
    if(second!==this.lastHudSecond){this.lastHudSecond=second;this.events.emit('hud-update',snapshot);}
    started=performance.now();
    this.presentation.sync();
    this.renderer.render(this.scene,this.camera);
    this.metrics.record('render',performance.now()-started);
    if(snapshot.phase==='running' && !document.hidden)this.metrics.frame(now,this.renderer.info.render.calls);
    this.events.emit('frame');
    if(this.active)this.frameId=requestAnimationFrame(this.tick);
  };

  private syncAircraft(snapshot:SimulationSnapshot,delta:number) {
    const live=new Set(snapshot.aircraft.map(aircraft=>aircraft.id));
    for(const [id,aircraft] of this.previousAircraft)if(!live.has(id) && aircraft.state==='landing')this.ground.add(aircraft,aircraft.landingZoneId,this.motion.matches);
    this.previousAircraft.clear();
    for(const aircraft of snapshot.aircraft){
      const scale=this.scales[aircraft.type]+(aircraft.state==='landing'?aircraft.landingProgress*(this.groundScales[aircraft.type]-this.scales[aircraft.type]):0);
      this.presentation!.aircraft(aircraft.id,aircraft.type,aircraft.position,aircraft.heading,this.spriteSize(aircraft.type,scale),false,1,aircraft);
      this.previousAircraft.set(aircraft.id,{...aircraft,position:{...aircraft.position}});
    }
    if(snapshot.phase==='running')this.ground.update(delta);
    for(const aircraft of this.ground.aircraft){
      live.add(aircraft.id);
      this.presentation!.aircraft(aircraft.id,aircraft.type,aircraft.position,aircraft.heading,this.spriteSize(aircraft.type,this.groundScales[aircraft.type]),true,aircraft.alpha);
    }
    this.presentation!.retainAircraft(live);
  }
  private spriteSize(type:Aircraft['type'],scale:number) {
    const xs=AIRCRAFT_OUTLINES[type].map(([x])=>x);
    return (Math.max(...xs)-Math.min(...xs))*scale/0.75;
  }
  private drawRoutes(snapshot:SimulationSnapshot) {
    this.presentation!.selectAircraft(this.selected);
    this.presentation!.ui.draw(snapshot,this.selected,this.points,this.target,this.session.simulation.holdLoops,this.scales);
  }

  private processEvents(snapshot:SimulationSnapshot) {
    for(const event of this.session.drainEvents()){
      if(event.type==='landed'){
        this.events.emit('landing',event.score);
        this.events.emit('feedback',{type:'landing-completed',aircraftId:event.aircraftId,score:event.score});
      }else if(event.type==='warning')this.events.emit('traffic-warning');
      else if(event.type==='landing-started')this.presentation!.ui.landing(event.zoneId);
      else if(event.type==='gameover'){
        this.cancelDrawing();
        this.presentation!.ui.failure(event,snapshot,this.scales,this.motion.matches);
        if(event.reason==='collision')this.events.emit('feedback',{type:'collision',aircraftIds:event.aircraftIds});
        const result={reason:event.reason,score:snapshot.score,runId:this.session.runId,evidence:structuredClone(this.session.evidence)};
        this.events.emit('run-state','over');
        this.resultTimer=window.setTimeout(()=>this.events.emit('game-over',result),this.motion.matches?0:650);
      }
    }
  }
  private point(event:PointerEvent){return pointerToWorld({x:event.clientX,y:event.clientY},this.renderer.domElement.getBoundingClientRect(),this.world);}
  private pointerDown=(event:PointerEvent)=>{
    if(this.getPhase()!=='running'||this.pointer!==undefined||event.button!==0)return;
    const point=this.point(event),rect=this.renderer.domElement.getBoundingClientRect();
    this.precision=event.pointerType==='touch'||event.pointerType==='pen'?'coarse':'mouse';
    let nearest:Aircraft|undefined,distance=Infinity;
    for(const aircraft of this.session.simulation.snapshot().aircraft){
      const d=Math.hypot(point.x-aircraft.position.x,point.y-aircraft.position.y);
      const radius=aircraftSelectionRadius(aircraft.type,this.scales[aircraft.type],Math.min(rect.width/this.world.width,rect.height/this.world.height),this.precision==='coarse');
      if(aircraft.state!=='landing'&&d<=radius&&d<distance){nearest=aircraft;distance=d;}
    }
    if(!nearest)return;
    this.pointer=event.pointerId;this.selected=nearest.id;this.points=[{...nearest.position},point];
    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.presentation!.ui.selected(nearest);
  };
  private record(event:PointerEvent){
    const point=this.point(event),previous=this.points[this.points.length-1];
    if(previous&&Math.hypot(point.x-previous.x,point.y-previous.y)<6)this.points[this.points.length-1]=point;
    else if(this.points.length<2048)this.points.push(point);
    else this.points[this.points.length-1]=point;
    const aircraft=this.session.simulation.snapshot().aircraft.find(aircraft=>aircraft.id===this.selected);
    if(!aircraft){this.cancelDrawing();return;}
    const was=JSON.stringify(this.target);
    this.target=resolveLandingTarget({aircraftType:aircraft.type,aircraftCollisionRadius:aircraft.collisionRadius,points:this.points,
      zones:this.layout.landingZones,pointerPrecision:this.precision,retainedZoneId:this.target.status==='locked'?this.target.zoneId:undefined});
    if(JSON.stringify(this.target)!==was)this.presentation!.ui.targeted(aircraft,this.target);
  }
  private pointerMove=(event:PointerEvent)=>{if(event.pointerId===this.pointer)this.record(event);};
  private previewPoints(){
    if(this.target.status!=='locked')return this.points;
    return [...this.points.slice(0,-1),this.target.snappedPoint];
  }
  private pointerUp=(event:PointerEvent)=>{
    if(event.pointerId!==this.pointer||this.selected===undefined)return;
    this.record(event);
    if(this.selected===undefined)return;
    const id=this.selected;
    const pressed=this.points[1];
    if(pressed&&this.points.slice(2).every(point=>Math.hypot(point.x-pressed.x,point.y-pressed.y)<10)){
      if(this.session.simulation.holdAircraft(id))this.events.emit('route-status','Holding');
      else if(this.session.simulation.holdingCount()>=MAX_HOLDING)this.events.emit('route-status',`Only ${MAX_HOLDING} aircraft can hold at once`);
    }else{
      const zone=this.target.status==='locked'||this.target.status==='invalid'?this.target.zoneId:undefined;
      const result=this.session.simulation.assignRoute(id,this.previewPoints(),zone);
      const aircraft=this.session.simulation.snapshot().aircraft.find(a=>a.id===id)!;
      const endpoint=this.previewPoints().at(-1);
      this.cancelDrawing();
      if(result.accepted)this.presentation!.ui.handleAcceptedRoute(result);
      else this.presentation!.ui.handleRejectedRoute(result,endpoint,aircraft);
      return;
    }
    this.cancelDrawing();
  };
  private cancelPointer=(event:PointerEvent)=>{if(event.pointerId===this.pointer)this.cancelDrawing();};
  cancelDrawing(){
    this.presentation?.ui.clearGuidance();this.presentation?.selectAircraft(undefined);
    const pointer=this.pointer;this.pointer=this.selected=undefined;this.points=[];this.target={status:'neutral'};
    if(pointer!==undefined&&this.renderer.domElement.hasPointerCapture(pointer))this.renderer.domElement.releasePointerCapture(pointer);
  }
  startRun(difficulty:DifficultyId='medium',runId=''){
    window.clearTimeout(this.resultTimer);this.session.start(difficulty,runId);this.metrics.reset();this.cancelDrawing();this.previousAircraft.clear();this.lastHudSecond=-1;
    this.ground.clear();
    this.presentation?.retainAircraft(new Set());this.presentation?.ui.reset();
    this.seedParkedAircraft();
    this.events.emit('run-state','running');this.wake();
  }
  private seedParkedAircraft(){
    this.ground.seed((['liner','commuter'] as const).flatMap((type,index)=>{
      const stand=this.layout.apronMarkings?.stands.find(item=>item.accepts===type);
      return stand?[{id:-index-1,type,stand:{id:stand.id,position:stand.position,angle:stand.angle}}]:[];
    }));
  }
  pauseRun(){this.session.simulation.pause();this.cancelDrawing();this.metrics.reset();this.events.emit('run-state','paused');}
  resumeRun(){this.session.simulation.resume();this.metrics.reset();this.events.emit('run-state','running');this.wake();}
  exportShift(){return this.session.exportState();}
  restoreRun(difficulty:DifficultyId,shift:SavedSession){
    if(!this.session.canRestore(shift))return false;
    this.startRun(difficulty,shift.runId);this.session.restore(difficulty,shift);this.events.emit('run-state','paused');return true;
  }
  getPhase(){return this.session.simulation.snapshot().phase;}
  getLayout(){return this.layout;}
  getShiftSnapshot(){return structuredClone({twoEndLanding:this.options.twoEndLanding,runId:this.session.runId,simulation:this.session.simulation.snapshot(),landingZones:this.layout.landingZones,evidence:this.session.evidence});}
  setTimeScale(scale:number){this.speed=scale;}
  setNight(enabled:boolean){this.night=enabled;this.presentation?.setNight(enabled);}
  setWeather(enabled:boolean){this.weather=enabled;this.presentation?.setWeather(enabled);}
  destroy(){
    if(this.disposed)return;this.disposed=true;this.sleep();this.abort.abort();window.clearTimeout(this.resultTimer);
    this.disposeDiagnostics?.();this.presentation?.dispose();
    this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();this.events.clear();this.scene.clear();
  }
}

import { Scene, type Text, type Graphics } from '../art/CanvasScene';
import type { Aircraft, LandingZone, SimulationSnapshot, Vector2, RouteAssignmentResult, SimulationEvent } from '../../core/types';
import type { FeedbackEvent } from '../../app/feedbackEvents';
import type { LandingTargetingResult } from '../../core/landingTargeting';
import { HOLD_RADIUS } from '../../core/Simulation';
import { distance } from '../../core/geometry';
import { aircraftWarningDistance, aircraftCollisionOutline, type AircraftCollisionScales, DEFAULT_COLLISION_SCALES } from '../../core/aircraftCollision';
import { AIRCRAFT_STYLE } from '../content';
import { ROUTE_OUTLINE_COLOR } from '../palette';
import type { PlayableMapLayout } from '../maps/types';
import { RouteGuidanceRenderer, type RouteGuidanceTarget } from './RouteGuidanceRenderer';
const routeEdgeColor = (color: number): number => {
  const mix = (shift: number) => Math.round(((color >> shift) & 0xff) * 0.35 + ((ROUTE_OUTLINE_COLOR >> shift) & 0xff) * 0.65);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
};

const GUIDANCE_REJECTION_DURATION=380, GUIDANCE_CONFIRMATION_DURATION=400, GUIDANCE_LANDING_DURATION=860;
/** Original gameplay feedback, shared by the Three.js presentation. */
export class FlightOverlay {
 readonly routeGraphics:Graphics;
 private readonly approachLabels:Text[];
 private readonly warningGraphics:Graphics;
 private readonly previewGraphics:Graphics;
 private readonly failureMarker:Graphics;
 private readonly flash:Graphics;
 private flashRemaining=0;
 private readonly routeGuidance:RouteGuidanceRenderer;
 private guidanceHideAfterMilliseconds=0;
 private routeCoachSelectedEmitted=false;
 private routeCoachLockedEmitted=false;
 private routeCoachSetEmitted=false;
 private snapshot!:SimulationSnapshot;
 private drawingAircraftId?:number;
 private drawnPoints:Vector2[]=[];
 private landingTarget:LandingTargetingResult={status:'neutral'};
 private holdLoops=1;
 private collisionScales:AircraftCollisionScales=DEFAULT_COLLISION_SCALES;
 constructor(scene:Scene,private readonly layout:PlayableMapLayout,private readonly emit:(event:string,...args:any[])=>void){
    this.approachLabels = this.layout.landingZones.map(zone => scene.add.text(
      zone.position.x, zone.position.y + zone.captureRadius + 8,
      zone.approach ? `${zone.accepts === 'liner' ? 'L' : 'C'} · ${zone.label}` : zone.label,
      { fontFamily: 'Atkinson Hyperlegible', fontSize: '20px', color: '#fff5df', backgroundColor: '#203d39', padding: { x: 4, y: 2 } }
    ).setOrigin(.5,0).setDepth(7).setVisible(false));

  this.routeGraphics=scene.add.graphics().useVectorRendering().setDepth(4);
  this.warningGraphics=scene.add.graphics().useVectorRendering().setDepth(6);
  this.previewGraphics=scene.add.graphics().useVectorRendering().setDepth(8);
  this.failureMarker=scene.add.graphics().useVectorRendering().setDepth(12);
  this.flash=scene.add.graphics().useVectorRendering().setDepth(100).setAlpha(0);
  this.routeGuidance=new RouteGuidanceRenderer(scene,this.guidanceTarget(layout.landingZones[0]),{depth:5});
  this.routeGuidance.setVisible(false);
 }
 draw(snapshot:SimulationSnapshot,selected:number|undefined,points:Vector2[],target:LandingTargetingResult,holdLoops:number,scales:AircraftCollisionScales){
  this.snapshot=snapshot;this.drawingAircraftId=selected;this.drawnPoints=points;this.landingTarget=target;this.holdLoops=holdLoops;this.collisionScales=scales;
  this.drawRoutes(snapshot);this.drawWarnings(snapshot);this.drawPreview();
 }
 update(milliseconds:number,reduced:boolean){
  this.routeGuidance.setReducedMotion(reduced);this.routeGuidance.update(milliseconds);this.updateGuidanceTimeout(milliseconds);
  if(this.flashRemaining>0){this.flashRemaining=Math.max(0,this.flashRemaining-milliseconds);this.flash.setAlpha(reduced?0:this.flashRemaining/180);if(!this.flashRemaining)this.flash.clear();}
 }
 reset(){this.clearGuidance();this.failureMarker.clear();this.flashRemaining=0;this.flash.setAlpha(0);}
 clearGuidance(){this.routeGuidance.reset();this.routeGuidance.setVisible(false);this.guidanceHideAfterMilliseconds=0;}
 selected(aircraft:Aircraft){const zone=this.compatibleZone(aircraft);if(zone){this.showGuidance(zone,'compatible');this.emitRouteCoach('selected');this.announce(this.zoneName(zone)+' ready');}}
 targeted(aircraft:Aircraft,target:LandingTargetingResult){
  const zone=target.status==='neutral'?this.compatibleZone(aircraft):this.zoneById(target.zoneId);if(!zone)return;
  this.showGuidance(zone,target.status==='neutral'?'compatible':target.status);
  if(target.status==='locked'){this.emitRouteCoach('locked');this.announce('Route locked to '+this.zoneName(zone).toLowerCase());}
  if(target.status==='invalid')this.announce('Wrong destination: '+this.zoneName(zone));
 }
 landing(zoneId:string){const zone=this.zoneById(zoneId);if(zone){this.showGuidance(zone,'landing-started');this.guidanceHideAfterMilliseconds=GUIDANCE_LANDING_DURATION;this.announce(this.zoneName(zone)+' capture confirmed');}}
 failure(event:Extract<SimulationEvent,{type:'gameover'}>,snapshot:SimulationSnapshot,scales:AircraftCollisionScales,reduced:boolean){
  this.clearGuidance();this.failureMarker.clear();this.flashRemaining=reduced?0:180;
  if(!reduced)this.flash.fillStyle(0xf1726b).fillRect(0,0,this.layout.width,this.layout.height).setAlpha(1);
  if(event.reason==='collision')for(const plane of snapshot.aircraft.filter(p=>event.aircraftIds?.includes(p.id))){const outline=aircraftCollisionOutline(plane,scales[plane.type]);this.failureMarker.lineStyle(3,0xfff5df,1).strokePoints(outline,true);}
  if(event.exitPosition){const x=Math.max(25,Math.min(this.layout.width-25,event.exitPosition.x)),y=Math.max(25,Math.min(this.layout.height-25,event.exitPosition.y));this.failureMarker.lineStyle(6,0xfff5df).strokeCircle(x,y,40).lineStyle(4,0xc95236).strokeCircle(x,y,34);}
 }
 private drawingAircraft(){return this.snapshot.aircraft.find(a=>a.id===this.drawingAircraftId);}
 private announce(message:string){this.emit('route-status',message);}
 private emitFeedback(event:FeedbackEvent){this.emit('feedback',event);}
  private drawRoutes(snapshot: SimulationSnapshot): void {
    this.routeGraphics.clear();
    const drawing = this.drawingAircraft();
    this.layout.landingZones.forEach((zone, index) => {
      const visible = !!drawing && drawing.type === zone.accepts;
      this.approachLabels[index]?.setVisible(visible);
      if (!visible) return;
      const {x,y} = zone.position;
      this.routeGraphics.lineStyle(2,zone.color,.65);
      this.routeGraphics.strokeCircle(x,y,zone.captureRadius);
      if (zone.approach) {
        const dx=Math.cos(zone.angle), dy=Math.sin(zone.angle), r=zone.captureRadius;
        this.routeGraphics.lineBetween(x-dx*r*2,y-dy*r*2,x,y);
        this.routeGraphics.lineBetween(x,y,x-dx*12-dy*8,y-dy*12+dx*8);
        this.routeGraphics.lineBetween(x,y,x-dx*12+dy*8,y-dy*12-dx*8);
      }
    });

    for (const aircraft of snapshot.aircraft) {
      if (aircraft.holding && !aircraft.route && aircraft.state !== "landing") {
        // The hold ring is centred a radius to the inside of the turn. It starts strong and fades
        // as the loops are flown; on the last loop only the stretch still ahead is drawn, so the
        // ring shrinks back to the point where the aircraft straightens out.
        const side = aircraft.heading + aircraft.holding * Math.PI / 2;
        const center = { x: aircraft.position.x + Math.cos(side) * HOLD_RADIUS, y: aircraft.position.y + Math.sin(side) * HOLD_RADIUS };
        const total = this.holdLoops * Math.PI * 2;
        const turned = Math.min(total, aircraft.holdTurned ?? 0);
        const progress = turned / total;
        this.routeGraphics.lineStyle(2.6 - progress, AIRCRAFT_STYLE[aircraft.type].color, 0.9 - progress * 0.65);
        const ahead = total - turned;
        if (ahead >= Math.PI * 2) {
          this.routeGraphics.strokeCircle(center.x, center.y, HOLD_RADIUS);
        } else {
          const from = side + Math.PI;
          this.routeGraphics.beginPath();
          this.routeGraphics.arc(center.x, center.y, HOLD_RADIUS, from, from + aircraft.holding * ahead, aircraft.holding < 0);
          this.routeGraphics.strokePath();
        }
      }
      if (!aircraft.route || aircraft.state === "landing") continue;
      const style = AIRCRAFT_STYLE[aircraft.type];
      const remaining = aircraft.route.points.slice(
        Math.max(0, aircraft.route.segmentIndex - 1),
      );
      if (remaining.length < 2) continue;

      // A soft edge in a deep shade of the aircraft's own colour, then the colour itself; both
      // strongest just ahead of the aircraft and easing off toward the landing area.
      const path = [{ ...aircraft.position }, ...remaining];
      this.strokeFadingRoute(this.routeGraphics, path, 5, routeEdgeColor(style.color), 0.8, 0.45);
      this.strokeFadingRoute(this.routeGraphics, path, 2.8, style.color, 0.96, 0.6);

      if (aircraft.route.destinationZoneId) {
        const zone = this.zoneById(aircraft.route.destinationZoneId);
        if (zone) {
          this.routeGraphics.fillStyle(style.color, 0.95);
          this.routeGraphics.fillCircle(zone.position.x, zone.position.y, 5);
          this.routeGraphics.lineStyle(2, 0xf7f2df, 0.76);
          this.routeGraphics.strokeCircle(zone.position.x, zone.position.y, 10);
        }
      }
    }
  }

  private drawPreview(): void {
    this.previewGraphics.clear();
    if (this.drawingAircraftId === undefined || this.drawnPoints.length < 2)
      return;

    const aircraft = this.drawingAircraft();
    if (!aircraft) return;
    const style = AIRCRAFT_STYLE[aircraft.type];
    const points = this.previewRoutePoints();
    const previewColor =
      this.landingTarget.status === "invalid" ? 0xf3a08d : style.color;

    this.previewGraphics.lineStyle(5, routeEdgeColor(previewColor), 0.6);
    this.strokePolyline(this.previewGraphics, points);
    this.previewGraphics.lineStyle(3, previewColor, 0.96);
    this.strokePolyline(this.previewGraphics, points);

    const endpoint = points[points.length - 1];
    this.previewGraphics.fillStyle(previewColor, 0.92);
    this.previewGraphics.fillCircle(endpoint.x, endpoint.y, 5);
  }

  private previewRoutePoints(): readonly Vector2[] {
    if (
      this.landingTarget.status !== "locked" ||
      this.drawnPoints.length === 0
    ) {
      return this.drawnPoints;
    }

    const points = this.drawnPoints.slice();
    points[points.length - 1] = { ...this.landingTarget.snappedPoint };
    return points;
  }

  private drawWarnings(snapshot: SimulationSnapshot): void {
    this.warningGraphics.clear();
    for (
      let firstIndex = 0;
      firstIndex < snapshot.aircraft.length;
      firstIndex += 1
    ) {
      const first = snapshot.aircraft[firstIndex];
      if (first.state === "landing") continue;
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < snapshot.aircraft.length;
        secondIndex += 1
      ) {
        const second = snapshot.aircraft[secondIndex];
        if (second.state === "landing") continue;
        const separation = distance(first.position, second.position);
        const warningDistance = aircraftWarningDistance(first,second,this.collisionScales);
        if (separation >= warningDistance) continue;
        const alpha = 0.25 + (1 - separation / warningDistance) * 0.55;
        this.warningGraphics.fillStyle(0xe26945, alpha * 0.16);
        this.warningGraphics.fillCircle(first.position.x, first.position.y, 38);
        this.warningGraphics.fillCircle(
          second.position.x,
          second.position.y,
          38,
        );
        this.warningGraphics.lineStyle(3, 0xc95236, Math.min(1, alpha + 0.2));
        this.warningGraphics.strokeCircle(
          first.position.x,
          first.position.y,
          38,
        );
        this.warningGraphics.strokeCircle(
          second.position.x,
          second.position.y,
          38,
        );
        this.warningGraphics.lineBetween(
          first.position.x,
          first.position.y,
          second.position.x,
          second.position.y,
        );
      }
    }
  }

  private strokeFadingRoute(
    graphics: Graphics,
    points: readonly Vector2[],
    width: number,
    color: number,
    from: number,
    to: number,
  ): void {
    const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    if (total <= 0) return;
    const bands = 6;
    let index = 0;
    let walked = 0;
    let band: Vector2[] = [points[0]];
    for (let b = 1; b <= bands; b += 1) {
      const end = (total * b) / bands;
      while (index < lengths.length && walked + lengths[index] <= end + 1e-6) {
        walked += lengths[index];
        index += 1;
        band.push(points[index]);
      }
      if (index < lengths.length && b < bands) {
        // Split the segment that straddles the band boundary.
        const t = (end - walked) / lengths[index];
        const a = points[index];
        const c = points[index + 1];
        band.push({ x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t });
      }
      graphics.lineStyle(width, color, from + (to - from) * ((b - 0.5) / bands));
      this.strokePolyline(graphics, band);
      band = [band[band.length - 1]];
    }
  }

  private strokePolyline(
    graphics: Graphics,
    points: readonly Vector2[],
  ): void {
    if (points.length < 2) return;
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      graphics.lineTo(points[index].x, points[index].y);
    }
    graphics.strokePath();
  }

  private guidanceTarget(zone: LandingZone): RouteGuidanceTarget {
    const target = {
      x: zone.position.x,
      y: zone.position.y,
      captureRadius: zone.captureRadius,
      color: zone.color,
    };
    const surface = this.layout.guidanceSurfaces.find(
      (candidate) => candidate.zoneId === zone.id,
    );
    if (!surface || surface.kind === "pad") return { ...target, kind: "pad" };

    return {
      ...target,
      kind: "runway",
      angle: zone.angle,
      runwayLength: surface.length,
      runwayWidth: surface.width,
    };
  }

  private zoneById(zoneId: string): LandingZone | undefined {
    return this.layout.landingZones.find((zone) => zone.id === zoneId);
  }

  private zoneName(zone: LandingZone): string {
    return zone.accepts === "rotor" ? `Helipad ${zone.label}` : `Runway ${zone.label}`;
  }

  private compatibleZone(aircraft: Aircraft): LandingZone | undefined {
    return this.layout.landingZones.find(
      (zone) => zone.accepts === aircraft.type,
    );
  }

  private showGuidance(
    zone: LandingZone,
    state: Parameters<RouteGuidanceRenderer["setState"]>[0],
    returnTo: Parameters<RouteGuidanceRenderer["setState"]>[1] = "neutral",
  ): void {
    this.routeGuidance.setTarget(this.guidanceTarget(zone));
    this.routeGuidance.setVisible(true);
    this.routeGuidance.setState(state, returnTo);
    this.guidanceHideAfterMilliseconds = 0;
  }

  private updateGuidanceTimeout(deltaMilliseconds: number): void {
    if (this.guidanceHideAfterMilliseconds <= 0) return;
    this.guidanceHideAfterMilliseconds -= Math.max(0, deltaMilliseconds);
    if (this.guidanceHideAfterMilliseconds <= 0) {
      this.routeGuidance.reset();
      this.routeGuidance.setVisible(false);
    }
  }

  handleAcceptedRoute(
    result: Extract<RouteAssignmentResult, { accepted: true }>,
  ): void {
    if (!result.destinationZoneId) {
      this.routeGuidance.setVisible(false);
      this.announce("Route added");
      return;
    }

    const zone = this.zoneById(result.destinationZoneId);
    if (!zone) return;
    this.showGuidance(zone, "confirmed");
    this.guidanceHideAfterMilliseconds = GUIDANCE_CONFIRMATION_DURATION;
    this.emitRouteCoach("set");
    this.emitFeedback({
      type: "route-connected",
      aircraftId: result.aircraftId,
      zoneId: result.destinationZoneId,
    });
    this.announce(`Route added to ${this.zoneName(zone).toLowerCase()}`);
  }

  handleRejectedRoute(
    result: Extract<RouteAssignmentResult, { accepted: false }>,
    endpoint: Vector2 | undefined,
    aircraft: Aircraft,
  ): void {
    const zone = result.destinationZoneId
      ? this.zoneById(result.destinationZoneId)
      : undefined;

    if (zone) {
      this.showGuidance(zone, "invalid");
    } else if (endpoint) {
      this.routeGuidance.setTarget({
        x: endpoint.x,
        y: endpoint.y,
        captureRadius: 22,
        color: AIRCRAFT_STYLE[aircraft.type].color,
      });
      this.routeGuidance.setVisible(true);
      this.routeGuidance.setState("invalid");
    }

    this.guidanceHideAfterMilliseconds = GUIDANCE_REJECTION_DURATION;
    const message =
      result.reason === "route-too-short" ||
      result.reason === "insufficient-points"
        ? "Route not added: draw a longer path"
        : result.reason === "wrong-destination"
          ? "Route not added: use the matching landing zone"
          : "Route not added";
    this.announce(message);
  }

  private emitRouteCoach(stage: "selected" | "locked" | "set"): void {
    if (stage === "selected") {
      if (this.routeCoachSelectedEmitted) return;
      this.routeCoachSelectedEmitted = true;
    } else if (stage === "locked") {
      if (this.routeCoachLockedEmitted) return;
      this.routeCoachLockedEmitted = true;
    } else {
      if (this.routeCoachSetEmitted) return;
      this.routeCoachSetEmitted = true;
    }
    this.emit("route-coach", stage);
  }

  /**
   * Strokes a route in a few bands along its length, each a little fainter than the last, from
   * `from` opacity at the start to `to` at the end. Bands rather than single segments keep the
   * joins between strokes few, so the overlaps never show.
   */
}

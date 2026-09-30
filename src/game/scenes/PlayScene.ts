import { applyDifficulty, type DifficultyId } from '../../core/difficulty';
import { ShiftTracker } from '../../progression/achievements';
import {
  aircraftWarningDistance,
  aircraftCollisionOutline,
  DEFAULT_COLLISION_SCALES,
  type AircraftCollisionScales,
} from "../../core/aircraftCollision";
import { aircraftPresentationScale } from "../rendering/aircraft/visualTokens";
import { ROUTE_OUTLINE_COLOR } from "../palette";
import Phaser from "phaser";
import { Simulation } from "../../core/Simulation";
import { clamp, distance } from "../../core/geometry";
import {
  resolveLandingTarget,
  type LandingTargetingResult,
  type PointerPrecision,
} from "../../core/landingTargeting";
import {
  type Aircraft,
  type LandingZone,
  type RouteAssignmentResult,
  type SimulationSnapshot,
  type Vector2,
} from "../../core/types";
import type { FeedbackEvent } from "../../app/feedbackEvents";
import { AIRCRAFT_STYLE } from "../content";
import { queuePresentationAssets } from "../assets/presentationAssets";
import { SALTMARSH_GATEWAY_DEFINITION } from "../maps/saltmarsh-gateway";
import { trafficProfileById } from "../maps/trafficProfiles";
import type {
  MapDefinition,
  PlayableMapLayout,
  PreparedMap,
} from "../maps/types";
import {
  createAircraftView,
  type AircraftView,
} from "../rendering/AircraftView";
import {
  RouteGuidanceRenderer,
  type RouteGuidanceTarget,
} from "../rendering/RouteGuidanceRenderer";
import { profileForViewport } from "../viewport";
import { aircraftSelectionRadius } from "../../core/aircraftSelection";

const GUIDANCE_REJECTION_DURATION = 380;
const GUIDANCE_CONFIRMATION_DURATION = 400;
const GUIDANCE_LANDING_DURATION = 860;

export class PlayScene extends Phaser.Scene {
  private simulation!: Simulation;
  private preparedMap!: PreparedMap;
  private layout!: PlayableMapLayout;
  private collisionScales: AircraftCollisionScales = DEFAULT_COLLISION_SCALES;
  private failureMarker?: Phaser.GameObjects.Graphics;
  private routeGraphics!: Phaser.GameObjects.Graphics;
  private warningGraphics!: Phaser.GameObjects.Graphics;
  private approachWarningLabels = new Map<number, Phaser.GameObjects.Text>();
  private previewGraphics!: Phaser.GameObjects.Graphics;
  private routeGuidance!: RouteGuidanceRenderer;
  private aircraftViews = new Map<number, AircraftView>();
  private drawingAircraftId?: number;
  private drawingPointerId?: number;
  private pointerPrecision: PointerPrecision = "mouse";
  private drawnPoints: Vector2[] = [];
  private landingTarget: LandingTargetingResult = { status: "neutral" };
  private lastHudSecond = -1;
  private reducedMotion = false;
  private guidanceHideAfterMilliseconds = 0;
  private motionPreference?: MediaQueryList;
  private routeCoachSelectedEmitted = false;
  private routeCoachLockedEmitted = false;
  private routeCoachSetEmitted = false;

  private readonly handleMotionPreference = (
    event: MediaQueryListEvent,
  ): void => {
    this.reducedMotion = event.matches;
    this.routeGuidance?.setReducedMotion(this.reducedMotion);
    for (const view of this.aircraftViews.values()) {
      view.setReducedMotion(this.reducedMotion);
    }
  };

  constructor(
    private readonly mapDefinition: MapDefinition = SALTMARSH_GATEWAY_DEFINITION,
    private readonly twoEndLanding = false,
  ) {
    super("play");
  }

  preload(): void {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    const detailLevel = profileForViewport().detailLevel;
    const preview = this.mapDefinition.prepare({ width, height, detailLevel, twoEndLanding: this.twoEndLanding });
    queuePresentationAssets(this, {
      mapId: this.mapDefinition.id,
      variant: preview.layout.variant,
    });
  }

  create(): void {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    const detailLevel = profileForViewport().detailLevel;
    this.preparedMap = this.mapDefinition.prepare({
      width,
      height,
      detailLevel,
      twoEndLanding: this.twoEndLanding,
    });
    this.layout = this.preparedMap.layout;
    const canvas = this.game.canvas;
    const rendered = {
      width: canvas.clientWidth || canvas.width,
      height: canvas.clientHeight || canvas.height,
    };
    this.collisionScales = {
      liner: aircraftPresentationScale("liner", rendered, { width, height }),
      commuter: aircraftPresentationScale("commuter", rendered, {
        width,
        height,
      }),
      rotor: aircraftPresentationScale("rotor", rendered, { width, height }),
    };
    this.simulation = new Simulation(
      this.layout.landingZones,
      { width, height },
      trafficProfileById(this.mapDefinition.trafficProfileId),
      this.collisionScales,
    );
    this.cameras.main.setBounds(0, 0, width, height);
    this.cameras.main.setBackgroundColor("#263e38");
    this.mapDefinition.render(this, this.preparedMap);
    this.approachLabels = this.layout.landingZones.map(zone => this.add.text(
      zone.position.x, zone.position.y + zone.captureRadius + 8,
      zone.approach ? `${zone.accepts === 'liner' ? 'L' : 'C'} · ${zone.label}` : zone.label,
      { fontFamily: 'Atkinson Hyperlegible', fontSize: '20px', color: '#fff5df', backgroundColor: '#203d39', padding: { x: 4, y: 2 } }
    ).setOrigin(.5,0).setDepth(7).setVisible(false));

    this.routeGraphics = this.add.graphics().setDepth(4);
    this.warningGraphics = this.add.graphics().setDepth(6);
    this.previewGraphics = this.add.graphics().setDepth(8);

    this.motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    this.reducedMotion = this.motionPreference.matches;
    this.motionPreference.addEventListener(
      "change",
      this.handleMotionPreference,
    );

    const helipad =
      this.layout.landingZones.find((zone) => zone.accepts === "rotor") ??
      this.layout.landingZones[0];
    this.routeGuidance = new RouteGuidanceRenderer(
      this,
      this.guidanceTarget(helipad),
      { depth: 5, reducedMotion: this.reducedMotion },
    );
    this.routeGuidance.setVisible(false);

    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("pointerupoutside", this.handlePointerUp, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.motionPreference?.removeEventListener(
        "change",
        this.handleMotionPreference,
      );
      this.input.off("pointerdown", this.handlePointerDown, this);
      this.input.off("pointermove", this.handlePointerMove, this);
      this.input.off("pointerup", this.handlePointerUp, this);
      this.input.off("pointerupoutside", this.handlePointerUp, this);
    });

    this.game.events.emit("scene-ready", {
      width,
      height,
      mapId: this.mapDefinition.id,
      variant: this.layout.variant,
      hudExclusionZones: this.layout.hudExclusionZones,
    });
  }

  update(_time: number, deltaMilliseconds: number): void {
    this.simulation.update(deltaMilliseconds / 1000);
    const snapshot = this.simulation.snapshot();

    this.syncAircraft(snapshot, deltaMilliseconds);
    this.routeGuidance.update(deltaMilliseconds);
    this.updateGuidanceTimeout(deltaMilliseconds);
    this.drawRoutes(snapshot);
    this.drawWarnings(snapshot);
    this.drawPreview();
    this.processEvents();

    const currentSecond = Math.floor(snapshot.elapsed);
    if (currentSecond !== this.lastHudSecond || snapshot.phase === "over") {
      this.lastHudSecond = currentSecond;
      this.game.events.emit("hud-update", snapshot);
    }
  }

  private approachLabels: Phaser.GameObjects.Text[] = [];
  private shiftTracker = new ShiftTracker();
  private runId = '';
  startRun(difficulty: DifficultyId = 'medium', runId = ''): void {
    this.runId = runId;
    this.shiftTracker = new ShiftTracker();
    this.simulation = new Simulation(this.layout.landingZones, { width: this.scale.gameSize.width, height: this.scale.gameSize.height }, applyDifficulty(trafficProfileById(this.mapDefinition.trafficProfileId), difficulty), this.collisionScales);
    this.failureMarker?.destroy();
    this.failureMarker = undefined;
    this.clearAircraftViews();
    this.simulation.start(Date.now());
    this.lastHudSecond = -1;
    this.finishDrawing();
    this.routeGuidance.reset();
    this.routeGuidance.setVisible(false);
    this.guidanceHideAfterMilliseconds = 0;
    this.game.events.emit("run-state", "running");
  }

  pauseRun(): void {
    this.simulation.pause();
    this.cancelDrawing();
    this.game.events.emit("run-state", "paused");
  }

  resumeRun(): void {
    this.simulation.resume();
    this.game.events.emit("run-state", "running");
  }

  /** Detached diagnostics for development browser regression checks. */
  getShiftSnapshot() {
    return structuredClone({ twoEndLanding: this.twoEndLanding, runId: this.runId, simulation: this.simulation.snapshot(), landingZones: this.layout.landingZones, evidence: this.shiftTracker.evidence });
  }

  getPhase(): SimulationSnapshot["phase"] {
    return this.simulation.snapshot().phase;
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (
      this.simulation.snapshot().phase !== "running" ||
      this.drawingAircraftId !== undefined
    ) {
      return;
    }

    const point = this.pointerPoint(pointer);
    const precision = this.precisionFor(pointer);
    let nearest: Aircraft | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const aircraft of this.simulation.snapshot().aircraft) {
      if (aircraft.state === "landing") continue;
      const candidateDistance = distance(point, aircraft.position);
      const hitRadius = aircraftSelectionRadius(
        aircraft.type,
        this.collisionScales[aircraft.type],
        Math.min(this.game.canvas.clientWidth / this.scale.gameSize.width,
          this.game.canvas.clientHeight / this.scale.gameSize.height),
        precision === "coarse",
      );
      if (
        candidateDistance <= hitRadius &&
        candidateDistance < nearestDistance
      ) {
        nearest = aircraft;
        nearestDistance = candidateDistance;
      }
    }

    if (!nearest) return;

    this.drawingAircraftId = nearest.id;
    this.drawingPointerId = pointer.id;
    this.pointerPrecision = precision;
    this.drawnPoints = [{ ...nearest.position }, point];
    this.landingTarget = { status: "neutral" };
    this.aircraftViews.get(nearest.id)?.setSelected(true);

    const destination = this.compatibleZone(nearest);
    if (destination) {
      this.showGuidance(destination, "compatible");
      this.emitRouteCoach("selected");
      this.announce(`${this.zoneName(destination)} ready`);
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (
      this.drawingAircraftId === undefined ||
      pointer.id !== this.drawingPointerId ||
      !pointer.isDown
    ) {
      return;
    }

    const aircraft = this.drawingAircraft();
    if (!aircraft) {
      this.cancelDrawing();
      return;
    }

    this.recordPointerPoint(pointer, aircraft);
    this.evaluateLandingTarget(aircraft);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (
      this.drawingAircraftId === undefined ||
      pointer.id !== this.drawingPointerId
    ) {
      return;
    }

    const aircraft = this.drawingAircraft();
    if (!aircraft) {
      this.cancelDrawing();
      return;
    }

    this.recordPointerPoint(pointer, aircraft);
    this.evaluateLandingTarget(aircraft);

    const targeting = this.landingTarget;
    const destinationZoneId =
      targeting.status === "locked" || targeting.status === "invalid"
        ? targeting.zoneId
        : undefined;
    const routePoints = this.previewRoutePoints();
    const result = this.simulation.assignRoute(
      aircraft.id,
      routePoints,
      destinationZoneId,
    );

    this.aircraftViews.get(aircraft.id)?.setSelected(false);
    this.finishDrawing();

    if (result.accepted) {
      this.handleAcceptedRoute(result);
    } else {
      this.handleRejectedRoute(
        result,
        routePoints[routePoints.length - 1],
        aircraft,
      );
    }
  }

  private recordPointerPoint(
    pointer: Phaser.Input.Pointer,
    aircraft: Aircraft,
  ): void {
    const point = this.pointerPoint(pointer);
    const previous = this.drawnPoints[this.drawnPoints.length - 1];
    const sampleDistance = clamp(aircraft.collisionRadius * 0.35, 5, 8);

    if (!previous || distance(previous, point) >= sampleDistance) {
      this.drawnPoints.push(point);
    } else {
      this.drawnPoints[this.drawnPoints.length - 1] = point;
    }
  }

  private evaluateLandingTarget(aircraft: Aircraft): void {
    const previous = this.landingTarget;
    const result = resolveLandingTarget({
      aircraftType: aircraft.type,
      aircraftCollisionRadius: aircraft.collisionRadius,
      points: this.drawnPoints,
      zones: this.layout.landingZones,
      pointerPrecision: this.pointerPrecision,
      retainedZoneId:
        previous.status === "locked" ? previous.zoneId : undefined,
    });

    this.landingTarget = result;
    const previousKey = this.targetingKey(previous);
    const nextKey = this.targetingKey(result);
    if (previousKey === nextKey) return;

    if (result.status === "locked") {
      const zone = this.zoneById(result.zoneId);
      if (zone) {
        this.showGuidance(zone, "locked");
        this.emitRouteCoach("locked");
        this.announce(`Route locked to ${this.zoneName(zone).toLowerCase()}`);
      }
      return;
    }

    if (result.status === "invalid") {
      const zone = this.zoneById(result.zoneId);
      if (zone) {
        this.showGuidance(zone, "invalid");
        this.announce(`Wrong destination: ${this.zoneName(zone)}`);
      }
      return;
    }

    const compatible = this.compatibleZone(aircraft);
    if (compatible) this.showGuidance(compatible, "compatible");
  }

  private handleAcceptedRoute(
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

  private handleRejectedRoute(
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

  cancelDrawing(): void {
    const hadDrawing = this.drawingAircraftId !== undefined;
    if (hadDrawing) {
      this.aircraftViews.get(this.drawingAircraftId!)?.setSelected(false);
    }
    this.finishDrawing();
    this.routeGuidance.reset();
    this.routeGuidance.setVisible(false);
    this.guidanceHideAfterMilliseconds = 0;
  }

  private finishDrawing(): void {
    this.drawingAircraftId = undefined;
    this.drawingPointerId = undefined;
    this.drawnPoints = [];
    this.landingTarget = { status: "neutral" };
    this.previewGraphics?.clear();
  }

  private syncAircraft(
    snapshot: SimulationSnapshot,
    deltaMilliseconds: number,
  ): void {
    const activeIds = new Set(snapshot.aircraft.map((aircraft) => aircraft.id));

    for (const [id, view] of this.aircraftViews) {
      if (!activeIds.has(id)) {
        view.destroy();
        this.aircraftViews.delete(id);
      }
    }

    for (const aircraft of snapshot.aircraft) {
      let view = this.aircraftViews.get(aircraft.id);
      if (!view) {
        view = createAircraftView(this, aircraft, {
          presentationScale: this.collisionScales[aircraft.type],
          reducedMotion: this.reducedMotion,
        });
        this.aircraftViews.set(aircraft.id, view);
      }

      view.sync(
        aircraft,
        deltaMilliseconds,
        snapshot.phase === "running",
        this.reducedMotion,
      );
    }
  }

  private drawRoutes(snapshot: SimulationSnapshot): void {
    this.routeGraphics.clear();
    const drawing = this.drawingAircraft();
    this.layout.landingZones.forEach((zone, index) => {
      const visible = !!drawing && drawing.type === zone.accepts;
      this.approachLabels[index]?.setVisible(visible);
      const occupied = zone.approach && snapshot.runwayReservations?.some(r => r.runwayId === zone.approach!.runwayId && r.aircraftId !== drawing?.id);
      this.approachLabels[index]?.setText(zone.approach ? `${zone.accepts === 'liner' ? 'L' : 'C'} · ${zone.label}${occupied ? ' · BUSY' : ''}` : zone.label);
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
      if (!aircraft.route || aircraft.state === "landing") continue;
      const style = AIRCRAFT_STYLE[aircraft.type];
      const remaining = aircraft.route.points.slice(
        Math.max(0, aircraft.route.segmentIndex - 1),
      );
      if (remaining.length < 2) continue;

      this.routeGraphics.lineStyle(7, ROUTE_OUTLINE_COLOR, 1);
      this.strokePolyline(this.routeGraphics, [
        { ...aircraft.position },
        ...remaining,
      ]);
      this.routeGraphics.lineStyle(2.8, style.color, 0.96);
      this.strokePolyline(this.routeGraphics, [
        { ...aircraft.position },
        ...remaining,
      ]);

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

    this.previewGraphics.lineStyle(8, 0x0c1716, 0.5);
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
    const warnedAircraft = new Set<number>();
    for (const warning of snapshot.approachWarnings ?? []) {
      const plane = snapshot.aircraft.find(p => p.id === warning.aircraftId);
      if (!plane || plane.state === 'landing') continue;
      warnedAircraft.add(plane.id);
      let label = this.approachWarningLabels.get(plane.id);
      if (!label) {
        label = this.add.text(0, 0, '', {
          fontFamily: 'Atkinson Hyperlegible',
          fontSize: '18px',
          color: '#36270f',
          backgroundColor: '#f3bd55',
          padding: { x: 7, y: 4 },
        }).setOrigin(0.5, 1).setDepth(9);
        this.approachWarningLabels.set(plane.id, label);
      }
      label.setText('! Runway busy');
      const halfWidth = label.width / 2;
      label.setPosition(
        Phaser.Math.Clamp(plane.position.x, halfWidth + 4, this.layout.width - halfWidth - 4),
        Phaser.Math.Clamp(plane.position.y - 44, label.height + 4, this.layout.height - 4),
      );
    }
    for (const [id, label] of this.approachWarningLabels) {
      if (warnedAircraft.has(id)) continue;
      label.destroy();
      this.approachWarningLabels.delete(id);
    }
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

  private processEvents(): void {
    for (const event of this.simulation.drainEvents()) {
      this.shiftTracker.accept(event);
      if (event.type === 'approach-warning') {
        const zone = this.zoneById(event.zoneId);
        const message = 'Runway busy — reroute aircraft';
        this.announce(`${zone ? this.zoneName(zone) + ': ' : ''}${message}`);
        this.game.events.emit('flight-message', `${zone ? this.zoneName(zone) + ': ' : ''}${message}`);
      } else if (event.type === "landing-started") {
        const zone = this.zoneById(event.zoneId);
        if (zone) {
          this.showGuidance(zone, "landing-started");
          this.guidanceHideAfterMilliseconds = GUIDANCE_LANDING_DURATION;
          this.announce(`${this.zoneName(zone)} capture confirmed`);
        }
      } else if (event.type === "landed") {
        this.game.events.emit("landing", event.score);
        this.emitFeedback({
          type: "landing-completed",
          aircraftId: event.aircraftId,
          score: event.score,
        });
      } else if (event.type === "warning") {
        this.game.events.emit("traffic-warning");
      } else if (event.type === "gameover") {
        this.cancelDrawing();
        if (!this.reducedMotion) this.cameras.main.flash(180, 241, 114, 107);
        if (event.reason === "collision") {
          this.emitFeedback({
            type: "collision",
            aircraftIds: event.aircraftIds,
          });
        }
        const snapshot = this.simulation.snapshot();
        this.failureMarker = this.add.graphics().setDepth(12);
        if (event.reason === "collision") {
          for (const plane of snapshot.aircraft.filter((plane) =>
            event.aircraftIds?.includes(plane.id),
          )) {
            const outline = aircraftCollisionOutline(
              plane,
              this.collisionScales[plane.type],
            );
            this.failureMarker.lineStyle(3, 0xfff5df, 1);
            this.failureMarker.beginPath();
            this.failureMarker.moveTo(outline[0].x,outline[0].y);
            for(const point of outline.slice(1)) this.failureMarker.lineTo(point.x,point.y);
            this.failureMarker.closePath();
            this.failureMarker.strokePath();
          }
        }
        const points = event.exitPosition ? [event.exitPosition] : [];
        for (const point of points) {
          const x = Math.max(25, Math.min(this.layout.width - 25, point.x));
          const y = Math.max(25, Math.min(this.layout.height - 25, point.y));
          this.failureMarker.lineStyle(6, 0xfff5df, 1);
          this.failureMarker.strokeCircle(x, y, 40);
          this.failureMarker.lineStyle(4, 0xc95236, 1);
          this.failureMarker.strokeCircle(x, y, 34);
        }
        const runId = this.runId;
        const evidence = structuredClone(this.shiftTracker.evidence);
        this.time.delayedCall(this.reducedMotion ? 0 : 650, () =>
          this.game.events.emit("game-over", {
            reason: event.reason,
            score: snapshot.score,
            runId,
            evidence,
          }),
        );
        this.game.events.emit("run-state", "over");
      }
    }
  }

  private updateGuidanceTimeout(deltaMilliseconds: number): void {
    if (this.guidanceHideAfterMilliseconds <= 0) return;
    this.guidanceHideAfterMilliseconds -= Math.max(0, deltaMilliseconds);
    if (this.guidanceHideAfterMilliseconds <= 0) {
      this.routeGuidance.reset();
      this.routeGuidance.setVisible(false);
    }
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

  private compatibleZone(aircraft: Aircraft): LandingZone | undefined {
    return this.layout.landingZones.find(
      (zone) => zone.accepts === aircraft.type,
    );
  }

  private zoneById(zoneId: string): LandingZone | undefined {
    return this.layout.landingZones.find((zone) => zone.id === zoneId);
  }

  private zoneName(zone: LandingZone): string {
    return zone.accepts === "rotor" ? `Helipad ${zone.label}` : `Runway ${zone.label}`;
  }

  private drawingAircraft(): Aircraft | undefined {
    if (this.drawingAircraftId === undefined) return undefined;
    return this.simulation
      .snapshot()
      .aircraft.find((aircraft) => aircraft.id === this.drawingAircraftId);
  }

  private precisionFor(pointer: Phaser.Input.Pointer): PointerPrecision {
    const event = pointer.event;
    const isTouchEvent = event && "touches" in event;
    return isTouchEvent || window.matchMedia("(pointer: coarse)").matches
      ? "coarse"
      : "mouse";
  }

  private pointerPoint(pointer: Phaser.Input.Pointer): Vector2 {
    return { x: pointer.worldX, y: pointer.worldY };
  }

  private targetingKey(targeting: LandingTargetingResult): string {
    return targeting.status === "neutral"
      ? "neutral"
      : `${targeting.status}:${targeting.zoneId}`;
  }

  private announce(message: string): void {
    this.game.events.emit("route-status", message);
  }

  private emitFeedback(event: FeedbackEvent): void {
    this.game.events.emit("feedback", event);
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
    this.game.events.emit("route-coach", stage);
  }

  private strokePolyline(
    graphics: Phaser.GameObjects.Graphics,
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

  private clearAircraftViews(): void {
    for (const view of this.aircraftViews.values()) view.destroy();
    this.aircraftViews.clear();
    for (const label of this.approachWarningLabels.values()) label.destroy();
    this.approachWarningLabels.clear();
  }
}

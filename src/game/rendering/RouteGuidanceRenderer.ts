import Phaser from 'phaser';
import {
  createGuidanceGeometry,
  type GuidanceGeometry,
  type RouteGuidanceTargetKind
} from './guidanceGeometry';

export type RouteGuidanceState =
  | 'neutral'
  | 'compatible'
  | 'locked'
  | 'invalid'
  | 'confirmed'
  | 'landing-started';

export type RouteGuidanceRestingState = Exclude<
  RouteGuidanceState,
  'confirmed' | 'landing-started'
>;

export interface RouteGuidanceTarget {
  x: number;
  y: number;
  captureRadius: number;
  color: number;
  /** Defaults to `pad` until the integration supplies runway metadata. */
  kind?: RouteGuidanceTargetKind;
  /** Runway centerline heading, pointing from the active threshold inward. */
  angle?: number;
  runwayLength?: number;
  runwayWidth?: number;
}

export interface RouteGuidanceRendererOptions {
  depth?: number;
  reducedMotion?: boolean;
}

const CONFIRMED_DURATION_MS = 360;
const LANDING_PULSE_DURATION_MS = 820;
const INVALID_COLOR = 0xf3a08d;
const SURFACE_COLOR = 0x102923;
const RUNWAY_LIGHT_COUNT = 6;

/**
 * Draws route-to-destination feedback with one retained Graphics object.
 * PlayScene owns state selection; this renderer owns visual grammar and the two
 * short, bounded acknowledgements that need time-based progression.
 */
export class RouteGuidanceRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private state: RouteGuidanceState = 'neutral';
  private restingState: RouteGuidanceRestingState = 'neutral';
  private elapsedMilliseconds = 0;
  private reducedMotion: boolean;
  private visible = true;
  private geometry: GuidanceGeometry;
  private color: number;

  constructor(
    scene: Phaser.Scene,
    target: RouteGuidanceTarget,
    options: RouteGuidanceRendererOptions = {}
  ) {
    this.geometry = createGuidanceGeometry(target);
    this.color = target.color;
    this.reducedMotion = options.reducedMotion ?? false;
    this.graphics = scene.add.graphics().setDepth(options.depth ?? 5);
    this.render();
  }

  getState(): RouteGuidanceState {
    return this.state;
  }

  setTarget(target: RouteGuidanceTarget): void {
    this.geometry = createGuidanceGeometry(target);
    this.color = target.color;
    this.render();
  }

  setReducedMotion(reducedMotion: boolean): void {
    if (this.reducedMotion === reducedMotion) return;
    this.reducedMotion = reducedMotion;
    this.render();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.graphics.setVisible(visible);
  }

  /**
   * Transient acknowledgements always clear to neutral. `returnTo` remains in
   * the public signature for compatibility with existing PlayScene calls, but
   * confirmed and landing-started can never leave target guidance lingering.
   */
  setState(
    state: RouteGuidanceState,
    returnTo: RouteGuidanceRestingState = 'neutral'
  ): void {
    if (this.state === state && state !== 'confirmed' && state !== 'landing-started') return;
    this.state = state;
    this.restingState = state === 'confirmed' || state === 'landing-started'
      ? 'neutral'
      : returnTo;
    this.elapsedMilliseconds = 0;
    this.render();
  }

  reset(): void {
    this.setState('neutral');
  }

  /** Call once per scene update. It is a no-op for persistent states. */
  update(deltaMilliseconds: number): void {
    if (this.state !== 'confirmed' && this.state !== 'landing-started') return;

    this.elapsedMilliseconds += Math.max(0, deltaMilliseconds);
    const duration = this.state === 'confirmed'
      ? CONFIRMED_DURATION_MS
      : LANDING_PULSE_DURATION_MS;

    if (this.elapsedMilliseconds >= duration) {
      this.state = this.restingState;
      this.elapsedMilliseconds = 0;
    }
    this.render();
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private render(): void {
    this.graphics.clear();
    this.graphics.setVisible(this.visible);
    if (!this.visible || this.state === 'neutral') return;

    switch (this.state) {
      case 'compatible':
        this.drawCompatible();
        return;
      case 'locked':
        this.drawLocked();
        return;
      case 'invalid':
        this.drawInvalid();
        return;
      case 'confirmed':
        this.drawConfirmed();
        return;
      case 'landing-started':
        this.drawLandingStarted();
        return;
    }
  }

  private drawCompatible(): void {
    const { x, y, captureRadius, kind } = this.geometry;
    this.graphics.fillStyle(this.color, 0.022);
    this.graphics.fillCircle(x, y, captureRadius);
    this.graphics.lineStyle(2, this.color, 0.52);
    this.graphics.strokeCircle(x, y, captureRadius);

    if (kind === 'runway') {
      this.drawApproachRails(0.56, false);
      this.drawRunwayClamp(0.46, 1.04, false);
    } else {
      this.drawPadTicks(captureRadius + 3, captureRadius + 10, 0.72, 2.5);
    }
  }

  private drawLocked(): void {
    const { x, y, captureRadius, kind } = this.geometry;
    const lineWidth = Math.max(2.5, Math.min(4, captureRadius * 0.075));
    this.graphics.fillStyle(this.color, 0.055);
    this.graphics.fillCircle(x, y, captureRadius);
    this.graphics.lineStyle(lineWidth, this.color, 0.98);
    this.graphics.strokeCircle(x, y, captureRadius);

    if (kind === 'runway') {
      this.drawApproachRails(0.94, true);
      this.drawRunwayClamp(0.98, 1, true);
    } else {
      this.drawPadTicks(
        Math.max(6, captureRadius - 12),
        Math.max(10, captureRadius - 3),
        0.96,
        lineWidth
      );
      this.drawEndpointAnchor(1);
    }
  }

  private drawInvalid(): void {
    // Four separated corners communicate a missed acquisition without adding
    // another icon over the runway number or helipad marking.
    this.drawCornerBrackets(
      this.geometry.captureRadius * 0.76,
      Math.max(8, this.geometry.captureRadius * 0.22),
      INVALID_COLOR,
      0.9
    );
  }

  private drawApproachRails(alpha: number, locked: boolean): void {
    const {
      x,
      y,
      captureRadius,
      outwardX,
      outwardY,
      normalX,
      normalY,
      approachLength,
      approachNearHalfWidth,
      approachFarHalfWidth
    } = this.geometry;
    const nearAlong = captureRadius * 0.82;
    const nearX = x + outwardX * nearAlong;
    const nearY = y + outwardY * nearAlong;
    const farX = x + outwardX * approachLength;
    const farY = y + outwardY * approachLength;

    this.graphics.lineStyle(locked ? 3 : 2.25, this.color, alpha);
    for (let side = -1; side <= 1; side += 2) {
      this.graphics.lineBetween(
        nearX + normalX * approachNearHalfWidth * side,
        nearY + normalY * approachNearHalfWidth * side,
        farX + normalX * approachFarHalfWidth * side,
        farY + normalY * approachFarHalfWidth * side
      );
    }

    this.graphics.lineStyle(locked ? 2.4 : 1.8, this.color, alpha * 0.68);
    const gateCount = locked ? 3 : 2;
    for (let index = 1; index <= gateCount; index += 1) {
      const ratio = index / (gateCount + 1);
      const along = nearAlong + (approachLength - nearAlong) * ratio;
      const halfWidth = approachNearHalfWidth +
        (approachFarHalfWidth - approachNearHalfWidth) * ratio;
      const centerX = x + outwardX * along;
      const centerY = y + outwardY * along;
      this.graphics.lineBetween(
        centerX - normalX * halfWidth,
        centerY - normalY * halfWidth,
        centerX + normalX * halfWidth,
        centerY + normalY * halfWidth
      );
    }
  }

  private drawRunwayClamp(alpha: number, scale: number, filled: boolean): void {
    const {
      x,
      y,
      captureRadius,
      inwardX,
      inwardY,
      normalX,
      normalY,
      runwayHalfWidth
    } = this.geometry;
    const along = captureRadius * 0.42 * scale;
    const halfWidth = runwayHalfWidth * 0.78 * scale;
    const arm = captureRadius * 0.18 * scale;
    const lineWidth = Math.max(2.5, Math.min(4.2, captureRadius * 0.08));
    this.graphics.lineStyle(lineWidth, this.color, alpha);

    for (let side = -1; side <= 1; side += 2) {
      const centerX = x + inwardX * along * side;
      const centerY = y + inwardY * along * side;
      const firstX = centerX - normalX * halfWidth;
      const firstY = centerY - normalY * halfWidth;
      const secondX = centerX + normalX * halfWidth;
      const secondY = centerY + normalY * halfWidth;
      this.graphics.lineBetween(firstX, firstY, secondX, secondY);
      this.graphics.lineBetween(
        firstX,
        firstY,
        firstX - inwardX * arm * side,
        firstY - inwardY * arm * side
      );
      this.graphics.lineBetween(
        secondX,
        secondY,
        secondX - inwardX * arm * side,
        secondY - inwardY * arm * side
      );
    }

    if (filled) {
      this.graphics.fillStyle(this.color, 0.08 * alpha);
      this.graphics.fillCircle(x, y, captureRadius * 0.4 * scale);
    }
  }

  private drawTerminalChevrons(alpha: number, progress: number): void {
    const {
      x,
      y,
      captureRadius,
      inwardX,
      inwardY,
      normalX,
      normalY
    } = this.geometry;
    const distance = captureRadius * (1.08 - progress * 0.34);
    const arm = captureRadius * 0.23;
    const pointInset = captureRadius * 0.2;
    this.graphics.lineStyle(3, this.color, alpha * 0.92);

    for (let side = -1; side <= 1; side += 2) {
      const baseX = x + inwardX * distance * side;
      const baseY = y + inwardY * distance * side;
      const pointX = baseX - inwardX * pointInset * side;
      const pointY = baseY - inwardY * pointInset * side;
      this.graphics.lineBetween(
        baseX + normalX * arm,
        baseY + normalY * arm,
        pointX,
        pointY
      );
      this.graphics.lineBetween(
        baseX - normalX * arm,
        baseY - normalY * arm,
        pointX,
        pointY
      );
    }
  }

  private drawConfirmed(): void {
    const progress = Math.min(1, this.elapsedMilliseconds / CONFIRMED_DURATION_MS);
    const eased = 1 - Math.pow(1 - progress, 3);
    const alpha = Math.max(0, 1 - progress);
    const scale = this.reducedMotion ? 1 : 1.18 - eased * 0.18;

    if (this.geometry.kind === 'runway') {
      this.drawRunwayClamp(alpha, scale, true);
      this.drawTerminalChevrons(alpha, this.reducedMotion ? 1 : eased);
    } else {
      this.drawPadConfirmation(alpha, scale);
    }
    this.drawEndpointAnchor(alpha, this.reducedMotion ? 1 : 1.12 - eased * 0.12);
  }

  private drawLandingStarted(): void {
    const progress = Math.min(1, this.elapsedMilliseconds / LANDING_PULSE_DURATION_MS);
    if (this.geometry.kind === 'runway') {
      this.drawRunwayLightSweep(progress);
    } else {
      this.drawPadBloom(progress);
    }
  }

  private drawEndpointAnchor(alpha: number, scale = 1): void {
    const { x, y } = this.geometry;
    this.graphics.fillStyle(this.color, 0.96 * alpha);
    this.graphics.fillCircle(x, y, 6 * scale);
    this.graphics.fillStyle(SURFACE_COLOR, 0.92 * alpha);
    this.graphics.fillCircle(x, y, 2.5 * scale);
  }

  private drawPadTicks(
    innerRadius: number,
    outerRadius: number,
    alpha: number,
    lineWidth: number
  ): void {
    const { x, y } = this.geometry;
    this.graphics.lineStyle(lineWidth, this.color, alpha);
    for (let index = 0; index < 4; index += 1) {
      const angle = index * Math.PI * 0.5;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      this.graphics.lineBetween(
        x + cosine * innerRadius,
        y + sine * innerRadius,
        x + cosine * outerRadius,
        y + sine * outerRadius
      );
    }
  }

  private drawPadConfirmation(alpha: number, scale: number): void {
    const { captureRadius } = this.geometry;
    const outer = captureRadius * 0.88 * scale;
    const inner = outer - captureRadius * 0.24;
    this.drawPadTicks(inner, outer, alpha, 3.5);
    this.drawCornerBrackets(
      captureRadius * 0.58 * scale,
      captureRadius * 0.18,
      this.color,
      alpha * 0.86
    );
  }

  private drawRunwayLightSweep(progress: number): void {
    const {
      x,
      y,
      captureRadius,
      outwardX,
      outwardY,
      normalX,
      normalY,
      approachLength,
      runwayHalfWidth
    } = this.geometry;
    const baseAlpha = Math.max(0, 0.72 - progress * 0.38);
    const dotRadius = Math.max(2.6, Math.min(4.2, captureRadius * 0.085));

    for (let index = 0; index < RUNWAY_LIGHT_COUNT; index += 1) {
      const ratio = index / (RUNWAY_LIGHT_COUNT - 1);
      const along = captureRadius * 0.34 +
        (approachLength * 0.88 - captureRadius * 0.34) * ratio;
      const centerX = x + outwardX * along;
      const centerY = y + outwardY * along;
      const phase = 1 - ratio;
      const waveAlpha = this.reducedMotion
        ? baseAlpha
        : Math.max(0.12, 1 - Math.abs(progress * 1.18 - phase) * 3.4) * baseAlpha;

      this.graphics.fillStyle(this.color, waveAlpha);
      for (let side = -1; side <= 1; side += 2) {
        this.graphics.fillCircle(
          centerX + normalX * runwayHalfWidth * side,
          centerY + normalY * runwayHalfWidth * side,
          dotRadius
        );
      }
    }

    const arrival = this.reducedMotion ? 0.74 : Math.max(0, (progress - 0.48) / 0.52);
    this.drawRunwayClamp(0.86 * arrival, 1, false);
    this.drawEndpointAnchor(Math.max(0.22, arrival), 1 + arrival * 0.12);
  }

  private drawPadBloom(progress: number): void {
    const { x, y, captureRadius } = this.geometry;
    const alpha = Math.max(0, 0.9 - progress * 0.48);
    const reach = this.reducedMotion
      ? captureRadius * 0.72
      : captureRadius * (0.48 + progress * 0.42);
    const inner = captureRadius * 0.26;
    const dotRadius = Math.max(2.4, captureRadius * 0.072);
    this.graphics.lineStyle(3, this.color, alpha * 0.74);

    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI * 0.25;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      this.graphics.lineBetween(
        x + cosine * inner,
        y + sine * inner,
        x + cosine * reach,
        y + sine * reach
      );
      this.graphics.fillStyle(this.color, alpha * 0.86);
      this.graphics.fillCircle(
        x + cosine * reach,
        y + sine * reach,
        dotRadius
      );
    }

    this.graphics.fillStyle(this.color, alpha * 0.18);
    this.graphics.fillCircle(x, y, captureRadius * 0.24);
    this.drawEndpointAnchor(alpha);
  }

  private drawCornerBrackets(
    radius: number,
    armLength: number,
    color: number,
    alpha: number
  ): void {
    const { x, y } = this.geometry;
    this.graphics.lineStyle(3, color, alpha);
    for (let index = 0; index < 4; index += 1) {
      const sideX = index === 0 || index === 3 ? -1 : 1;
      const sideY = index < 2 ? -1 : 1;
      const cornerX = x + sideX * radius;
      const cornerY = y + sideY * radius;
      this.graphics.lineBetween(
        cornerX,
        cornerY,
        cornerX - sideX * armLength,
        cornerY
      );
      this.graphics.lineBetween(
        cornerX,
        cornerY,
        cornerX,
        cornerY - sideY * armLength
      );
    }
  }
}

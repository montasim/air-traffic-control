export type RouteGuidanceTargetKind = 'runway' | 'pad';

export interface GuidanceGeometryInput {
  x: number;
  y: number;
  captureRadius: number;
  kind?: RouteGuidanceTargetKind;
  angle?: number;
  runwayLength?: number;
  runwayWidth?: number;
}

/**
 * Geometry resolved when a guidance target changes. The renderer keeps this
 * object and only reads its numeric fields during animation frames.
 */
export interface GuidanceGeometry {
  x: number;
  y: number;
  captureRadius: number;
  kind: RouteGuidanceTargetKind;
  angle: number;
  inwardX: number;
  inwardY: number;
  outwardX: number;
  outwardY: number;
  normalX: number;
  normalY: number;
  approachLength: number;
  approachNearHalfWidth: number;
  approachFarHalfWidth: number;
  runwayHalfWidth: number;
}

export type GuidanceEmphasis = 'compatible' | 'locked' | 'transient';
export type GuidanceTransientKind = 'confirmed' | 'landing-started';

export const GUIDANCE_TRANSIENT_DURATION_MS: Readonly<Record<GuidanceTransientKind, number>> = {
  confirmed: 360,
  'landing-started': 820
};

export function guidanceTransientDuration(kind: GuidanceTransientKind): number {
  return GUIDANCE_TRANSIENT_DURATION_MS[kind];
}

export interface GuidanceStrokeMetrics {
  readonly casingWidth: number;
  readonly coreWidth: number;
  readonly casingAlpha: number;
  readonly coreAlpha: number;
}

/**
 * Keeps guidance legible without letting passive targets compete with moving
 * aircraft. The dark casing is always wider than the semantic color core.
 */
export function guidanceStrokeMetrics(
  captureRadius: number,
  emphasis: GuidanceEmphasis
): GuidanceStrokeMetrics {
  const radius = Math.max(16, finiteOr(captureRadius, 16));
  const coreWidth = emphasis === 'compatible'
    ? Math.max(1.8, Math.min(2.4, radius * 0.052))
    : emphasis === 'locked'
      ? Math.max(2.5, Math.min(3.4, radius * 0.07))
      : Math.max(2.6, Math.min(3.6, radius * 0.075));

  return {
    casingWidth: coreWidth + (emphasis === 'compatible' ? 2.2 : 3.2),
    coreWidth,
    casingAlpha: emphasis === 'compatible' ? 0.46 : 0.82,
    coreAlpha: emphasis === 'compatible' ? 0.62 : 0.98
  };
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

export function createGuidanceGeometry(
  input: GuidanceGeometryInput
): GuidanceGeometry {
  const captureRadius = Math.max(16, finiteOr(input.captureRadius, 16));
  const kind = input.kind ?? (
    input.runwayLength !== undefined || input.runwayWidth !== undefined
      ? 'runway'
      : 'pad'
  );
  const angle = finiteOr(input.angle, 0);
  const inwardX = Math.cos(angle);
  const inwardY = Math.sin(angle);
  const outwardX = -inwardX;
  const outwardY = -inwardY;
  const normalX = -inwardY;
  const normalY = inwardX;
  const runwayLength = Math.max(
    captureRadius * 3,
    finiteOr(input.runwayLength, captureRadius * 6)
  );
  const runwayWidth = Math.max(
    captureRadius * 0.7,
    finiteOr(input.runwayWidth, captureRadius * 1.25)
  );
  const approachNearHalfWidth = Math.max(
    captureRadius * 0.42,
    Math.min(captureRadius * 0.7, runwayWidth * 0.56)
  );

  return {
    x: finiteOr(input.x, 0),
    y: finiteOr(input.y, 0),
    captureRadius,
    kind,
    angle,
    inwardX,
    inwardY,
    outwardX,
    outwardY,
    normalX,
    normalY,
    approachLength: Math.max(
      captureRadius * 2.6,
      Math.min(captureRadius * 4.5, runwayLength * 0.32)
    ),
    approachNearHalfWidth,
    approachFarHalfWidth: Math.max(
      approachNearHalfWidth * 1.45,
      Math.min(captureRadius * 1.35, runwayWidth * 1.15)
    ),
    runwayHalfWidth: Math.max(
      captureRadius * 0.32,
      Math.min(captureRadius * 0.72, runwayWidth * 0.52)
    )
  };
}

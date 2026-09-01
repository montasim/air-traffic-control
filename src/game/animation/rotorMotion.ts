const TAU = Math.PI * 2;

export const ROTOR_REVOLUTIONS_PER_SECOND = 0.9;
export const MAX_ROTOR_DELTA_MILLISECONDS = 100;
export const ROTOR_RADIANS_PER_SECOND = TAU * ROTOR_REVOLUTIONS_PER_SECOND;

/**
 * Keeps rotor angles bounded so long-running sessions never accumulate enough
 * floating-point error to make the animation visibly stutter.
 */
export function normalizeRotorAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  const normalized = angle % TAU;
  return normalized < 0 ? normalized + TAU : normalized;
}

/**
 * Gives every helicopter a stable starting silhouette without relying on time
 * or randomness. The golden angle spreads nearby aircraft IDs evenly.
 */
export function initialRotorPhase(aircraftId: number): number {
  const safeId = Number.isFinite(aircraftId) ? Math.trunc(aircraftId) : 0;
  return normalizeRotorAngle(safeId * 2.399963229728653);
}

/**
 * Advances a rotor from elapsed frame time. The update is deliberately pure:
 * callers own the current angle and can freeze it by passing running=false.
 */
export function rotorMotion(
  currentAngle: number,
  deltaMilliseconds: number,
  running: boolean
): number {
  const angle = normalizeRotorAngle(currentAngle);
  if (!running || !Number.isFinite(deltaMilliseconds) || deltaMilliseconds <= 0) {
    return angle;
  }

  const clampedDelta = Math.min(deltaMilliseconds, MAX_ROTOR_DELTA_MILLISECONDS);
  return normalizeRotorAngle(angle + ROTOR_RADIANS_PER_SECOND * (clampedDelta / 1000));
}

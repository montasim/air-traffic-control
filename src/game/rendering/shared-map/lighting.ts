/**
 * The light a map is drawn under. By day the sun stands to the north-west and everything casts a shadow to
 * the south-east. At night there is no sun, so each object keeps only a short, soft contact shadow just
 * under itself: long night shadows read as wrong, and none would match the airfield lights.
 *
 * Painters scale their shadow offsets by `castReach()` and their shadow opacity by `castAlpha()`. A map is
 * drawn synchronously inside `drawUnder`, which sets the light for exactly that drawing.
 */
let night = false;

export function drawUnder<T>(atNight: boolean, draw: () => T): T {
  const before = night;
  night = atNight;
  try {
    return draw();
  } finally {
    night = before;
  }
}

/** How far a cast shadow reaches, as a share of its daylight length. */
export function castReach(): number {
  return night ? 0.15 : 1;
}

/** A cast shadow's opacity: softer at night, where it is only contact shade. */
export function castAlpha(alpha: number): number {
  return night ? alpha * 0.55 : alpha;
}

import type { Aircraft, AircraftType, Vector2 } from "./types";

// Conservative solid-airframe outlines in the same local coordinates as the sprites.
// Selection halos, shadows and helicopter rotor blur are not fatal collision surfaces.
export const AIRCRAFT_OUTLINES: Record<AircraftType, readonly (readonly [number, number])[]> = {
  liner: [
    [34,0], [24,-5], [7,-7], [-3,-25], [-10,-25], [-7,-7],
    [-22,-6], [-30,-14], [-34,-12], [-29,0], [-34,12], [-30,14],
    [-22,6], [-7,7], [-10,25], [-3,25], [7,7], [24,5],
  ],
  commuter: [
    [30,0], [21,-7], [5,-8], [1,-22], [-8,-22], [-8,-8],
    [-20,-7], [-26,-13], [-30,-11], [-26,0], [-30,11], [-26,13],
    [-20,7], [-8,8], [-8,22], [1,22], [5,8], [21,7],
  ],
  rotor: [
    [28, 0],
    [21, -7],
    [6, -9],
    [-9, -6],
    [-28, -3],
    [-29, -9],
    [-33, -9],
    [-32, 0],
    [-33, 9],
    [-29, 9],
    [-28, 3],
    [-9, 6],
    [6, 9],
    [21, 7],
  ],
};
export type AircraftCollisionScales = Readonly<Record<AircraftType, number>>;
export const DEFAULT_COLLISION_SCALES: AircraftCollisionScales = {
  liner: 1,
  commuter: 1,
  rotor: 1,
};

export function aircraftCollisionOutline(
  aircraft: Aircraft,
  scale = 1,
): Vector2[] {
  const c = Math.cos(aircraft.heading),
    s = Math.sin(aircraft.heading);
  return AIRCRAFT_OUTLINES[aircraft.type].map(([x, y]) => ({
    x: aircraft.position.x + scale * (x * c - y * s),
    y: aircraft.position.y + scale * (x * s + y * c),
  }));
}
function cross(a: Vector2, b: Vector2, c: Vector2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function onSegment(a: Vector2, b: Vector2, p: Vector2): boolean {
  return (
    Math.abs(cross(a, b, p)) < 1e-8 &&
    p.x >= Math.min(a.x, b.x) - 1e-8 &&
    p.x <= Math.max(a.x, b.x) + 1e-8 &&
    p.y >= Math.min(a.y, b.y) - 1e-8 &&
    p.y <= Math.max(a.y, b.y) + 1e-8
  );
}
function intersects(a: Vector2, b: Vector2, c: Vector2, d: Vector2): boolean {
  return (
    (cross(a, b, c) * cross(a, b, d) < 0 &&
      cross(c, d, a) * cross(c, d, b) < 0) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}
function contains(p: Vector2, polygon: readonly Vector2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
export function airframesOverlap(
  first: Aircraft,
  second: Aircraft,
  scales = DEFAULT_COLLISION_SCALES,
): boolean {
  // Broad phase only rejects distant pairs. It never ends a shift.
  const reach = 36 * (scales[first.type] + scales[second.type]);
  if (
    Math.hypot(
      first.position.x - second.position.x,
      first.position.y - second.position.y,
    ) > reach
  )
    return false;
  const a = aircraftCollisionOutline(first, scales[first.type]),
    b = aircraftCollisionOutline(second, scales[second.type]);
  if (contains(a[0], b) || contains(b[0], a)) return true;
  return a.some((p, i) =>
    b.some((q, j) =>
      intersects(p, a[(i + 1) % a.length], q, b[(j + 1) % b.length]),
    ),
  );
}

/** Warnings must precede contact even when the fleet is enlarged for touch screens. */
export function aircraftWarningDistance(first:Aircraft, second:Aircraft, scales=DEFAULT_COLLISION_SCALES):number {
  return Math.max(96, 36*(scales[first.type]+scales[second.type])+24);
}

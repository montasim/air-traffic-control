import { WORLD_HEIGHT, WORLD_WIDTH, type AircraftType, type LandingZone } from '../core/types';
import { createSaltmarshLayout } from './maps/saltmarsh';
import { AIRCRAFT_COLORS, colorToCss } from './palette';

export const AIRCRAFT_STYLE: Record<
  AircraftType,
  { color: number; css: string; speed: number; radius: number; label: string }
> = {
  liner: {
    color: AIRCRAFT_COLORS.liner,
    css: colorToCss(AIRCRAFT_COLORS.liner),
    speed: 60,
    radius: 22,
    label: 'L'
  },
  commuter: {
    color: AIRCRAFT_COLORS.commuter,
    css: colorToCss(AIRCRAFT_COLORS.commuter),
    speed: 48,
    radius: 18,
    label: 'C'
  },
  rotor: {
    color: AIRCRAFT_COLORS.rotor,
    css: colorToCss(AIRCRAFT_COLORS.rotor),
    speed: 38,
    radius: 17,
    label: 'H'
  }
};

/** Default portrait zones kept for pure simulation tests and non-visual consumers. */
export const LANDING_ZONES: LandingZone[] = createSaltmarshLayout(
  WORLD_WIDTH,
  WORLD_HEIGHT
).landingZones;

export function getLandingZones(width: number, height: number): LandingZone[] {
  return createSaltmarshLayout(width, height).landingZones;
}

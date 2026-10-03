import type { AircraftType, Vector2 } from '../../../core/types';

export interface AircraftSilhouetteSpec {
  readonly id: 'swept-liner' | 'straight-wing-commuter' | 'compact-rotorcraft';
  readonly majorAxis: number;
  readonly halfSpan: number;
  readonly selectionRadius: number;
}

/**
 * Cream paint and teal outlines echo the controls; broad livery matches landing targets.
 */
export const AIRCRAFT_VISUAL_TOKENS = {
  body: 0xf3ead5,
  bodyHighlight: 0xfff8e8,
  bodyShade: 0xd9cfb7,
  keyline: 0x173e38,
  canopy: 0x76a7b2,
  canopyHighlight: 0xc6edf0,
  shadow: 0x091820,
  shadowAlpha: 0.22,
  shadowOffset: { x: 3, y: 4 } satisfies Vector2,
  keylineWidth: 2.6,
  selectionLight: 0xfff6df,
  selectionOuterWidth: 6,
  selectionInnerWidth: 2.4,
  maximumAccentCoverage: 0.35
} as const;

/**
 * Landed aircraft are muted so attention stays on the airborne traffic: a stone
 * body, a soft keyline, and a livery desaturated toward the airfield greys.
 */
export const LANDED_AIRCRAFT_TOKENS = {
  body: 0xc9c8b8,
  keyline: 0x56665d,
  livery: 0x9aa197,
  shadowAlpha: 0.08,
  /** Blend from the flight palette over this long after touchdown. */
  blendMilliseconds: 400
} as const;

export const AIRCRAFT_SILHOUETTES: Readonly<Record<AircraftType, AircraftSilhouetteSpec>> = {
  liner: {
    id: 'swept-liner',
    majorAxis: 68,
    halfSpan: 25,
    selectionRadius: 41
  },
  commuter: {
    id: 'straight-wing-commuter',
    majorAxis: 60,
    halfSpan: 22,
    selectionRadius: 37
  },
  rotor: {
    id: 'compact-rotorcraft',
    majorAxis: 64,
    halfSpan: 32,
    selectionRadius: 39
  }
};

export const AIRCRAFT_TARGET_CSS_MAJOR_AXIS: Readonly<Record<AircraftType, number>> = {
  liner: 76,
  commuter: 68,
  rotor: 70
};

export const AIRCRAFT_MOBILE_CSS_MAJOR_AXIS: Readonly<Record<AircraftType, number>> = {
  liner: 48, commuter: 44, rotor: 44
};

/**
 * Keeps aircraft readable after the fixed logical world is scaled onto a
 * small screen. This exact scale is shared by sprites and airframe collision outlines.
 * The generous pointer-selection radius remains separate.
 */
export function aircraftPresentationScale(
  type: AircraftType,
  renderedCssSize: { readonly width: number; readonly height: number },
  logicalSize: { readonly width: number; readonly height: number }
): number {
  const displayScale = Math.min(
    renderedCssSize.width / Math.max(1, logicalSize.width),
    renderedCssSize.height / Math.max(1, logicalSize.height)
  );
  const unscaledCssMajorAxis = AIRCRAFT_SILHOUETTES[type].majorAxis * displayScale;
  if (!Number.isFinite(unscaledCssMajorAxis) || unscaledCssMajorAxis <= 0) return 1;
  const shortSide = Math.min(renderedCssSize.width, renderedCssSize.height);
  const blend = Math.max(0, Math.min(1, (shortSide - 430) / (700 - 430)));
  const target = AIRCRAFT_MOBILE_CSS_MAJOR_AXIS[type] +
    blend * (AIRCRAFT_TARGET_CSS_MAJOR_AXIS[type] - AIRCRAFT_MOBILE_CSS_MAJOR_AXIS[type]);
  const requested = target / unscaledCssMajorAxis;
  return Math.max(1, Math.min(3, requested));
}

function linearChannel(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance, useful for deterministic visual-token gates. */
export function relativeLuminance(color: number): number {
  const red = linearChannel((color >> 16) & 0xff);
  const green = linearChannel((color >> 8) & 0xff);
  const blue = linearChannel(color & 0xff);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

export function contrastRatio(first: number, second: number): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

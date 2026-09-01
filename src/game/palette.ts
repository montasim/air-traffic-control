/**
 * Gameplay accents are intentionally reserved for aircraft and landing cues.
 * Keeping them here prevents environmental scenery from borrowing their
 * saturation and weakening route readability.
 */
export const AIRCRAFT_COLORS = {
  liner: 0x8bdeda,
  commuter: 0xf0bd66,
  rotor: 0xf0836f
} as const;

/** Semantic colors shared by the code-native saltmarsh renderers. */
export const SALTMARSH_PALETTE = {
  marshDeep: 0x263e38,
  marsh: 0x3c5a4f,
  marshHigh: 0x526b5d,
  reedDark: 0x4b594b,
  reedLight: 0x77775a,
  waterDeep: 0x21464d,
  waterMid: 0x2d5559,
  waterShallow: 0x416866,
  wetMud: 0x60695f,
  silt: 0x918b69,
  saltFilm: 0xb0aa86,
  polderShadow: 0x132b28,
  revetment: 0x687065,
  raisedTurf: 0x4b5951,
  gradedTurf: 0x5c655a,
  drainageWater: 0x294d50,
  drainageEdge: 0x697064,
  asphalt: 0x273431,
  asphaltWorn: 0x333f3b,
  asphaltRubber: 0x172321,
  concrete: 0x3b4944,
  concreteEdge: 0x59645d,
  serviceRoad: 0x7d8573,
  fence: 0x929785,
  marking: 0xe4e0cc,
  runwayEdge: 0xaab7a8,
  runwayLight: 0xd7ece5,
  taxiwayMarking: 0xb79b55,
  taxiwayLight: 0x6fa9a8,
  buildingWall: 0x3b4944,
  buildingRoof: 0x566159,
  roofHighlight: 0xb2b39c,
  utility: 0x697168,
  safetyRed: 0xb96f5c
} as const;

export type WorldDetailLevel = 'mobile' | 'tablet' | 'desktop';

export interface WorldDetailBudget {
  readonly creekCount: number;
  readonly reedClumps: number;
  readonly bladesPerClump: number;
  readonly sedimentBands: number;
  readonly fencePosts: number;
  readonly wearMarks: number;
  readonly showFacilityLabels: boolean;
}

export const WORLD_DETAIL_BUDGETS: Record<WorldDetailLevel, WorldDetailBudget> = {
  mobile: {
    creekCount: 3,
    reedClumps: 22,
    bladesPerClump: 3,
    sedimentBands: 8,
    fencePosts: 24,
    wearMarks: 16,
    showFacilityLabels: false
  },
  tablet: {
    creekCount: 5,
    reedClumps: 40,
    bladesPerClump: 4,
    sedimentBands: 12,
    fencePosts: 36,
    wearMarks: 28,
    showFacilityLabels: true
  },
  desktop: {
    creekCount: 7,
    reedClumps: 64,
    bladesPerClump: 5,
    sedimentBands: 18,
    fencePosts: 54,
    wearMarks: 44,
    showFacilityLabels: true
  }
};

/**
 * The light arrives from the north-west. Offsets point south-east and align
 * with the aircraft shadow already used by AircraftView.
 */
export const WORLD_LIGHT = {
  direction: { x: -0.6, y: -0.8 },
  aircraftShadow: { x: 3, y: 4 },
  lowShadow: { x: 2, y: 3 },
  structureShadow: { x: 5, y: 7 },
  polderShadow: { x: 8, y: 11 }
} as const;

export function resolveWorldDetailLevel(
  detail: WorldDetailLevel | string | undefined
): WorldDetailLevel {
  return detail === 'mobile' || detail === 'tablet' || detail === 'desktop'
    ? detail
    : 'desktop';
}

export function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

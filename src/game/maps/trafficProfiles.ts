import {
  DEFAULT_TRAFFIC_PROFILE,
  resolveTrafficProfile,
  type ResolvedTrafficProfile,
  type TrafficProfile
} from '../../core/trafficProfile';

const commonLimits = [
  { at: 0, limit: 3 },
  { at: 36, limit: 4 },
  { at: 72, limit: 5 },
  { at: 120, limit: 6 },
  { at: 180, limit: 7 },
  { at: 240, limit: 8 },
  { at: 320, limit: 9 }
] as const;

function profile(overrides: Partial<TrafficProfile>): ResolvedTrafficProfile {
  return resolveTrafficProfile({
    openingSpawns: DEFAULT_TRAFFIC_PROFILE.openingSpawns,
    aircraftTypeWeights: DEFAULT_TRAFFIC_PROFILE.aircraftTypeWeights,
    spawnIntervalStages: DEFAULT_TRAFFIC_PROFILE.spawnIntervalStages,
    trafficLimitStages: commonLimits,
    speedMultipliers: DEFAULT_TRAFFIC_PROFILE.speedMultipliers,
    inwardTargetRegion: DEFAULT_TRAFFIC_PROFILE.inwardTargetRegion,
    ...overrides
  });
}

export const MAP_TRAFFIC_PROFILES: Readonly<Record<string, ResolvedTrafficProfile>> = {
  'saltmarsh-gateway': DEFAULT_TRAFFIC_PROFILE,
  'river-bend': profile({
    openingSpawns: [
      { at: 0, type: 'commuter' },
      { at: 14, type: 'liner' },
      { at: 28, type: 'rotor' }
    ],
    aircraftTypeWeights: [
      { type: 'liner', weight: 0.3 },
      { type: 'commuter', weight: 0.4 },
      { type: 'rotor', weight: 0.3 }
    ],
    spawnIntervalStages: [
      { at: 0, interval: 10 },
      { at: 90, interval: 8, transition: 'linear' },
      { at: 210, interval: 5.4, transition: 'linear' },
      { at: 360, interval: 4.2 }
    ],
    speedMultipliers: { liner: 0.5, commuter: 0.5, rotor: 0.5 },
    spawnCorridors: [
      { edge: 'left', from: 0.12, to: 0.82, weight: 2 },
      { edge: 'bottom', from: 0.08, to: 0.68, weight: 1.3 },
      { edge: 'right', from: 0.45, to: 0.88, weight: 1 }
    ]
  }),
  'desert-parallel': profile({
    openingSpawns: [
      { at: 0, type: 'liner' },
      { at: 11, type: 'commuter' },
      { at: 23, type: 'rotor' }
    ],
    aircraftTypeWeights: [
      { type: 'liner', weight: 0.38 },
      { type: 'commuter', weight: 0.38 },
      { type: 'rotor', weight: 0.24 }
    ],
    spawnIntervalStages: [
      { at: 0, interval: 9 },
      { at: 75, interval: 7.2, transition: 'linear' },
      { at: 180, interval: 4.9, transition: 'linear' },
      { at: 320, interval: 3.9 }
    ],
    speedMultipliers: { liner: 0.53, commuter: 0.53, rotor: 0.52 },
    spawnCorridors: [
      { edge: 'left', from: 0.08, to: 0.84, weight: 1.5 },
      { edge: 'right', from: 0.12, to: 0.86, weight: 1.5 },
      { edge: 'bottom', from: 0.1, to: 0.9, weight: 1 }
    ]
  }),
  'twin-banks': profile({
    openingSpawns: [
      { at: 0, type: 'commuter' },
      { at: 10, type: 'rotor' },
      { at: 20, type: 'liner' }
    ],
    aircraftTypeWeights: [
      { type: 'liner', weight: 0.34 },
      { type: 'commuter', weight: 0.34 },
      { type: 'rotor', weight: 0.32 }
    ],
    spawnIntervalStages: [
      { at: 0, interval: 8.6 },
      { at: 65, interval: 6.8, transition: 'linear' },
      { at: 160, interval: 4.6, transition: 'linear' },
      { at: 300, interval: 3.6 }
    ],
    trafficLimitStages: [
      { at: 0, limit: 3 },
      { at: 30, limit: 4 },
      { at: 60, limit: 5 },
      { at: 100, limit: 6 },
      { at: 145, limit: 7 },
      { at: 200, limit: 8 },
      { at: 260, limit: 9 },
      { at: 330, limit: 10 }
    ],
    speedMultipliers: { liner: 0.54, commuter: 0.54, rotor: 0.53 },
    spawnCorridors: [
      { edge: 'top', from: 0.08, to: 0.92, weight: 1 },
      { edge: 'left', from: 0.16, to: 0.88, weight: 1.4 },
      { edge: 'right', from: 0.12, to: 0.86, weight: 1.4 },
      { edge: 'bottom', from: 0.08, to: 0.92, weight: 1 }
    ],
    inwardTargetRegion: { minX: 0.3, maxX: 0.7, minY: 0.25, maxY: 0.72 }
  })
};

export function trafficProfileById(id: string): ResolvedTrafficProfile {
  return MAP_TRAFFIC_PROFILES[id] ?? DEFAULT_TRAFFIC_PROFILE;
}

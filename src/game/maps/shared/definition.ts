import { settleHelipadsOnApron } from './apronHelipad';
import { withBidirectionalApproaches } from './bidirectional';
import { apronPolygons, createApronMarkings, DECK_LANE_CLEARANCE, deckRunwayIds } from './apronLayout';
import { clearAirfieldSite } from './siteCleanup';
import { createGroundRoutes, groundObstacles, hasGroundNetwork, taxiwayExits, type GroundNetwork, type GroundObstacle } from './groundRoutes';
import type Phaser from 'phaser';
import type {
  MapDefinition,
  MapMetadata,
  MapPreparationInput,
  PlayableMapLayout,
  PreparedMap
} from '../types';
import type { MapId } from '../mapIds';

export interface MapRenderContext {
  readonly detailLevel: MapPreparationInput['detailLevel'];
}

/** Typed, map-private implementation used to construct an erased definition. */
export interface MapAdapter<Layout extends PlayableMapLayout> {
  readonly id: MapId;
  readonly metadata: MapMetadata;
  readonly trafficProfileId: string;
  createLayout(input: MapPreparationInput): Layout;
  render(scene: Phaser.Scene, layout: Layout, context: MapRenderContext): void;
}

function requirePositiveDimension(value: number, name: 'width' | 'height'): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`Map ${name} must be a positive finite number`);
  }
}

function assertPreparedLayout(
  layout: PlayableMapLayout,
  input: MapPreparationInput,
  mapId: MapId
): void {
  if (layout.width !== input.width || layout.height !== input.height) {
    throw new Error(`${mapId} returned layout dimensions that do not match its viewport`);
  }

  const zoneIds = new Set<string>();
  for (const zone of layout.landingZones) {
    if (zoneIds.has(zone.id)) throw new Error(`${mapId} has duplicate landing zone ${zone.id}`);
    zoneIds.add(zone.id);
  }

  const guidanceZoneIds = new Set<string>();
  for (const surface of layout.guidanceSurfaces) {
    if (!zoneIds.has(surface.zoneId)) {
      throw new Error(`${mapId} guidance references missing zone ${surface.zoneId}`);
    }
    if (guidanceZoneIds.has(surface.zoneId)) {
      throw new Error(`${mapId} has duplicate guidance for zone ${surface.zoneId}`);
    }
    guidanceZoneIds.add(surface.zoneId);
  }

  for (const zoneId of zoneIds) {
    if (!guidanceZoneIds.has(zoneId)) {
      throw new Error(`${mapId} is missing guidance for zone ${zoneId}`);
    }
  }
}

function withGroundTraffic<T extends PlayableMapLayout & GroundNetwork>(authored: T, input: MapPreparationInput): T {
  if ((authored as { buildingsAtApronEnds?: boolean }).buildingsAtApronEnds !== true) {
    // Square rows give straight guides with right-angle turns; keep them unless they cost a stand.
    const loose = groundTraffic(authored, input, false);
    const square = groundTraffic(authored, input, true);
    return square.apronMarkings.stands.length >= loose.apronMarkings.stands.length ? square : loose;
  }
  // Buildings at the apron ends with square stand rows, but never at the cost of a stand: a tight
  // screen gives up square rows first, then the end placement.
  const usualLayout = { ...authored, buildingsAtApronEnds: false };
  const usual = groundTraffic(usualLayout, input, false);
  const stands = usual.apronMarkings.stands.length;
  for (const [layout, square] of [[authored, true], [authored, false], [usualLayout, true]] as const) {
    const candidate = groundTraffic(layout, input, square);
    if (candidate.apronMarkings.stands.length >= stands) return candidate;
  }
  return usual;
}

function groundTraffic<T extends PlayableMapLayout & GroundNetwork>(authored: T, input: MapPreparationInput, squareRows: boolean) {
  const unit = Math.min(input.width, input.height);
  // Aprons come off the runways and buildings off runways and helipads before anything is placed on them.
  const layout = clearAirfieldSite(authored, unit);
  const obstacles = groundObstacles(layout);
  const decks = deckRunwayIds(layout);
  const runways = layout.runways.map((runway) => ({
    center: runway.center, width: runway.length, height: runway.width, angle: runway.angle,
    clearance: decks.has(runway.id) ? DECK_LANE_CLEARANCE : undefined,
  }));
  // Stands also keep clear of helipads, taken from the helicopter landing zones every map has.
  const helipads: GroundObstacle[] = layout.landingZones
    .filter((zone) => zone.accepts === 'rotor')
    .map((zone) => ({ center: zone.position, width: zone.captureRadius * 3, height: zone.captureRadius * 3, angle: 0 }));
  const landAprons = apronPolygons(layout, 'land');
  const deckAprons = apronPolygons(layout, 'deck');
  const markingInput = {
    width: input.width,
    height: input.height,
    unit,
    exits: taxiwayExits(layout, obstacles, unit),
    aprons: [...landAprons, ...deckAprons],
    deckAprons,
    deckRunwayIds: decks,
    obstacles: [...obstacles, ...helipads],
    runways,
    hud: layout.hudExclusionZones,
  };
  const apronMarkings = createApronMarkings({ ...markingInput, squareRows });
  return { ...layout, apronMarkings, groundRoutes: createGroundRoutes(layout.landingZones, layout, unit, obstacles, apronMarkings) };
}

/**
 * Hides each adapter's rich layout while preserving a small uniform interface
 * for selection, preparation, rendering, and tests.
 */
export function defineMap<Layout extends PlayableMapLayout>(
  adapter: MapAdapter<Layout>
): MapDefinition {
  const privateLayouts = new WeakMap<PreparedMap, Layout>();

  return {
    id: adapter.id,
    metadata: adapter.metadata,
    trafficProfileId: adapter.trafficProfileId,
    prepare(input): PreparedMap {
      requirePositiveDimension(input.width, 'width');
      requirePositiveDimension(input.height, 'height');
      const approaches = withBidirectionalApproaches(adapter.createLayout(input), input.twoEndLanding);
      // Apron stands and ground routes follow the final landing zones, so they cover both runway-end modes.
      // Helipads settle once, onto the apron layout that was chosen.
      const layout = hasGroundNetwork(approaches)
        ? settleHelipadsOnApron(withGroundTraffic(approaches, input), Math.min(input.width, input.height))
        : approaches;
      assertPreparedLayout(layout, input, adapter.id);
      const prepared: PreparedMap = {
        mapId: adapter.id,
        detailLevel: input.detailLevel,
        layout
      };
      privateLayouts.set(prepared, layout);
      return prepared;
    },
    render(scene, map): void {
      if (map.mapId !== adapter.id) {
        throw new Error(`Cannot render ${map.mapId} with ${adapter.id}`);
      }
      const layout = privateLayouts.get(map);
      if (!layout) {
        throw new Error(`${adapter.id} can only render maps prepared by the same definition`);
      }
      adapter.render(scene, layout, { detailLevel: map.detailLevel });
    }
  };
}


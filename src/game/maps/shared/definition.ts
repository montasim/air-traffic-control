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
      const layout = adapter.createLayout(input);
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


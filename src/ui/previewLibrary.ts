import type { MapId } from "../game/maps/mapIds";
import { createMapPreviews, type PreviewSettings } from "./mapPreviews";
import { SHIPPED_ROOT, shippedSet, type ShippedManifest } from "./shippedPictures";

export interface MapPicture {
  readonly url: string;
  /** Where the airfield sits, as fractions of the picture, for cropping it into another shape. */
  readonly focus: { readonly x: number; readonly y: number };
}

/**
 * Airfield pictures drawn only when asked for, once per setting, and kept across visits. Pictures
 * the build shipped come first; the device draws only what the build could not.
 *
 * Drawing all twelve at startup cost a phone seconds of blocked main thread and most of its memory,
 * so the menu asks only for what it shows: the selected airfield at first, the rest when a screen
 * that lists them opens. Finished pictures are kept in Cache Storage under the build's own file
 * name, so a returning player's menu draws nothing and a new release never shows stale art.
 */
export function createPreviewLibrary(show: (id: MapId, picture: MapPicture) => void) {
  // The bundle's file name carries a content hash in production, so it changes with the map art.
  // The dev server's names never change, so it keeps pictures in memory only.
  const cacheName = import.meta.env.DEV || typeof caches === "undefined" ? undefined : `map-previews:${new URL(import.meta.url).pathname}`;
  const memory = new Map<string, MapPicture>();
  let settings: PreviewSettings | undefined;
  let settingsKey = "";
  const queue: MapId[] = [];
  /** Airfields in the drawing under way. */
  const inFlight = new Set<MapId>();
  let drawing: (() => void) | undefined;

  if (cacheName) {
    // Pictures from earlier releases are never read again.
    void caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("map-previews:") && name !== cacheName).map((name) => caches.delete(name)))).catch(() => {});
  }

  const keyOf = (id: MapId) => `/${settingsKey}/${id}`;
  let manifest: Promise<ShippedManifest | undefined> | undefined;

  /** A picture drawn at build time, when the build shipped one for exactly these settings. */
  async function shipped(id: MapId): Promise<MapPicture | undefined> {
    const set = settings && shippedSet(settings);
    if (!set) return undefined;
    manifest ??= fetch(`${SHIPPED_ROOT}/manifest.json`).then((response) => (response.ok ? response.json() : undefined)).catch(() => undefined);
    const focus = (await manifest)?.focus[set]?.[id];
    return focus && { url: `${SHIPPED_ROOT}/${set}/${id}.jpg`, focus };
  }

  async function stored(id: MapId): Promise<MapPicture | undefined> {
    if (!cacheName) return undefined;
    try {
      const response = await (await caches.open(cacheName)).match(keyOf(id));
      return response ? ((await response.json()) as MapPicture) : undefined;
    } catch {
      return undefined;
    }
  }

  function keep(id: MapId, picture: MapPicture): void {
    memory.set(keyOf(id), picture);
    show(id, picture);
    if (!cacheName) return;
    const key = keyOf(id);
    void caches.open(cacheName).then((cache) => cache.put(key, new Response(JSON.stringify(picture), { headers: { "Content-Type": "application/json" } }))).catch(() => {});
  }

  function drawQueued(): void {
    if (drawing || !settings || queue.length === 0) return;
    const maps = queue.splice(0);
    for (const id of maps) inFlight.add(id);
    const key = settingsKey;
    drawing = createMapPreviews((id, url, focus) => {
      if (key !== settingsKey) return;
      inFlight.delete(id);
      keep(id, { url, focus });
    }, {
      ...settings,
      maps,
      onDone: () => {
        drawing = undefined;
        drawQueued();
      },
    });
  }

  return {
    /** Switches to the pictures for these settings; pictures on screen stay until replaced. */
    configure(next: PreviewSettings): void {
      const key = [next.world.width, next.world.height, next.detailLevel, next.night, next.weather, next.twoEndLanding].join("-");
      settings = next;
      if (key === settingsKey) return;
      settingsKey = key;
      queue.length = 0;
      inFlight.clear();
      drawing?.();
      drawing = undefined;
    },
    /** Shows these airfields' pictures, from memory, the cache, or a fresh drawing, in this order. */
    async request(ids: readonly MapId[]): Promise<void> {
      const key = settingsKey;
      for (const id of ids) {
        const known = memory.get(keyOf(id));
        if (known) {
          show(id, known);
          continue;
        }
        const cached = (await shipped(id)) ?? (await stored(id));
        if (key !== settingsKey) return;
        if (cached) {
          memory.set(keyOf(id), cached);
          show(id, cached);
        } else if (!queue.includes(id) && !inFlight.has(id)) {
          queue.push(id);
        }
      }
      drawQueued();
    },
    /**
     * Marks a picture as coming from elsewhere (the live game's frame), so requests wait for it rather
     * than draw it. Deliver it with the returned function, or call it empty to have it drawn after all.
     */
    expect(id: MapId): (picture?: MapPicture) => void {
      const key = settingsKey;
      // The live frame is exactly what the player will see (clouds included), so it replaces any other picture.
      inFlight.add(id);
      return (picture) => {
        if (key !== settingsKey || !inFlight.delete(id)) return;
        if (picture) keep(id, picture);
        else void this.request([id]);
      };
    },
    dispose(): void {
      queue.length = 0;
      drawing?.();
      drawing = undefined;
    },
  };
}

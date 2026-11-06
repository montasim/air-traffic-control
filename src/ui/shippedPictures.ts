import type { MapId } from "../game/maps/mapIds";
import type { MapPicture } from "./previewLibrary";
import type { PreviewSettings } from "./mapPreviews";

/**
 * Menu pictures drawn at build time (scripts/build-menu-pictures.mjs), so a phone shows a file instead
 * of drawing twelve maps itself. One world per screen orientation: the pictures are cropped around the
 * airfield, so a phone of a slightly different shape still gets a faithful picture. Clouds are left
 * out, since they drift and the weather setting would otherwise double the set.
 */
export const SHIPPED_WORLDS = {
  portrait: { world: { width: 900, height: 1800 }, detailLevel: "mobile" },
  landscape: { world: { width: 1600, height: 900 }, detailLevel: "desktop" },
} as const;

export const SHIPPED_ROOT = "/menu-pictures";

/** The shipped set for these settings, such as "portrait-night-both". */
export function shippedSet(settings: Pick<PreviewSettings, "world" | "night" | "twoEndLanding">): string {
  const orientation = settings.world.width >= settings.world.height ? "landscape" : "portrait";
  return `${orientation}-${settings.night ? "night" : "day"}-${settings.twoEndLanding ? "both" : "one"}`;
}

/** Every shipped set with the settings it is drawn at. */
export function shippedSets(): { readonly set: string; readonly settings: PreviewSettings }[] {
  return Object.values(SHIPPED_WORLDS).flatMap(({ world, detailLevel }) =>
    [false, true].flatMap((night) => [false, true].map((twoEndLanding) => {
      const settings = { world, detailLevel, night, twoEndLanding, weather: false };
      return { set: shippedSet(settings), settings };
    })));
}

/** Written beside the pictures: where each airfield sits in its picture, per set. */
export interface ShippedManifest {
  readonly hash: string;
  readonly focus: Record<string, Partial<Record<MapId, MapPicture["focus"]>>>;
}

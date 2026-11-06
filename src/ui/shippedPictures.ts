import type { MapId } from "../game/maps/mapIds";
import type { MapPicture } from "./previewLibrary";
import type { PreviewSettings } from "./mapPreviews";

/**
 * Menu pictures drawn at build time (scripts/build-menu-pictures.mjs) for the worlds of the most common
 * screen shape, 16:9: laptops and desktops in landscape, and 16:9 phones in portrait. An airfield's layout
 * changes with the exact world size (an apron can swap sides, a taxiway link move along its runway), so a
 * shipped picture is used only when this screen's world matches it exactly; any other screen draws its own.
 */
export const SHIPPED_WORLDS = {
  portrait: { world: { width: 900, height: 1600 }, detailLevel: "mobile" },
  landscape: { world: { width: 1600, height: 900 }, detailLevel: "desktop" },
} as const;

export const SHIPPED_ROOT = "/menu-pictures";

type SetSettings = Pick<PreviewSettings, "world" | "detailLevel" | "night" | "twoEndLanding" | "weather">;

/** The shipped set drawn for exactly these settings, such as "portrait-night-both-weather", or none. */
export function shippedSet(settings: SetSettings): string | undefined {
  const match = Object.entries(SHIPPED_WORLDS).find(([, { world, detailLevel }]) =>
    // Rounded as the picture renderer rounds the world it draws.
    Math.round(settings.world.width) === world.width && Math.round(settings.world.height) === world.height && settings.detailLevel === detailLevel);
  if (!match) return undefined;
  return [match[0], settings.night ? "night" : "day", settings.twoEndLanding ? "both" : "one", settings.weather ? "weather" : "clear"].join("-");
}

/** Every shipped set with the settings it is drawn at. */
export function shippedSets(): { readonly set: string; readonly settings: PreviewSettings }[] {
  return Object.values(SHIPPED_WORLDS).flatMap(({ world, detailLevel }) =>
    [false, true].flatMap((night) => [false, true].flatMap((twoEndLanding) => [false, true].map((weather) => {
      const settings = { world, detailLevel, night, twoEndLanding, weather };
      return { set: shippedSet(settings)!, settings };
    }))));
}

/** Written beside the pictures: where each airfield sits in its picture, per set. */
export interface ShippedManifest {
  readonly hash: string;
  readonly focus: Record<string, Partial<Record<MapId, MapPicture["focus"]>>>;
}

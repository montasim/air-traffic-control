import Phaser from "phaser";
import type { LandingZone } from "../core/types";
import { MAP_IDS, type MapId } from "../game/maps/mapIds";
import { profileForViewport, worldSizeForViewport } from "../game/viewport";
import type { GameSettings } from "../storage/gameSave";
import { airfieldFocus, shrink } from "./mapPreviews";
import { createPreviewLibrary } from "./previewLibrary";

/** Read when needed, never at mount, so callers can pass state that is set up later. */
export interface MenuPictureState {
  readonly settings: () => Pick<GameSettings, "night" | "weather" | "twoEndLanding">;
  readonly selectedId: () => MapId;
  /** A screen listing every airfield (Choose airfield, Career) is open. */
  readonly listing: () => boolean;
  /** The live game is being built for the selected airfield; its first frame will become that picture. */
  readonly liveFrameComing: () => boolean;
}

/** The world a new shift would get on this window; pictures are drawn at it so they match play. */
function newShiftWorld() {
  return { world: worldSizeForViewport(window.innerWidth, window.innerHeight), detailLevel: profileForViewport().detailLevel };
}

/**
 * The airfield pictures every menu shows: drawn on demand, cached across visits, and pushed into each
 * place that shows them (the Play card, airfield cards, Career) as they arrive. Callers say when
 * settings or the window change, or when a list screen opens; the rest is handled here.
 */
export function mountMenuPictures(state: MenuPictureState) {
  const pictures = new Map<MapId, string>();
  const library = createPreviewLibrary((id, { url, focus }) => {
    pictures.set(id, url);
    // Every picture of this airfield crops around the airfield itself, whatever its box shape.
    document.documentElement.style.setProperty(`--map-focus-${id}`, `${(focus.x * 100).toFixed(1)}% ${(focus.y * 100).toFixed(1)}%`);
    if (id === state.selectedId()) document.querySelector<HTMLImageElement>("#home-map-preview")!.src = url;
    const careerImage = document.querySelector<HTMLImageElement>(`[data-career-map="${id}"]`);
    if (careerImage) careerImage.src = url;
    document.querySelector<HTMLElement>(`#map-options [data-map-id="${id}"]`)?.style.setProperty("--map-preview", `url("${url}")`);
  });
  let worldKey = "";

  const everyAirfield = (): MapId[] => {
    const selected = state.selectedId();
    return [selected, ...MAP_IDS.filter((id) => id !== selected)];
  };
  function configure(): void {
    const { world, detailLevel } = newShiftWorld();
    worldKey = `${world.width}x${world.height}:${detailLevel}`;
    const { night, weather, twoEndLanding } = state.settings();
    library.configure({ night, weather, twoEndLanding, world, detailLevel });
  }
  /** Shows these pictures, drawing any that are missing, except the selected one while the live frame is coming. */
  function show(ids: readonly MapId[]): void {
    const selected = state.selectedId();
    const waitForLive = state.liveFrameComing();
    void library.request(ids.filter((id) => !waitForLive || id !== selected));
    if (waitForLive && ids.includes(selected)) void library.request([selected], false);
  }
  function refresh(): void {
    configure();
    show(state.listing() ? everyAirfield() : [state.selectedId()]);
  }
  window.addEventListener("pagehide", () => library.dispose(), { once: true });
  configure();

  return {
    pictures: pictures as ReadonlyMap<MapId, string>,
    /** Settings that change the pictures (night, weather, runway ends) have changed. */
    refresh,
    /** The window changed; pictures are redrawn only if a new shift would get a different world. */
    resized(): void {
      const { world, detailLevel } = newShiftWorld();
      if (`${world.width}x${world.height}:${detailLevel}` !== worldKey) refresh();
    },
    showSelected(): void {
      show([state.selectedId()]);
    },
    showAll(): void {
      show(everyAirfield());
    },
    /**
     * The selected airfield is already on screen, so its picture is cut from the live frame instead of
     * drawn again, once the browser is idle so startup is never delayed. `current` says whether that
     * frame still shows it.
     */
    takeFromFrame(source: Phaser.Game, zones: readonly LandingZone[], current: () => boolean): void {
      const { world } = newShiftWorld();
      const deliver = library.expect(state.selectedId());
      const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 600));
      idle(() => {
        source.events.once(Phaser.Core.Events.POST_RENDER, () => {
          if (!current()) return deliver();
          deliver({ url: shrink(source.canvas, world.width, world.height), focus: airfieldFocus(zones, world.width, world.height) });
        });
        // Behind a menu the game sleeps; one more frame is drawn for the picture, then it sleeps again.
        source.loop.wake();
      });
    },
  };
}

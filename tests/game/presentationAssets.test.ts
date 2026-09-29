import { describe, expect, it } from "vitest";
import { presentationAssetFor } from "../../src/game/assets/presentationAssets";
import { MAP_IDS } from "../../src/game/maps/mapIds";

describe("offline terrain materials", () => {
  it("ships a local material for every map and shares it across orientations", () => {
    for (const mapId of MAP_IDS) {
      const assets = ["portrait", "landscape", "square"].map((variant) =>
        presentationAssetFor({
          mapId,
          variant: variant as "portrait" | "landscape" | "square",
        }),
      );
      expect(new Set(assets.map((asset) => asset.key)).size).toBe(1);
      for (const asset of assets)
        expect(asset.url).toMatch(/^\/assets\/arcade\/(meadow|mineral)\.webp$/);
    }
  });
  it("uses a distinct mineral surface for the desert", () => {
    expect(
      presentationAssetFor({ mapId: "desert-parallel", variant: "landscape" })
        .key,
    ).not.toBe(
      presentationAssetFor({ mapId: "river-bend", variant: "landscape" }).key,
    );
  });
});

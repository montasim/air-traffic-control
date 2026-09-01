import { describe, expect, it } from 'vitest';
import {
  presentationAssetFor,
  riverBendTerrainTextureKey
} from '../../src/game/assets/presentationAssets';

describe('presentation assets', () => {
  it('selects one stable River Bend terrain key per layout variant', () => {
    for (const variant of ['landscape', 'portrait', 'square'] as const) {
      const asset = presentationAssetFor({ mapId: 'river-bend', variant });
      expect(asset).toEqual({
        key: riverBendTerrainTextureKey(variant),
        url: `/assets/visual-v2/river-bend/terrain-${variant}.webp`
      });
    }
  });

  it('does not queue a terrain plate for maps that still use code-native scenery', () => {
    expect(presentationAssetFor({
      mapId: 'saltmarsh-gateway',
      variant: 'landscape'
    })).toBeUndefined();
  });
});

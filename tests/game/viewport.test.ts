import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isSameProfile,
  profileForSize,
  profileForViewport,
  type ViewportProfile
} from '../../src/game/viewport';

interface SizeExpectation {
  readonly width: number;
  readonly height: number;
  readonly id: ViewportProfile['id'];
  readonly detailLevel: ViewportProfile['detailLevel'];
  readonly logicalWidth: number;
  readonly logicalHeight: number;
}

const SIZES: readonly SizeExpectation[] = [
  {
    width: 390,
    height: 844,
    id: 'portrait',
    detailLevel: 'mobile',
    logicalWidth: 900,
    logicalHeight: 1600
  },
  {
    width: 844,
    height: 390,
    id: 'landscape',
    detailLevel: 'mobile',
    logicalWidth: 1600,
    logicalHeight: 900
  },
  {
    width: 1024,
    height: 768,
    id: 'landscape',
    detailLevel: 'tablet',
    logicalWidth: 1600,
    logicalHeight: 900
  },
  {
    width: 1366,
    height: 768,
    id: 'landscape',
    detailLevel: 'desktop',
    logicalWidth: 1600,
    logicalHeight: 900
  },
  {
    width: 1920,
    height: 1080,
    id: 'landscape',
    detailLevel: 'desktop',
    logicalWidth: 1600,
    logicalHeight: 900
  }
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('viewport profiles', () => {
  it.each(SIZES)(
    'maps $width×$height CSS pixels to $id/$detailLevel without changing the logical world',
    ({ width, height, id, detailLevel, logicalWidth, logicalHeight }) => {
      expect(profileForSize(width, height)).toEqual({
        id,
        width: logicalWidth,
        height: logicalHeight,
        detailLevel
      });
    }
  );

  it('uses the browser dimensions at the viewport seam', () => {
    vi.stubGlobal('window', { innerWidth: 390, innerHeight: 844 });
    expect(profileForViewport()).toEqual({
      id: 'portrait',
      width: 900,
      height: 1600,
      detailLevel: 'mobile'
    });
  });

  it('treats an LOD threshold crossing as a different profile in the same orientation', () => {
    const mobileLandscape = profileForSize(844, 390);
    const tabletLandscape = profileForSize(1024, 768);
    const desktopLandscape = profileForSize(1366, 768);

    expect(mobileLandscape.id).toBe(tabletLandscape.id);
    expect(tabletLandscape.id).toBe(desktopLandscape.id);
    expect(mobileLandscape.width).toBe(tabletLandscape.width);
    expect(mobileLandscape.height).toBe(tabletLandscape.height);
    expect(isSameProfile(mobileLandscape, tabletLandscape)).toBe(false);
    expect(isSameProfile(tabletLandscape, desktopLandscape)).toBe(false);
    expect(isSameProfile(desktopLandscape, profileForSize(1920, 1080))).toBe(true);
  });

  it('preserves orientation as the score-profile identity axis', () => {
    const portrait = profileForSize(390, 844);
    const landscape = profileForSize(844, 390);

    expect(portrait.detailLevel).toBe(landscape.detailLevel);
    expect(portrait.id).not.toBe(landscape.id);
    expect(isSameProfile(portrait, landscape)).toBe(false);
  });
});

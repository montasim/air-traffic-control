import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isSameProfile,
  fittedFieldSize,
  isFieldPlayable,
  shouldPauseForResize,
  needsNewShiftLayout,
  worldSizeForViewport,
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
  it('selects a different layout for a new shift only when orientation changes', () => {
    const active = profileForSize(390, 844);
    for (const [w, h] of [[390, 780], [360, 640], [600, 900], [390, 844]]) {
      expect(needsNewShiftLayout(active, profileForSize(w, h))).toBe(false);
    }
    expect(needsNewShiftLayout(active, profileForSize(844, 390))).toBe(true);
  });

  it('expands the initial world to fill the screen without stretching geometry', () => {
    for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
      const world = worldSizeForViewport(w, h);
      expect(world.width / world.height).toBeCloseTo(w / h);
      const profile = profileForSize(w, h);
      expect(world.width).toBeGreaterThanOrEqual(profile.width);
      expect(world.height).toBeGreaterThanOrEqual(profile.height);
    }
  });
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

describe('active shift resize policy', () => {
  const world = { width: 1600, height: 900 };
  const baseline = { width: 1280, height: 800 };
  it('fits the entire world uniformly with margins', () => {
    expect(fittedFieldSize(world, { width: 800, height: 1000 })).toEqual({ width: 800, height: 450 });
    expect(fittedFieldSize(world, { width: 0, height: 1000 })).toEqual({ width: 0, height: 0 });
  });
  it('pauses at cumulative changes and orientation crossings, not small chrome changes', () => {
    expect(shouldPauseForResize(baseline, { width: 1280, height: 760 }, world)).toBe(false);
    expect(shouldPauseForResize(baseline, { width: 1100, height: 800 }, world)).toBe(false);
    expect(shouldPauseForResize(baseline, { width: 1024, height: 800 }, world)).toBe(true);
    expect(shouldPauseForResize({ width: 810, height: 800 }, { width: 790, height: 800 }, world)).toBe(true);
  });
  it('checks the fitted field rather than viewport alone at the inclusive limit', () => {
    const portrait = { width: 900, height: 1600 };
    expect(isFieldPlayable(portrait, { width: 844, height: 390 })).toBe(false);
    expect(isFieldPlayable(portrait, { width: 844, height: 240 * 1600 / 900 })).toBe(true);
    expect(isFieldPlayable(world, { width: 1280, height: 240 })).toBe(true);
    expect(isFieldPlayable(world, { width: 1280, height: 239 })).toBe(false);
  });
});

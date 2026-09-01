import type { WorldDetailLevel } from './palette';

export type LayoutProfileId = 'portrait' | 'landscape';

export interface ViewportProfile {
  readonly id: LayoutProfileId;
  readonly width: number;
  readonly height: number;
  readonly detailLevel: WorldDetailLevel;
}

export const PORTRAIT_PROFILE: ViewportProfile = {
  id: 'portrait',
  width: 900,
  height: 1600,
  detailLevel: 'desktop'
};

export const LANDSCAPE_PROFILE: ViewportProfile = {
  id: 'landscape',
  width: 1600,
  height: 900,
  detailLevel: 'desktop'
};

export function profileForSize(width: number, height: number): ViewportProfile {
  const logicalProfile = width >= height ? LANDSCAPE_PROFILE : PORTRAIT_PROFILE;
  const minimumDimension = Math.min(width, height);
  const maximumDimension = Math.max(width, height);
  const detailLevel: WorldDetailLevel = minimumDimension < 520
    ? 'mobile'
    : maximumDimension >= 1200 && minimumDimension >= 700
      ? 'desktop'
      : 'tablet';

  return { ...logicalProfile, detailLevel };
}

export function profileForViewport(): ViewportProfile {
  return profileForSize(window.innerWidth, window.innerHeight);
}

export function isSameProfile(
  left: ViewportProfile,
  right: ViewportProfile,
): boolean {
  return left.id === right.id && left.detailLevel === right.detailLevel;
}

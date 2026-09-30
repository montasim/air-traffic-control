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

/** Expand once at creation; FIT then keeps this world stable through display resizes. */
export function worldSizeForViewport(width: number, height: number) {
  const profile = profileForSize(width, height);
  const scale = Math.min(width / profile.width, height / profile.height);
  return { width: width / scale, height: height / scale };
}

export function needsNewShiftLayout(active: ViewportProfile, next: ViewportProfile): boolean {
  return active.id !== next.id;
}

export interface ViewportSize { readonly width: number; readonly height: number }

export function fittedFieldSize(world: ViewportSize, available: ViewportSize): ViewportSize {
  const scale = Math.max(0, Math.min(available.width / world.width, available.height / world.height));
  return { width: world.width * scale, height: world.height * scale };
}

export function isFieldPlayable(world: ViewportSize, available: ViewportSize): boolean {
  const fitted = fittedFieldSize(world, available);
  return Math.min(fitted.width, fitted.height) >= 240 && available.width >= 320 && available.height >= 240;
}

export function shouldPauseForResize(baseline: ViewportSize, next: ViewportSize, world: ViewportSize): boolean {
  return !isFieldPlayable(world, next)
    || (baseline.width >= baseline.height) !== (next.width >= next.height)
    || Math.abs(next.width - baseline.width) >= baseline.width * 0.2
    || Math.abs(next.height - baseline.height) >= baseline.height * 0.2;
}

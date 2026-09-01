import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { RIVER_BEND_PALETTE } from '../../src/game/maps/river-bend';
import { AIRCRAFT_COLORS } from '../../src/game/palette';
import {
  composeStaticMap,
  paintStaticMapLayers,
  type StaticMapPaintContext
} from '../../src/game/rendering/shared-map';

interface TestLayout {
  readonly width: number;
  readonly height: number;
}

function saturation(color: number): number {
  const channels = [color >> 16, (color >> 8) & 0xff, color & 0xff];
  const maximum = Math.max(...channels);
  const minimum = Math.min(...channels);
  return maximum === 0 ? 0 : (maximum - minimum) / maximum;
}

function composerHarness() {
  const graphics = { destroy: vi.fn() } as unknown as Phaser.GameObjects.Graphics;
  const texture = {
    setOrigin: vi.fn(),
    setDepth: vi.fn(),
    draw: vi.fn(),
    render: vi.fn()
  };
  texture.setOrigin.mockReturnValue(texture);
  texture.setDepth.mockReturnValue(texture);
  const scene = {
    add: {
      graphics: vi.fn(() => graphics),
      renderTexture: vi.fn(() => texture)
    }
  } as unknown as Phaser.Scene;
  return { scene, graphics, texture };
}

describe('River Bend layered renderer', () => {
  it('locks static painting to scenery, operational, then detail order', () => {
    const order: string[] = [];
    const context = {
      graphics: {} as Phaser.GameObjects.Graphics,
      layout: { width: 1600, height: 900 },
      detailLevel: 'desktop',
      unit: 900
    } satisfies StaticMapPaintContext<TestLayout>;

    paintStaticMapLayers(context, {
      scenery: (received) => {
        expect(received).toBe(context);
        order.push('scenery');
      },
      operational: (received) => {
        expect(received).toBe(context);
        order.push('operational');
      },
      detail: (received) => {
        expect(received).toBe(context);
        order.push('detail');
      }
    });

    expect(order).toEqual(['scenery', 'operational', 'detail']);
  });

  it('retains legacy one-painter composition for the other maps', () => {
    const harness = composerHarness();
    const paint = vi.fn();

    composeStaticMap(
      harness.scene,
      { width: 800, height: 600 },
      'tablet',
      paint
    );

    expect(paint).toHaveBeenCalledOnce();
    expect(harness.texture.draw).toHaveBeenCalledOnce();
    expect(harness.texture.render).toHaveBeenCalledOnce();
    expect(harness.graphics.destroy).toHaveBeenCalledOnce();
  });

  it('reserves signal colors by keeping every scenery token restrained', () => {
    const signalColors = new Set<number>(Object.values(AIRCRAFT_COLORS));
    for (const color of Object.values(RIVER_BEND_PALETTE)) {
      expect(signalColors.has(color)).toBe(false);
      expect(saturation(color)).toBeLessThanOrEqual(0.36);
    }
  });
});

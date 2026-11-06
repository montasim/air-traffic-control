import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import { withoutAbandonedTexture } from '../../src/game/rendering/shared-map/composer';

describe('withoutAbandonedTexture', () => {
  it('deletes the GPU texture a new dynamic texture made but does not use', () => {
    const existing = { id: 'existing' };
    const deleted: unknown[] = [];
    const renderer = { glTextureWrappers: [existing] as unknown[], deleteTexture: (wrapper: unknown) => { deleted.push(wrapper); renderer.glTextureWrappers.splice(renderer.glTextureWrappers.indexOf(wrapper), 1); } };
    const scene = { sys: { renderer } } as unknown as Phaser.Scene;
    const abandoned = { id: 'abandoned' };
    const used = { id: 'framebuffer' };
    const texture = withoutAbandonedTexture(scene, () => {
      renderer.glTextureWrappers.push(abandoned, used);
      return { source: [{ glTexture: used }] } as unknown as Phaser.Textures.Texture;
    }, (made) => made);
    expect(deleted).toEqual([abandoned]);
    expect(renderer.glTextureWrappers).toEqual([existing, used]);
    expect(texture.source[0].glTexture).toBe(used);
  });

  it('just makes the texture without a WebGL renderer', () => {
    const scene = { sys: {} } as unknown as Phaser.Scene;
    expect(withoutAbandonedTexture(scene, () => 'made', () => ({}) as Phaser.Textures.Texture)).toBe('made');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapId } from '../../src/game/maps/mapIds';

type Draw = { maps: readonly MapId[]; onPreview: (id: MapId, url: string, focus: { x: number; y: number }) => void; onDone?: () => void; stopped: boolean };
const draws: Draw[] = [];
vi.mock('../../src/ui/mapPreviews', () => ({
  createMapPreviews: (onPreview: Draw['onPreview'], options: { maps: readonly MapId[]; onDone?: () => void }) => {
    const draw: Draw = { maps: options.maps, onPreview, onDone: options.onDone, stopped: false };
    draws.push(draw);
    return () => { draw.stopped = true; };
  },
}));
const { createPreviewLibrary } = await import('../../src/ui/previewLibrary');

const settings = { night: false, weather: true, twoEndLanding: false, world: { width: 900, height: 1600 }, detailLevel: 'mobile' as const };
const finish = (draw: Draw) => { for (const id of draw.maps) draw.onPreview(id, `url:${id}`, { x: 0.5, y: 0.5 }); draw.onDone?.(); };

describe('preview library', () => {
  beforeEach(() => { draws.length = 0; });

  it('draws only what is asked for, once, and serves repeats from memory', async () => {
    const shown: string[] = [];
    const library = createPreviewLibrary((id, picture) => shown.push(`${id}=${picture.url}`));
    library.configure(settings);
    await library.request(['saltmarsh-gateway']);
    expect(draws.map((d) => d.maps)).toEqual([['saltmarsh-gateway']]);
    // Asked again while it is still being drawn: no second drawing; the new airfield waits its turn.
    await library.request(['saltmarsh-gateway', 'river-bend']);
    expect(draws).toHaveLength(1);
    finish(draws[0]);
    expect(draws.map((d) => d.maps)).toEqual([['saltmarsh-gateway'], ['river-bend']]);
    finish(draws[1]);
    await library.request(['saltmarsh-gateway', 'river-bend']);
    expect(draws).toHaveLength(2);
    expect(shown).toEqual(['saltmarsh-gateway=url:saltmarsh-gateway', 'river-bend=url:river-bend', 'saltmarsh-gateway=url:saltmarsh-gateway', 'river-bend=url:river-bend']);
  });

  it('waits for an expected picture instead of drawing it, and draws it if none comes', async () => {
    const shown: string[] = [];
    const library = createPreviewLibrary((id, picture) => shown.push(`${id}=${picture.url}`));
    library.configure(settings);
    const deliver = library.expect('saltmarsh-gateway');
    await library.request(['saltmarsh-gateway']);
    expect(draws).toHaveLength(0);
    deliver({ url: 'live', focus: { x: 0.5, y: 0.5 } });
    expect(shown).toEqual(['saltmarsh-gateway=live']);
    const giveUp = library.expect('river-bend');
    await library.request(['river-bend']);
    giveUp();
    await Promise.resolve();
    expect(draws.map((d) => d.maps)).toEqual([['river-bend']]);
  });

  it('stops a drawing for old settings and redraws for the new ones', async () => {
    const shown: string[] = [];
    const library = createPreviewLibrary((id, picture) => shown.push(`${id}=${picture.url}`));
    library.configure(settings);
    await library.request(['saltmarsh-gateway']);
    library.configure({ ...settings, night: true });
    expect(draws[0].stopped).toBe(true);
    // A picture from the stopped drawing is ignored.
    draws[0].onPreview('saltmarsh-gateway', 'stale', { x: 0, y: 0 });
    await library.request(['saltmarsh-gateway']);
    expect(draws).toHaveLength(2);
    finish(draws[1]);
    expect(shown).toEqual(['saltmarsh-gateway=url:saltmarsh-gateway']);
  });
});

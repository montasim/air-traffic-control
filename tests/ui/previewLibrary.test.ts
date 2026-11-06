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
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(draws.map((d) => d.maps)).toEqual([['river-bend']]);
  });

  it('shows pictures the build shipped instead of drawing them', async () => {
    const shown: string[] = [];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ hash: 'x', focus: { 'portrait-day-one-weather': { 'river-bend': { x: 0.4, y: 0.6 } } } })));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const library = createPreviewLibrary((id, picture) => shown.push(`${id}=${picture.url}`));
      library.configure(settings);
      await library.request(['river-bend', 'saltmarsh-gateway']);
      expect(shown).toEqual(['river-bend=/menu-pictures/portrait-day-one-weather/river-bend.jpg']);
      // Only what the build did not ship is drawn on the device.
      expect(draws.map((d) => d.maps)).toEqual([['saltmarsh-gateway']]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('draws on the device when the screen world differs from every shipped one, since layouts change with it', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      const library = createPreviewLibrary(() => {});
      library.configure({ ...settings, world: { width: 900, height: 1951.1 } });
      await library.request(['river-bend']);
      expect(draws.map((d) => d.maps)).toEqual([['river-bend']]);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('lets the live frame replace a picture already shown', async () => {
    const shown: string[] = [];
    const library = createPreviewLibrary((id, picture) => shown.push(`${id}=${picture.url}`));
    library.configure({ ...settings, world: { width: 900, height: 1951.1 } });
    await library.request(['river-bend']);
    finish(draws[0]);
    library.expect('river-bend')({ url: 'live', focus: { x: 0.5, y: 0.5 } });
    expect(shown).toEqual(['river-bend=url:river-bend', 'river-bend=live']);
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

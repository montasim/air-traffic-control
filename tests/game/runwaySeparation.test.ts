import { describe, expect, it } from 'vitest';
import { createSaltmarshGatewayLayout } from '../../src/game/maps/saltmarsh-gateway/layout';
import { createRiverBendLayout } from '../../src/game/maps/river-bend/layout';
import { createDesertParallelLayout } from '../../src/game/maps/desert-parallel/layout';
import { createTwinBanksLayout } from '../../src/game/maps/twin-banks/layout';
import { runwayCorners } from '../../src/game/rendering/shared-map/geometry';

const factories = [createSaltmarshGatewayLayout, createRiverBendLayout, createDesertParallelLayout, createTwinBanksLayout];
describe('runway placement', () => {
  for (const [width, height] of [[1600,900], [900,1600], [900,900], [844,390]]) {
    it(`keeps runway surfaces and shoulders separate at ${width} x ${height}`, () => {
      for (const create of factories) {
        const layout = create(width, height);
        const runways = [...layout.runways, ...('scenicRunways' in layout ? layout.scenicRunways : [])];
        for (const runway of runways) {
          const dx = layout.helipad.center.x - runway.center.x;
          const dy = layout.helipad.center.y - runway.center.y;
          const along = Math.abs(dx * Math.cos(runway.angle) + dy * Math.sin(runway.angle));
          const across = Math.abs(-dx * Math.sin(runway.angle) + dy * Math.cos(runway.angle));
          const clearance = Math.hypot(Math.max(0, along - runway.length / 2), Math.max(0, across - runway.width / 2));
          expect(clearance, `${create.name}: helipad / ${runway.id}`).toBeGreaterThan(layout.helipad.radius * 1.14 + 8);
        }
        for (let i = 0; i < runways.length; i++) {
          for (const second of runways.slice(i + 1)) {
            const first = runways[i];
            const a = runwayCorners(first, 12, 12), b = runwayCorners(second, 12, 12);
            const separated = [first.angle, second.angle].some(angle =>
              [angle, angle + Math.PI / 2].some(axis => {
                const project = (p: {x:number; y:number}) => p.x * Math.cos(axis) + p.y * Math.sin(axis);
                const aa = a.map(project), bb = b.map(project);
                return Math.max(...aa) < Math.min(...bb) || Math.max(...bb) < Math.min(...aa);
              })
            );
            expect(separated, `${create.name}: ${first.id} / ${second.id}`).toBe(true);
          }
        }
      }
    });
  }
});

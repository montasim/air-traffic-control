import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { MAP_DEFINITIONS } = await server.ssrLoadModule('/src/game/maps/registry.ts');
  const { buildMapArt } = await server.ssrLoadModule('/src/game/three/mapArt.ts');
  for (const definition of MAP_DEFINITIONS) {
  const layouts = [];
  for (const [width, height] of [[1600, 900], [900, 1600], [1000, 1000], [2100, 900]]) {
    for (const twoEndLanding of [false, true]) {
      const { layout } = definition.prepare({ width, height, twoEndLanding, detailLevel: 'desktop' });
      layouts.push({ twoEndLanding, layout, artwork: buildMapArt(definition.id,layout) });
    }
  }
  await mkdir(`art/blender/${definition.id}`, { recursive: true });
  await writeFile(`art/blender/${definition.id}/layouts.json`, JSON.stringify({
    schema: 1, coordinates: 'world units; x right, y down; angles clockwise from +x', layouts,
  }, null, 2) + '\n');
  console.log(`Exported ${layouts.length} final prepared ${definition.id} layouts.`);
  }
} finally { await server.close(); }

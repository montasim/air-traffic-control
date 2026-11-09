import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { MAP_IDS } from '../src/game/maps/mapIds.ts';

/**
 * Draws the menu's airfield pictures once, at build time, into public/menu-pictures, so phones show
 * files instead of drawing every map themselves. Skipped when the map art has not changed since the
 * last run. Without a browser it warns and leaves the game to draw pictures on the device as before.
 */
const OUT = 'public/menu-pictures';
const SOURCES = ['src/game', 'src/ui/mapPreviews.ts', 'src/ui/previewImage.ts', 'src/ui/shippedPictures.ts', 'public/assets'];

const files = (path) => statSync(path).isDirectory() ? readdirSync(path).sort().flatMap((name) => files(join(path, name))) : [path];
const hash = createHash('sha256');
for (const file of SOURCES.flatMap(files)) hash.update(file).update(readFileSync(file));
const digest = hash.digest('hex').slice(0, 16);

const manifestPath = join(OUT, 'manifest.json');
if (existsSync(manifestPath) && JSON.parse(readFileSync(manifestPath, 'utf8')).hash === digest) {
  console.log('Menu pictures are up to date.');
  process.exit(0);
}

async function launch() {
  for (const options of [{}, { channel: 'msedge' }, { channel: 'chrome' }]) {
    try { return await chromium.launch(options); } catch { /* try the next browser */ }
  }
  return undefined;
}
const browser = await launch();
if (!browser) {
  console.warn('Menu pictures: no browser found, so phones will draw them. Run `npx playwright install chromium` to ship them.');
  process.exit(0);
}

const server = await createServer({ logLevel: 'error', server: { port: 0 } });
await server.listen();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${server.resolvedUrls.local[0]}scripts/menu-pictures.html`);
  await page.waitForFunction(() => typeof window.drawSet === 'function');
  rmSync(OUT, { recursive: true, force: true });
  const focus = {};
  for (const set of await page.evaluate(() => window.sets())) {
    const pictures = await page.evaluate((name) => window.drawSet(name), set);
    if (pictures.length !== MAP_IDS.length || MAP_IDS.some(id => !pictures.some(picture => picture.id === id))) {
      throw new Error(`Menu pictures: incomplete ${set}; expected all ${MAP_IDS.length} maps`);
    }
    mkdirSync(join(OUT, set), { recursive: true });
    focus[set] = {};
    for (const { id, url, focus: point } of pictures) {
      writeFileSync(join(OUT, set, `${id}.jpg`), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
      focus[set][id] = point;
    }
    console.log(`Menu pictures: ${set} (${pictures.length})`);
  }
  if (errors.length) throw new Error(`Drawing failed: ${errors.join('; ')}`);
  writeFileSync(manifestPath, JSON.stringify({ hash: digest, focus }));
} finally {
  await browser.close();
  await server.close();
}

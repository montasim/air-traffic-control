import { chromium } from '@playwright/test';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../desktop/build/', import.meta.url));
await mkdir(`${output}/appx`, { recursive: true });
const logo = (await readFile(new URL('../public/icon.png', import.meta.url))).toString('base64');
await mkdir(new URL('../build/icons/', import.meta.url), { recursive: true });
await copyFile(new URL('../public/icon.png', import.meta.url), new URL('../build/icons/512x512.png', import.meta.url));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, width, height] of [
    ['StoreLogo', 50, 50], ['Square44x44Logo', 44, 44],
    ['Square150x150Logo', 150, 150], ['Wide310x150Logo', 310, 150], ['icon', 256, 256],
  ]) {
    await page.setViewportSize({ width, height });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:#254039}body{display:grid;place-items:center}img{width:${Math.min(width, height)}px;height:${height}px}</style><img src="data:image/png;base64,${logo}">`);
    await page.locator('img').evaluate((image) => image.decode());
    const png = await page.screenshot();
    if (name !== 'icon') await writeFile(`${output}/appx/${name}.png`, png);
    else {
      // ICO supports a PNG payload; zero width/height represents 256 pixels.
      const header = Buffer.alloc(22);
      header.writeUInt16LE(1, 2);
      header.writeUInt16LE(1, 4);
      header.writeUInt16LE(1, 10);
      header.writeUInt16LE(32, 12);
      header.writeUInt32LE(png.length, 14);
      header.writeUInt32LE(22, 18);
      await writeFile(`${output}/icon.ico`, Buffer.concat([header, png]));
    }
  }
} finally {
  await browser.close();
}

import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Every Android icon is rendered from the vector master, so each density is drawn at its own size.
const res = fileURLToPath(new URL('../android/app/src/main/res/', import.meta.url));
const playArt = fileURLToPath(new URL('../art/google-play/', import.meta.url));
const logo = await readFile(new URL('../art/brand/logo.svg', import.meta.url), 'utf8');
const background = logo.match(/<rect width="512" height="512" fill="(#[0-9a-f]{6})"\/>/i)[1].toUpperCase();
const artOnly = logo.replace(/\s*<rect width="512" height="512"[^>]*\/>/, '');
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
// Adaptive icons expose only the central 66 of 108dp; scaling keeps the route dot inside round masks.
const ADAPTIVE_ART_SCALE = 0.58;
const LEGACY_ART_SCALE = 0.86;
// The launch splash icon is 288dp and Android masks it to a 192dp circle; the route dot must stay inside.
const SPLASH_ART_SCALE = 0.6;
// Centre of the mark within the 512 artboard; the splash centres this point, not the artboard.
const ART_CENTER = [255, 236];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined) });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const dataUrl = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg.replace('<svg ', '<svg width="512" height="512" ')).toString('base64')}`;
  await page.setContent(`<img id="full" src="${dataUrl(logo)}"><img id="art" src="${dataUrl(artOnly)}">`);
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));

  const render = (size, variant) => page.evaluate(([size, variant, background, scales, center]) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    // SVG sources rasterize at the destination size, so no bitmap is ever scaled up.
    const draw = (id, scale, focus = [256, 256]) => {
      const drawn = size * scale;
      const unit = drawn / 512;
      context.drawImage(document.getElementById(id), size / 2 - focus[0] * unit, size / 2 - focus[1] * unit, drawn, drawn);
    };

    if (variant === 'legacy' || variant === 'round') {
      context.beginPath();
      if (variant === 'round') context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      else context.roundRect(0, 0, size, size, size * 0.18);
      context.clip();
      context.fillStyle = background;
      context.fillRect(0, 0, size, size);
      draw('art', scales.legacy);
    } else if (variant === 'play') {
      draw('full', 1);
    } else if (variant === 'splash') {
      draw('art', scales.splash, center);
    } else {
      draw('art', scales.adaptive);
      if (variant === 'monochrome') {
        // Themed icons use alpha only, so the whole mark becomes one solid glyph.
        const pixels = context.getImageData(0, 0, size, size);
        for (let i = 0; i < pixels.data.length; i += 4) pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
        context.putImageData(pixels, 0, 0);
      }
    }
    return canvas.toDataURL('image/png').split(',')[1];
  }, [size, variant, background, { legacy: LEGACY_ART_SCALE, adaptive: ADAPTIVE_ART_SCALE, splash: SPLASH_ART_SCALE }, ART_CENTER]);

  const write = async (path, size, variant) => writeFile(path, Buffer.from(await render(size, variant), 'base64'));
  for (const [density, scale] of Object.entries(densities)) {
    for (const folder of [`${res}/mipmap-${density}`, `${res}/drawable-${density}`]) await mkdir(folder, { recursive: true });
    for (const [name, variant, dp] of [
      ['ic_launcher', 'legacy', 48], ['ic_launcher_round', 'round', 48],
      ['ic_launcher_foreground', 'foreground', 108], ['ic_launcher_monochrome', 'monochrome', 108],
    ]) {
      await write(`${res}/mipmap-${density}/${name}.png`, Math.round(dp * scale), variant);
    }
    await write(`${res}/drawable-${density}/splash_logo.png`, Math.round(288 * scale), 'splash');
  }

  await writeFile(`${res}/values/ic_launcher_background.xml`,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${background}</color>\n</resources>\n`);

  await mkdir(playArt, { recursive: true });
  await write(`${playArt}/icon-512.png`, 512, 'play');
  console.log(`Android icons and splash written with background ${background}.`);
} finally {
  await browser.close();
}

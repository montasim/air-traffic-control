import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build, Platform, Arch } from 'electron-builder';

export async function prepareSnapManifest() {
  // electron-builder 26.15.3 points at the final meta/gui path before it exists.
  // Snapcraft automatically imports snap/gui/*.desktop, as in ISPCine's Snap.
  const manifest = resolve('release/__snap-amd64/snap/snapcraft.yaml');
  const source = await readFile(manifest, 'utf8');
  const line = '    desktop: meta/gui/air-traffic-control.desktop\n';
  if (/^    desktop:/m.test(source) && !source.includes(line)) {
    throw new Error('Snap launcher layout changed; review this workaround.');
  }
  const metadata = JSON.parse(await readFile('package.json', 'utf8'));
  const fields = {
    license: metadata.license,
    contact: metadata.bugs.url,
    issues: metadata.bugs.url,
    'source-code': metadata.repository.url.replace(/^git\+/, '').replace(/\.git$/, ''),
    website: metadata.homepage
  };
  let updated = source.replace(line, '');
  for (const [key, value] of Object.entries(fields)) {
    if (!new RegExp(`^${key}:`, 'm').test(updated)) updated += `${key}: ${JSON.stringify(value)}\n`;
  }
  await writeFile(manifest, updated);
  return fields;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await build({
    config: 'electron-builder.yml',
    targets: Platform.LINUX.createTarget(['snap'], Arch.x64),
    publish: 'never',
    effectiveOptionComputed: async (options) => {
      if (options.snap) {
        Object.assign(options.snap, await prepareSnapManifest());
        delete options.snap.apps['air-traffic-control'].desktop;
      }
      return false;
    }
  });
}

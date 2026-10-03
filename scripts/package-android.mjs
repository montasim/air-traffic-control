import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Builds the signed Play bundle after `npm run android:sync` has copied the web build in.
const android = fileURLToPath(new URL('../android/', import.meta.url));
if (!existsSync(`${android}/keystore.properties`)) {
  console.error('Missing android/keystore.properties; copy keystore.properties.example and point it at the upload key.');
  process.exit(1);
}

const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const result = spawnSync(gradle, ['bundleRelease'], { cwd: android, stdio: 'inherit', shell: process.platform === 'win32' });
if (result.status !== 0) process.exit(result.status ?? 1);

const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const output = fileURLToPath(new URL('../release/android/', import.meta.url));
await mkdir(output, { recursive: true });
const target = `${output}AirTrafficControl-${version}.aab`;
await copyFile(`${android}/app/build/outputs/bundle/release/app-release.aab`, target);
console.log(`Play bundle: ${target}`);

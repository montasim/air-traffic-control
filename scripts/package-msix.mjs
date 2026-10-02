import { copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const storeTitle = 'Sky Routes: Air Traffic Control';

export function storeConfiguration(environment = process.env, testIdentity = false) {
  const identityName = testIdentity ? 'AirTrafficControl.LocalTest' : environment.ATC_STORE_IDENTITY_NAME ?? 'MohammadMontasimAlMamunSh.SkyRoutesAirTrafficContr';
  const publisher = testIdentity ? 'CN=Air Traffic Control Local Test' : environment.ATC_STORE_PUBLISHER ?? 'CN=48008124-07D3-463D-AADF-955ABE8DDE30';
  const publisherDisplayName = testIdentity ? 'Local Test' : environment.ATC_STORE_PUBLISHER_DISPLAY_NAME ?? 'Mohammad Montasim Al Mamun Shuvo';
  if (![identityName, publisher, publisherDisplayName].every((value) => value?.trim())) {
    throw new Error('Set ATC_STORE_IDENTITY_NAME, ATC_STORE_PUBLISHER, and ATC_STORE_PUBLISHER_DISPLAY_NAME from Partner Center Product identity. Use --test-identity only to verify packaging locally.');
  }
  return {
    appId: 'dev.montasim.airtrafficcontrol',
    productName: storeTitle,
    artifactName: 'SkyRoutes-${version}-x64.${ext}',
    asar: true,
    npmRebuild: false,
    directories: { buildResources: join(root, 'desktop', 'build'), output: join(root, 'release', testIdentity ? 'local-test' : 'windows-store') },
    files: ['dist-desktop/**/*', '!dist-desktop/**/*.map', 'electron/main.cjs', 'build/icons/512x512.png', 'package.json', '!node_modules/**/*'],
    extraMetadata: { main: 'electron/main.cjs', dependencies: {} },
    appx: {
      applicationId: 'AirTrafficControl',
      identityName,
      publisher,
      publisherDisplayName,
      displayName: storeTitle,
      backgroundColor: '#254039',
      languages: ['en-US'],
      minVersion: '10.0.19041.0',
      maxVersionTested: '10.0.26100.0',
      capabilities: ['runFullTrust'],
      showNameOnTiles: true,
      setBuildNumber: false,
    },
    win: { icon: join(root, 'desktop', 'build', 'icon.ico'), target: [{ target: 'appx', arch: ['x64'] }] },
    toolsets: { winCodeSign: '1.1.0' },
    publish: null,
  };
}

export async function packageMsix() {
  const config = storeConfiguration(process.env, process.argv.includes('--test-identity'));
  if (process.platform !== 'win32') throw new Error('Build MSIX on Windows.');
  process.env.ELECTRON_BUILDER_CACHE ??= join(tmpdir(), 'atc-eb');
  const { build, Platform, Arch } = await import('electron-builder');
  const artifacts = await build({ projectDir: root, config, targets: Platform.WINDOWS.createTarget(['appx'], Arch.x64) });
  const packages = artifacts.filter((file) => file.endsWith('.appx'));
  if (packages.length !== 1) throw new Error(`Expected one AppX package, received ${packages.length}.`);
  const destination = packages[0].replace(/\.appx$/, '.msix');
  await copyFile(packages[0], destination);
  console.log(`\n${process.argv.includes('--test-identity') ? 'LOCAL TEST ONLY — do not submit to Store' : 'Store upload package'}:\n${destination}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await packageMsix();

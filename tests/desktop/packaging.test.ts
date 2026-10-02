import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
// @ts-expect-error Node packaging modules are tested directly, outside the browser TS build.
import { storeConfiguration } from '../../scripts/package-msix.mjs';
// @ts-expect-error Node host module is tested directly.
import { resolveAsset } from '../../desktop/assets.mjs';

describe('Windows desktop packaging', () => {
  it('uses the registered Store identity and keeps test builds separate', () => {
    const registered = storeConfiguration({});
    expect(registered.appx.identityName).toBe('MohammadMontasimAlMamunSh.SkyRoutesAirTrafficContr');
    expect(registered.appx.publisher).toBe('CN=48008124-07D3-463D-AADF-955ABE8DDE30');
    expect(registered.appx.publisherDisplayName).toBe('Mohammad Montasim Al Mamun Shuvo');
    expect(registered.appx.displayName).toBe('Sky Routes: Air Traffic Control');
    expect(registered.appx.setBuildNumber).toBe(false);
    const test = storeConfiguration({}, true);
    expect(test.appx.identityName).toBe('AirTrafficControl.LocalTest');
    expect(test.directories.output).toMatch(/local-test$/);
    const store = storeConfiguration({ ATC_STORE_IDENTITY_NAME: 'Example.Game', ATC_STORE_PUBLISHER: 'CN=Example', ATC_STORE_PUBLISHER_DISPLAY_NAME: 'Example' });
    expect(store.appx.identityName).toBe('Example.Game');
    expect(store.appx.publisher).toBe('CN=Example');
    expect(store.directories.output).toMatch(/windows-store$/);
    expect(store.appx.capabilities).toEqual(['runFullTrust']);
    expect(store.extraMetadata.main).toBe('electron/main.cjs');
    expect(store.files).toContain('dist-desktop/**/*');
    expect(store.files).not.toContain('dist/**/*');
    expect(() => storeConfiguration({ ATC_STORE_IDENTITY_NAME: ' ' })).toThrow('Partner Center');
  });

  it('only serves game assets inside the bundled directory', () => {
    const root = resolve('dist');
    expect(resolveAsset(root, 'atc://game/')).toBe(resolve(root, 'index.html'));
    expect(resolveAsset(root, 'atc://game/assets/game.js')).toBe(resolve(root, 'assets/game.js'));
    for (const url of ['https://game/index.html', 'atc://other/index.html', 'atc://game/%2e%2e%2fsecret', 'atc://game/..%5csecret', 'atc://game/%00']) {
      expect(resolveAsset(root, url)).toBeNull();
    }
  });
});

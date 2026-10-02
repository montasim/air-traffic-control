# Microsoft Store release (Windows x64)

## Update prepared October 2, 2026

- Version: 0.1.3 (MSIX 0.1.3.0), following the live 0.1.1.0 package.
- Artifact: `release/windows-store/SkyRoutes-0.1.3-x64.msix`.
- Update draft: submission `1152921505702030148` for product `9N5536ZQ2XZM`.
- Validation: 416 tests passed; desktop build and desktop smoke test passed,
  including gameplay, resize/resume, renderer isolation, and saved settings.
- Resolved stash conflicts by keeping upstream 0.1.3 and its favicon/PWA icons,
  while retaining the Windows MSIX scripts and registered Store identity.
- User will review and submit manually. Do not submit for certification.
- Partner Center validated and saved 0.1.3.0 in the draft. Release notes,
  the runway-option feature bullet, the current desktop home screenshot,
  and certification testing instructions were updated. Pricing, ratings,
  remaining artwork, and existing publishing settings were retained.

Release notes: Optional landings at both runway ends with a saved preference;
active shifts survive window resizing; practice routes clear after landing;
refreshed start, help, and support screens; consistent airplane branding.

The desktop edition bundles the game in Electron, following ISPCine's
electron-builder AppX/MSIX approach. It plays offline from first launch and
stores progress in the desktop app's own IndexedDB. Browser saves are separate.
Updates come from Microsoft Store; the desktop edition does not register the
web service worker or load the hosted website.

## Registered product

The Windows Store title is **Sky Routes: Air Traffic Control**. The packaging
script defaults to the registered Partner Center identity:

- Package/Identity/Name: `MohammadMontasimAlMamunSh.SkyRoutesAirTrafficContr`
- Package/Identity/Publisher: `CN=48008124-07D3-463D-AADF-955ABE8DDE30`
- Publisher display name: `Mohammad Montasim Al Mamun Shuvo`

Trailing HTML space entities from the copied values are not part of the identity.
The `ATC_STORE_IDENTITY_NAME`, `ATC_STORE_PUBLISHER`, and
`ATC_STORE_PUBLISHER_DISPLAY_NAME` environment variables can override these values.

## Build

Use Windows, Node.js 24, and npm 11:

```powershell
npm ci
npm test
npm run package:msix
```

Upload `release/windows-store/SkyRoutes-0.1.3-x64.msix` to the
submission's **Packages** page. Version comes from `package.json`; increment it
for subsequent submissions. The fourth Windows
version component is reserved for the Store and stays zero. Electron-builder produces the equivalent AppX
container, which the script copies to `.msix`, as in ISPCine.
The Store signs the accepted package; no paid signing certificate is needed.
An unsigned upload package is not a normal double-click installer.

To verify packaging with a separate local test identity:

```powershell
npm run package:msix -- --test-identity
```

This writes to `release/local-test/` using an explicitly fake identity.
**Do not upload this test package.** Production builds use the registered identity above.

Launch the desktop game locally with `npm run desktop`. Both Windows and Linux
use `electron/main.cjs` and `dist-desktop/`. The MSIX is x64 and
declares Windows 10 build 19041 or newer. Test the final Store flight on the
Windows versions you intend to support before publishing.

The Windows icons are rendered from `public/icon.png`, the same airplane logo
used on the Microsoft Store. The desktop window uses `build/icons/512x512.png`.
To refresh the Windows package icons:

```powershell
npx playwright install chromium
npm run icons:windows
```

## Submission checklist

### Partner Center submission status (September 29, 2026)

Game product `9N5536ZQ2XZM`, submission `1152921505702003159`, is **In certification**
(pre-processing). It will publish automatically after passing certification.

- Registered as **MSIX or PWA game**; category Games, genres Simulation and Strategy.
- Packages: `SkyRoutes-1.0.0-x64.msix`, version 1.0.0.0, x64; validated and complete.
- Identity name, publisher, and publisher display name match the registered values above.
- English (United States) listing: description, four features, short description,
  developer name, and four screenshots; complete.
- Pricing and availability: free, worldwide, public and discoverable; complete.
- Properties: single-player PC, support links, privacy policy text; complete.
- Age ratings: complete, including ESRB Everyone (Mild Fantasy Violence),
  PEGI 7 (Mild Violence), and IARC 7+. User confirmed IARC agreement and legal age.
- Notes for certification: saved and verified, including offline testing instructions
  and the reason for `runFullTrust`.

The old app product `9PHFTW90GM6W` and its draft were deleted with user confirmation.
The new game retained the same package identity. The old listing export is preserved
in `art/microsoft-store/old-app-listing-backup.csv`.

Store screenshots are in `art/microsoft-store/`. Certification proof is in
`test-results/game-in-certification.png`.

### Before certification

1. Upload the package built with the game's exact Product identity.
2. Complete pricing, markets, game category, age ratings, and product declarations.
3. Add the description below, actual desktop screenshots, Store artwork,
   support URL, and an accurate publicly accessible privacy policy URL.
4. Explain `runFullTrust` if requested: “Air Traffic Control is a packaged
   Electron desktop game. Full trust is required to launch the Electron host.
   The game stores progress locally and does not require administrator access.”
5. Test a private Store flight: launch, practice, all difficulty selections,
   sound, pause/resume, resize, close/relaunch with preserved progress, offline
   launch, and an update that preserves existing saves. Run the Windows App
   Certification Kit on the final package where available.
6. Review the listing and submit for certification in Partner Center.

## Local verification (1.0.0, September 29, 2026)

Using Node.js 24, all 324 tests and the desktop build passed with the latest
game changes. The registered-identity MSIX was built successfully; its identity,
publisher, publisher display name, Store title, version, and bundled application
were verified. The packaged executable passed the desktop smoke check:
startup, local assets, renderer isolation, gameplay, resize/resume with stable
world and score, and settings saved across restart.
Screenshot: `test-results/desktop-home.png`.

This verifies the unpacked executable produced by the package build. MSIX
installation, Store updates, Windows App Certification Kit validation, and
Partner Center certification remain to be tested with the final identity.

### Suggested listing

**Short description:** Draw flight paths, land aircraft, and keep the skies safe.

Guide airliners, commuters, and helicopters to their matching destinations in
an arcade air traffic control game. Draw routes with a mouse, touch, or pen,
keep aircraft apart, and see how many you can land safely.

- Nine airfields, from coastal runways to busy international and rescue airports.
- Three difficulty levels for relaxed practice or demanding shifts.
- Local career progression, seven ranks, and nine achievements.
- Offline play, adjustable sound, and locally saved records.
- No account required.

**Support:** https://github.com/montasim/air-traffic-control/issues

**Certification notes:** No account, login, purchase, or server is needed. Launch
the game, select an airfield and difficulty, then select Play. How to play
includes a practice flight. Draw aircraft routes with a pointer. Progress is
stored locally; cloud save and save import/export are not available.

## References

- [Microsoft package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements)
- [Upload packages to Partner Center](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/upload-app-packages)
- [Store signing](https://learn.microsoft.com/en-us/windows/msix/package/sign-msix-package-guide)
- [Electron-builder AppX configuration](https://www.electron.build/docs/appx/)

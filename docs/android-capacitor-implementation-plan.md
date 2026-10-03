# Android app with Capacitor

Date: 2026-10-03

Status: Phases 1–4, 6 (build side), and 8 implemented on 2026-10-03; debug
APK verified on an emulator. Full device QA (Phase 5) and Play Console (Phase 7) remain. The
plan was revised the same day against 0.1.4 (commit `e3250f7`).

## Implementation record

The release procedure is in [android-release.md](android-release.md). Changes
from the plan below:

- **Mode checks stay inline.** A shared `src/app/platform.ts` flag broke the
  web build: Vite only drops `import("virtual:pwa-register")` when the
  `import.meta.env.MODE` comparison is written at the import site.
  `src/main.ts` and `src/bootstrap.ts` therefore check `MODE` directly. The web
  and desktop bundles contain no Android code; the only "capacitor" strings in
  them are Phaser's built-in URL handling.
- **Back from a paused shift goes to the background.** The plan kept the
  app on the pause panel. That left players stuck on a screen where back did
  nothing, so back now only pauses a *running* shift, and from any root screen
  (start, pause, game over) it minimizes the app. It still never resumes play.
- **No status-bar or assets plugins.** Capacitor 8 handles edge-to-edge
  itself (`SystemBars.insetsHandling: 'native'`, with a `cover` hint), so
  the existing `env(safe-area-inset-*)` padding applies. `@capacitor/assets`
  needed an old `sharp` build that npm's install-script policy blocked, so
  `scripts/generate-android-icons.mjs` renders the icons with Playwright,
  like `generate-windows-icons.mjs`. The source is `public/icon.png`, because
  the maskable PNG has a faint inner square that showed through. The launch
  splash is the androidx splash theme: the adaptive foreground on its
  background color. The Capacitor placeholder splash images were removed.
- **The version comes from Gradle.** `android/app/build.gradle` reads
  `package.json` directly, so no sync script rewrites it.
- **No permissions.** The `INTERNET` permission was removed; the game is
  bundled and outbound links open in the system browser.
- **No source maps in the Android build** (about 12 MB saved).
- **Whole blocks hidden:** `#start-panel .home-stores` (an ID selector beats
  the start-panel rule) and `.utility-support`, both through
  `:root[data-platform="android"]`.
- **JDK 21 required.** Capacitor 8 compiles Java 21, and Gradle 8.14.3 fails
  on Android Studio's bundled JDK 25 ("Unsupported class file major version
  69"). Temurin 21 was installed; `assembleDebug` with it produced a 7.1 MB APK.

Verification so far: `npm test` (416 passed), `npm run build`,
`npm run build:desktop`, and `npm run build:android` pass. A 375×812 preview
of `dist-android` showed the centered home screen without store badges and
Settings without the support section, with no service worker registered.

Emulator check (Pixel 6, API 35, WebView Chrome 124, debug APK), with app state
read over WebView remote debugging:

- The branded splash hands off to the boot screen; the home screen loads in
  landscape and portrait. Portrait matches the web mobile layout. The camera
  cutout, status bar, and gesture bar stay clear; Chrome 124 is below 140, so
  Capacitor pads the WebView natively.
- Back closes Settings, pauses a running shift, closes the leave-shift dialog,
  and on the pause panel moves the app to the launcher. Reopening it returns
  to the paused shift.
- `data-platform="android"` is set, the store block is hidden, and no service
  worker controls the page.

Still open: a low-end physical phone, a full shift with touch drawing, audio,
saves across reinstall, and airplane mode (see `android-release.md`).

## Goal

Release the game on Google Play as a native Android app. The app wraps the
existing Vite + Phaser build in Capacitor, so the web, Electron, and Android
editions share a single codebase. Like the desktop edition, the Android app
plays offline from first launch. It keeps progress in its own IndexedDB, and
updates arrive through Play, never from the hosted website.

## Why Capacitor fits

- The game code in `src/` has no Electron or Node dependency.
  `electron/main.cjs` only serves `dist-desktop` from a custom protocol, so
  the same bundle runs unchanged in an Android WebView.
- Phone support already exists. There are `mobile` and `tablet` world detail
  levels (`src/game/palette.ts`), pointer-based route drawing, safe-area
  insets in `src/styles.css`, and `viewport-fit=cover` in `index.html`.
- The home screen has a dedicated phone layout (`@media (max-width: 700px)` and
  `(max-width: 360px)` in `src/styles.css`). It is map-first and centered,
  pads the start panel with `env(safe-area-inset-*)`, and keeps touch targets
  at least 44px tall. That is already what an Android launch screen needs.
- The game already pauses on resize and orientation changes, and on
  `visibilitychange` it pauses and suspends audio (`src/main.ts`).
- Saves use IndexedDB (`src/storage/persistence.ts`). The Android WebView keeps
  IndexedDB in app-private storage, and Android Auto Backup copies it.
- `index.html` loads no remote assets at runtime. The only absolute URLs are
  SEO/social metadata and outbound links.

## Decisions

| Topic | Decision |
| --- | --- |
| Package ID | `dev.montasim.airtrafficcontrol`, matching `electron-builder.yml`. It cannot be changed after the first Play upload. |
| Play title | **Sky Routes: Air Traffic Control**, matching the Microsoft Store title (confirm before the listing). |
| Build mode | New Vite mode `android`, output to `dist-android/`. |
| Service worker | Not registered in `android` mode, the same as `desktop`. |
| Orientation | Unlocked. The game supports any orientation and has resize/resume handling. |
| Other store links | Hidden on Android (Microsoft Store, Snap Store badges). |
| Support/donation link | Hidden on Android, because Play's payments policy makes external donation links risky. Revisit after launch. |
| `android/` project | Committed to git. Capacitor generates it once, and later native edits live there. |
| Signing | Play App Signing, with a local upload keystore kept outside the repo. |

## Phase 1: Build mode and web-side gating

1. `vite.config.ts`: leave out `VitePWA` for both `desktop` and `android`
   (currently only `mode === 'desktop'`).
2. Add one shared flag for packaged builds, e.g. `src/app/platform.ts`:
   ```ts
   export const isAndroidApp = import.meta.env.MODE === 'android';
   export const isPackagedApp = isAndroidApp || import.meta.env.MODE === 'desktop';
   ```
   Use it in `src/main.ts` around the `virtual:pwa-register` import instead of
   the `MODE !== "desktop"` check.
3. On Android, hide two whole blocks rather than individual links:
   - `nav.home-stores` (`index.html` around line 198), which contains the store
     intro line and both store badges. On phones it is the last flex item
     (`order: 3`) in the map-first home layout, so hiding it leaves no gap.
   - `section#utility-support` (around line 412), which contains the
     "Enjoying the game?" text and the SupportKori button.

   Use a `data-platform="android"` attribute on `<html>`, set in
   `bootstrap.ts`, plus `display: none` rules in CSS. That way the markup
   stays the same for every edition. Check that the utility pages still look
   balanced without the support footer.
4. `package.json` scripts:
   - `build:android`: `tsc --noEmit && vite build --mode android --outDir dist-android`
   - `android:sync`: `npm run build:android && cap sync android`
   - `android:open`: `cap open android`
   - `package:android`: build, sync, then `gradlew bundleRelease` (see Phase 6)
5. `.gitignore`: add `dist-android/`, `*.keystore`, `*.jks`, and
   `android/keystore.properties`.

## Phase 2: Capacitor scaffolding

1. Install the current Capacitor major version, with exact pins to match the repo's
   existing dependency style:
   - dependencies: `@capacitor/core`, `@capacitor/android`, `@capacitor/app`,
     `@capacitor/browser`, `@capacitor/splash-screen`, `@capacitor/status-bar`
   - devDependencies: `@capacitor/cli`, `@capacitor/assets`
2. Add `capacitor.config.ts`:
   - `appId: 'dev.montasim.airtrafficcontrol'`
   - `appName: 'Air Traffic Control'` (the launcher label; keep it short)
   - `webDir: 'dist-android'`
   - `android.backgroundColor: '#254039'`
   - splash screen: background `#254039`, auto-hide after the first frame
   - no `server.url` (always load the bundled assets)
3. Run `npx cap add android` and commit the generated `android/` project.
4. Confirm that the generated project's `minSdk`, `compileSdk`, and `targetSdk`
   meet Play's current target-API requirement (check in Play Console at
   release time).
5. `AndroidManifest.xml`: no permissions beyond what Capacitor adds. The game
   needs no network access at runtime, but the outbound links in Phase 3
   only open the system browser.

## Phase 3: Native integration

Load Capacitor plugins with dynamic imports inside `if (isAndroidApp)`
blocks. This keeps them out of the web and desktop bundles.

1. **Hardware back button** (`@capacitor/app` `backButton`). Move the
   Escape handler in `src/main.ts` (around line 768) into a shared
   `handleBackIntent()` and call it from both places:
   - open `<dialog>` → close it (Escape currently skips these, because native
     dialogs close themselves)
   - open `.menu-more` → close it
   - utility screen visible → `history.back()` (these screens already use
     `#hash` history, around line 938)
   - shift running → pause; shift paused → stay paused (do **not** resume on
     back, so a stray back press never restarts play)
   - start panel with nothing open → `App.minimizeApp()`
2. **Lifecycle**: keep relying on `visibilitychange`, and test that it fires
   in the WebView on app switch, screen lock, and incoming calls. If it doesn't,
   also listen for `App` `pause` and call the same handler.
3. **External links**: on Android, intercept clicks on `a[target="_blank"]`
   and open them with `Browser.open({ url })`. With the store and support
   links hidden, this mainly covers any remaining outbound links (repository,
   credits). The WebView must never navigate away from the bundled app.
4. **System bars**: Android 15+ forces edge-to-edge for apps targeting it.
   Test whether the existing `env(safe-area-inset-*)` values come through
   the WebView. If they don't, use the Capacitor edge-to-edge/system-bars
   support or set the insets as CSS variables from native. Hide the status bar during a
   running shift so the play area gets the full screen (optional, decide
   after device testing).
5. **Keep the screen awake** during a running shift (optional; needs a
   community plugin or a small native `FLAG_KEEP_SCREEN_ON` toggle).

## Phase 4: Icons, splash, and branding

1. Create the source art in `art/android/`: a 1024×1024 icon foreground on a
   transparent background, a background color of `#254039`, and a splash logo.
   Reuse the airplane mark from `public/app-icon-airplane-maskable-512.png`
   or its vector source.
2. Generate adaptive and legacy launcher icons and splash assets with
   `npx capacitor-assets generate --android`.
3. Check the icon on round, squircle, and themed (monochrome) launchers.
   Provide a monochrome layer so the icon looks right with Android 13+ themed icons.

## Phase 5: Device QA

Use an emulator and at least one real low-end phone. Connect remote
debugging with `chrome://inspect`.

- The home screen matches the web mobile layout: centered and map-first, with
  the title on one line, no store or support blocks, and nothing hidden
  under the status bar, display cutout, or gesture bar. Check widths of
  360px and below as well as 361–700px.
- Every airfield loads and is playable in portrait and landscape. Detail
  level resolves to `mobile` on phones and `tablet` on tablets.
- Route drawing with touch: accuracy, drawing a new route mid-flight, and
  `pointercancel` from edge gestures. Android's back gesture can steal
  swipes that start near the screen edge.
- Rotation and split-screen pause the game and resume it with the shift intact
  (same behavior as `npm run test:resize`).
- Audio starts after the first tap, stops on app switch, and the volume
  controls change media volume.
- Career, settings, and runway preference survive force-stop, a reboot,
  and an app update installed over the previous version.
- Back button works on every screen (see Phase 3).
- No outbound navigation, no service worker, and no network requests
  (check with airplane mode on).
- Frame rate and battery use stay acceptable after a 10-minute session on
  the low-end phone.
- Run the existing suites first: `npm test`, `npm run build`, and
  `npm run build:android`.

## Phase 6: Release build and signing

1. Create an upload keystore outside the repo. Reference it from
   `android/keystore.properties` (gitignored), and read that file in
   `android/app/build.gradle` for the release `signingConfig`.
2. Keep the version in sync with `package.json`. Add
   `scripts/sync-android-version.mjs`, which writes `versionName` (currently `0.1.4`)
   and a monotonically increasing `versionCode` (e.g.
   `major*10000 + minor*100 + patch` → `104`) into `android/app/build.gradle`.
   Run it from `package:android`.
3. Build the AAB with `cd android && ./gradlew bundleRelease`, then copy it to
   `release/android/SkyRoutes-<version>.aab`.
4. Keep R8/minification off at first. The app is almost entirely web assets,
   and minification adds little benefit for some risk.

## Phase 7: Play Console

1. Create the app with the package ID from Phase 2, as a free game.
2. Enable Play App Signing and upload the first AAB to **internal testing**.
3. Store listing:
   - short and full descriptions (adapt them from `PRODUCT.md` and the
     Microsoft Store copy)
   - a 512×512 icon
   - a 1024×500 feature graphic
   - phone and 7"/10" tablet screenshots (add them to `art/` the way the
     Microsoft Store assets were added)
4. App content:
   - privacy policy URL (required; host it on the Netlify site)
   - Data Safety: no data collected or shared
   - IARC content rating
   - target audience (choosing 13+ avoids Families policy obligations)
   - ads: none
5. Closed testing: new personal developer accounts must run a closed test
   with the required number of opted-in testers for 14 continuous days
   before they can apply for production access.
6. Promote the build to production after closed testing.

## Phase 8: Documentation

- Add `docs/android-release.md` in the same style as
  `docs/microsoft-store.md` and `docs/linux-release.md`: build commands, signing setup (without
  secrets), the versioning rule, the release checklist, and listing details.
- README: add Android build instructions, and add a Google Play badge for
  the web edition (not shown inside the Android app) once the app is live.
- CONTRIBUTING: note that `android/` is committed and that `cap sync` must
  run after each web build.

## Risks

| Risk | Mitigation |
| --- | --- |
| Slow frame rate on low-end devices | The `mobile` detail level already reduces scenery; profile with remote DevTools and lower detail further if needed. |
| Back gesture interrupts route drawing near the screen edges | Test edge drawing; if needed, exclude gesture regions (`setSystemGestureExclusionRects`) over the play area. |
| WebView inset values missing under edge-to-edge | Phase 3 step 4 fallback. |
| Play rejects the app for external payment or store links | Hide those links on Android (Phase 1). |
| Lost upload keystore | Play App Signing lets you reset the upload key; back up the keystore anyway. |

## Out of scope

- iOS. Capacitor makes it possible later from the same code; it would need a
  Mac and an Apple developer account.
- In-app purchases, ads, Play Games Services, and cloud saves.

# Android release (Google Play)

The Android edition wraps the same Vite build as the web and desktop editions
in Capacitor. It plays offline from first launch and keeps progress in the
app's own IndexedDB; browser and desktop saves are separate. Updates come from
Google Play: the Android build does not register the web service worker,
requests no permissions, and never loads the hosted website.

Android-only behavior lives in `src/platform/android.ts`, behind
`import.meta.env.MODE === "android"` checks so web and desktop bundles do not
include it:

- The hardware back button closes the open dialog or menu, leaves a utility
  page, or pauses a running shift. It never resumes play. From a root screen
  it moves the app to the background.
- Outbound links open in the system browser; the WebView stays on the bundle.
- The store badges and the SupportKori section are hidden
  (`:root[data-platform="android"]` in `src/styles.css`), following Play's
  payments policy.

## Prerequisites

- Node.js 24 and npm 11, as for the other editions.
- Android Studio with Android SDK Platform 36.
- **JDK 21** for Gradle. Capacitor 8 compiles with Java 21. Gradle 8.14 does
  not run on JDK 25, which recent Android Studio versions bundle. Point
  Android Studio's Gradle JDK (Settings → Build Tools → Gradle) or
  `JAVA_HOME` at a JDK 21 (`winget install EclipseAdoptium.Temurin.21.JDK`).
- Command-line Gradle builds need `android/local.properties` with
  `sdk.dir=C\:/Users/<you>/AppData/Local/Android/Sdk` (or `ANDROID_HOME`);
  Android Studio writes this file itself. It is gitignored.

## Build

```bash
npm ci
npm run android:sync     # Build dist-android/ and copy it into android/
npm run android:open     # Open the project in Android Studio
npm run android:run      # Build, sync, and run on a device or emulator
npm run package:android  # Signed Play bundle in release/android/
```

Run `android:sync` after every web change; the `android/` project only sees
the copied build. The `android/` folder is committed; the copied web assets,
Gradle output, and `local.properties` are ignored.

`android/app/build.gradle` reads the version from `package.json`:
`versionName` is the package version and `versionCode` is
`major × 10000 + minor × 100 + patch` (0.1.4 → 104). Bump `package.json`
before each Play upload; Play rejects a repeated `versionCode`.

## Icons and splash

The vector master is `art/brand/logo.svg`. `npm run icons:android` renders
these from it, each at its own pixel size:

- the launcher icons: legacy, round, adaptive foreground, and themed monochrome
- the adaptive background color
- the per-density launch splash images (`drawable-*/splash_logo.png`)
- the 512 px Play icon (`art/google-play/icon-512.png`)

The script uses Playwright: set `CHROME_PATH` to an installed Chrome or Edge,
or run `npx playwright install chromium`. The splash art must fit inside
Android's 192dp circle mask. If you change the mark, re-check
`SPLASH_ART_SCALE` in the script.

## Fullscreen and screen edges

`MainActivity` keeps the whole app immersive and edge to edge. Both system
bars are hidden, and an edge swipe shows them briefly. Capacitor's inset
handling is disabled, so the WebView is never padded. The activity instead
passes the camera cutout to the page as `--safe-area-inset-*` values.

The CSS reads all safe areas through `--safe-top/right/bottom/left`, which
fall back to `env()` on web and desktop. Use those variables, not `env()`
directly, so Android keeps controls clear of the camera. Centred layouts use
`--safe-block` and `--safe-inline` (the larger of the two opposite insets) so
they stay on the display centre.

## Signing

Play App Signing holds the app signing key; you keep only an upload key.

1. Create the upload key once, outside the repository:
   ```bash
   keytool -genkeypair -v -keystore ../keys/air-traffic-control-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Copy `android/keystore.properties.example` to
   `android/keystore.properties` (gitignored) and fill in the path and
   passwords.
3. Back up the keystore and passwords. If the upload key is lost, Play support
   can reset it, but releases stop until they do.

`package:android` refuses to run without `keystore.properties`. Debug builds
from Android Studio do not need it.

## Verify

Before each upload:

- `npm test`, `npm run build`, and `npm run build:android` pass.
- On an emulator and one low-end phone (remote debugging via
  `chrome://inspect`): every airfield plays in portrait and landscape, with
  rotation pausing and resuming the shift; touch route drawing works,
  including near screen edges where the back gesture lives; the back button
  behaves as described above on every screen; audio starts after the first
  tap and stops when the app is backgrounded; progress survives force-stop,
  reboot, and installing the new version over the old one; the game plays in
  airplane mode.
- The home screen shows no store badges and Settings shows no support section.

## Play Console

- Package ID: `dev.montasim.airtrafficcontrol` (permanent once uploaded).
- Upload the `.aab` to internal testing first. New personal developer accounts
  must also run a closed test for 14 days before production access.
- App content: privacy policy URL, Data Safety (no data collected or shared),
  IARC content rating, target audience, no ads.
- Listing: title, short and full descriptions, the 512 px icon, a 1024 × 500
  feature graphic, and phone and tablet screenshots in `art/google-play/`.

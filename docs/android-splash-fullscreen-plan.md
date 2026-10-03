# Android splash screen and fullscreen play

Date: 2026-10-03

Status: implemented on 2026-10-03, without the developer credit (dropped by
request).

## Implementation record

- **Vector logo:** `art/brand/logo.svg` was traced from `public/icon.png` and
  checked against it with a 2× outline overlay. `npm run icons:android` now
  renders every launcher icon, the Play icon, and per-density splash images
  (`drawable-*/splash_logo.png`) from it, each at its own size.
- **Splash clipping:** Android masks the splash icon to a 192dp circle. At the
  first scale (0.7) the route dot's outer edge sat at 101.5dp, past the 96dp
  radius, so it was cut off. The scale is now 0.6, which puts the outermost
  point at 87dp.
- **Loading screen:** shows the vector mark, **Air Traffic Control**, and the
  loading status. All of it is centred as one block, on every edition. On
  Android it stays up for at least 1.2 s.
- **Fullscreen:** `MainActivity` hides both system bars with swipe-to-reveal
  behavior from launch and re-applies that whenever the app regains focus.
  Emulator `dumpsys window` reports both bars `visible=false` in portrait and
  landscape.
- **Truly fullscreen, centred on the display:** Capacitor padded the WebView
  away from the camera, which left a dark band on the camera edge and pushed
  centred screens about 24dp off the display centre. Matching padding on the
  opposite edge fixed the centring but still showed bands, which device
  testing rejected. Now:
  - Capacitor's inset handling is disabled, and the WebView is not padded at all.
  - `MainActivity` passes the cutout to the page as `--safe-area-inset-*` on
    every inset change and page load, the same way on every WebView version.
  - `src/styles.css` reads those values through `--safe-top/right/bottom/left`,
    falling back to `env()` on web and desktop.
  - Centred home layouts pad both opposite edges by the larger inset
    (`--safe-block`, `--safe-inline`).

  Measured on the emulator: the viewport equals the screen (412×915 and
  915×412), and the inset is 48.8dp on the camera edge. The home menu centres
  at 458 against 457.5 in portrait and landscape. The HUD sits 49dp in from
  the camera edge.
- **Android 14 and older:** a device test on Android 14 still showed a band
  on the camera edge. Android 15 forces apps edge to edge, but older versions
  fit the window inside the cutout by default. Also, the cutout mode was
  written to a copy of the window attributes and never applied. Now
  `MainActivity` turns off window fitting
  (`WindowCompat.setDecorFitsSystemWindows(window, false)`), applies the
  cutout mode with `setAttributes`, and both themes set `shortEdges`.
  Reproduced on the API 35 emulator by temporarily building with
  `targetSdkVersion 34`, which disables forced edge-to-edge: before the fix
  the viewport was 412×866 of 412×915 (a 49dp band); after the fix it is
  412×915, and 915×412 in landscape. Target 36 on Android 15 is unchanged
  (full screen).
- **Colors:** the window, splash, WebView, and Android loading screen use the
  menu background `#29483e`.
- **Launch flow without overlap:** The native splash used to stay up until the
  whole game bundle had loaded (5 s or more). When it finally faded, its
  centred logo overlapped the loading screen's raised logo. Now:
  1. The loading screen first paints the logo alone, at the exact size and
     anchor of the native splash. The boot logo is `420 / 512 × 172.8px`, and
     its `viewBox` is centred on the splash anchor (255, 236). Screenshots
     match to within 1 px.
  2. `bootstrap.ts` dismisses the native splash right after that frame paints.
  3. The logo then rises while the name and status fade in (520 ms),
     ending centred.
  4. The menu crossfades in (320 ms) once the name has been shown for at
     least 900 ms. Android also waits up to 1.5 s for the home map preview. A
     preview that arrives later fades in rather than popping.

  `data-platform` is stamped at build time (`%MODE%`), so the Android colours
  apply from the first frame.
- **Known limit:** Android 12+ draws its system splash itself and keeps the
  status bar visible there. The bar disappears at the handoff, the only
  visible change. On the emulator the map preview arrives about 3.6 s after
  the game is ready, because a second Phaser renderer starts up on its slow
  software graphics. Loading previews one map at a time didn't help, so that
  change was reverted.
- **Plan changes:** there is no app name on the native splash, because Android
  can't show text there; the name appears on the loading screen. Fullscreen
  covers the whole app.

Device testing of the 0.1.4 debug APK found two problems:

1. The launch splash shows only the logo, and the logo looks blurry. It
   should also show the app name and the developer, **Montasim**.
2. The status bar (top) and the navigation/gesture bar (bottom) stay visible
   while playing, in portrait and in landscape. The game should be fullscreen.

## 1. Splash screen

### Why the logo is blurry

- The only logo source is a 512×512 PNG (`public/icon.png`; `icon.svg` just
  wraps that PNG). The repo has no vector version.
- The splash reuses the launcher's adaptive foreground
  (`@mipmap/ic_launcher_foreground`). To fit the round launcher masks, the art
  was shrunk to 58% of that bitmap, so at most about 250 px of detail is left.
- Android draws the splash icon at 240dp, which is about 630 px on a typical
  phone. The shrunken art is scaled up roughly 2.5×, which causes the blur.

### Why there is no name

The Android 12+ system splash can only show an icon on a background color, plus
an optional small "branding" image at the bottom (Android 12+ only, not on
older versions). It cannot show text. The page's own boot screen, which shows
next, does have the title, but it uses a tiny 64 px outline airplane rather
than the real logo, and it has no developer credit.

### Proposed fix

**1a. Create a vector logo (one-time art step).** Redraw the mark as a clean
SVG (`art/brand/logo.svg`): the cream airplane, the teal route loop, and the
amber destination dot. A vector stays sharp at any size and becomes the single
source for:

- the Android splash icon (as an Android vector drawable, so no bitmap scaling)
- the launcher icons (regenerated sharper, at every density)
- the in-page boot screen logo (inline SVG)

You review the redraw side by side with the current PNG before anything
uses it.

*Fallback if you'd rather keep the exact PNG:* render dedicated splash bitmaps
per screen density with the art at full size (not shrunk to 58%). That is
sharper than now, but still limited by the 512 px source.

**1b. One continuous branded launch screen.**

- **System splash (first ~0.5 s, native):** the new crisp logo, centered on
  the game's dark green. No text, because Android can't show text there.
- **Boot screen (until the game is ready, in-page):** the same logo at the
  same size and position, so the change from the native splash to the page
  isn't noticeable. Below it:
  - **Air Traffic Control** (game title font)
  - **by Montasim** (small, muted)
  - the existing "Preparing your airfield…" message and amber loading bar
- **Minimum display time:** on Android, the boot screen stays at least about
  1.2 s so the name and credit are readable even on fast phones. Web and
  desktop keep today's timing.

**Open question:** the boot screen is shared by every edition. Should the
bigger logo and "by Montasim" credit show on **all editions** (web, Windows,
Linux, Android) or **Android only**? Recommendation: all editions, for one
consistent brand and less platform-specific code.

### Files

- `art/brand/logo.svg` (new)
- `scripts/generate-android-icons.mjs`: render from the SVG, add splash output
- `android/app/src/main/res/drawable/splash_logo.xml` (new vector drawable)
  and `values/styles.xml` (point the splash at it)
- `index.html`: boot screen markup and styles
- `src/bootstrap.ts`: minimum boot-screen time on Android

## 2. Fullscreen

### Cause

The app uses Android's default window, which keeps the system bars visible.
Capacitor pads the game so nothing is drawn under them, which is why you see
them as solid strips.

### Proposed fix: immersive mode for the whole app

- Hide the status bar and the navigation/gesture bar from launch, using
  Android's "immersive sticky" behavior: swiping in from an edge shows the
  bars over the game for a moment, then they hide again by themselves.
- Apply it natively in `MainActivity.java`, re-applied every time the app
  regains focus (after switching apps, the notification shade, or a dialog).
  The JavaScript API (Capacitor `SystemBars.hide()`) doesn't set the
  auto-hide behavior and doesn't re-apply after the app returns to the
  foreground, so native code is more reliable.
- **Whole app, not just during a shift.** Hiding the bars only when a shift
  starts would resize the game the moment play begins. Toggling them on pause
  would resize it again. The game already refits and cancels any route being
  drawn on resize. Keeping one fullscreen size from launch avoids all of that.
  Menus also look fine fullscreen.
- **Camera cutout:** keep game content out from under the camera hole. The
  strip beside the cutout is painted in the game background color, so it
  blends in instead of looking like a bar. The existing safe-area padding
  handles this.
- **Back gesture:** the system back swipe still works in immersive mode, and
  the back-button handling stays the same.

### Files

- `android/app/src/main/java/dev/montasim/airtrafficcontrol/MainActivity.java`
- `android/app/src/main/res/values/styles.xml`: cutout mode and bar colors
- `capacitor.config.ts`: confirm inset handling still pads only for the cutout

## Verification

Check on the emulator and on your phone, in portrait and landscape:

- The launch screen shows a sharp logo, then the title and "by Montasim",
  with no visible jump between the native splash and the page.
- No status bar or navigation bar on the home screen, in menus, or during a
  shift. An edge swipe shows them briefly, then they hide.
- After switching apps, pulling down notifications, or locking and unlocking
  the screen, the app returns to fullscreen and the shift is still paused.
- Rotating mid-shift still pauses and resumes correctly. Routes drawn near
  the screen edges still work.
- Existing checks: `npm test`, web and desktop builds unchanged.

Then I'll give you a new APK to install.

## Decisions needed

1. **Logo:** create a vector redraw (recommended), or keep the PNG and only
   fix the scaling?
2. **Boot screen credit and bigger logo:** all editions (recommended), or
   Android only?
3. **Fullscreen scope:** the whole app (recommended), or only during a shift?

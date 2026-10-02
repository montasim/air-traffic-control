# Linux desktop and Snap Store releases

Air Traffic Control packages the complete game in Electron. No development server or
internet connection is required to play. The application uses a sandboxed renderer
without Node.js access. The `aircontrol://game` origin serves only bundled assets.
Desktop builds exclude the web service worker; updates come from the installed package.

## Build

Use Node.js 24 and npm 11 on Linux x86-64:

```bash
npm ci
npm run desktop          # Build and run locally
npm run package:linux    # Portable AppImage
npm run package:snap     # Snap Store package
```

Outputs are in `release/`:

- `air-traffic-control_0.1.0_x86_64.AppImage`
- `air-traffic-control_0.1.0_amd64.snap`
- `linux-unpacked/air-traffic-control` (unpacked executable)

The version comes from `package.json`; filenames change when the version changes.
`npm run package:dir` builds just the unpacked application. Packaging commands explicitly
disable publishing. `electron-builder.yml` defines the application identity, icons,
packaged files, and Linux targets. The PNG icon is a raster version of `public/icon.svg`.

Snap builds follow ISPCine's Electron Builder setup: `core24`, strict confinement,
and an isolated LXD build. Install Snapcraft and LXD if they are not available:

```bash
sudo snap install snapcraft --classic
sudo snap install lxd
sudo usermod -aG lxd "$USER"
# Log out and back in for group membership, then initialize LXD if needed:
lxd init --minimal
npm run package:snap
```

Do not reinitialize an existing LXD setup. Builds need network access to obtain
Electron, the base image, and GNOME runtime packages. See the
[Electron Builder Snap documentation](https://www.electron.build/v26/docs/snap/).

## Verify

```bash
npm test
npm run build
npm run package:dir
ELECTRON_EXECUTABLE=release/linux-unpacked/air-traffic-control npm run test:desktop
```

The Electron smoke test requires a graphical session (or `xvfb-run -a` in CI). It
checks startup, bundled textures/fonts, renderer isolation, starting and pausing a
shift, and saved difficulty after a restart. It uses a temporary profile.

For the actual confined package, install locally and play a shift with audio:

```bash
sudo snap install --dangerous release/air-traffic-control_0.1.0_amd64.snap
snap run air-traffic-control
```

Here `--dangerous` permits a locally built, unsigned Snap; confinement remains strict.
Check native Wayland and X11 where available. Verify that saves survive a package
refresh before promoting the first release to stable.

The desktop has its own IndexedDB saves, separate from browser saves. Snap stores
its Electron profile in `$SNAP_USER_COMMON/air-traffic-control`, shared across
revisions. Snap refreshes should retain progress; removing app data erases it.
Snapd manages store updates; there is no separate Electron updater.

## Publish to Snap Store

The store name `air-traffic-control` was registered on 2026-09-29 under the
`montasimmamun` publisher account. Registration reserves the name; it does not
upload a build or publish the app. Keep `executableName` in `electron-builder.yml`
aligned with this registered name.

```bash
snapcraft login
snapcraft whoami
snapcraft upload release/air-traffic-control_0.1.0_amd64.snap --release=edge
```

Complete the title, description, icon, screenshots, license, contact, and website
in the [Snap Store dashboard](https://dashboard.snapcraft.io/). Test the store-installed
edge revision, then promote the reviewed revision:

```bash
snapcraft status air-traffic-control
snapcraft release air-traffic-control <revision> stable
```

Increment the package version with `npm version patch --no-git-tag-version` before
subsequent releases, rebuild, and upload. Store registration, upload, review, and
promotion are separate from creating local build artifacts.

The `Linux desktop` GitHub Actions workflow builds and smoke-tests an AppImage on
manual dispatch or a `v*` tag push, then retains it as a workflow artifact. It does
not upload to the Snap Store. See Canonical's [upload command reference](https://documentation.ubuntu.com/snapcraft/9.0/reference/commands/upload/)
for store upload behavior.

## Verified local artifact (2026-09-29)

`release/air-traffic-control_0.1.0_amd64.snap` was built successfully (106 MiB).
Archive inspection confirmed the name `air-traffic-control`, title
`Air Traffic Control`, version `0.1.0`, amd64 architecture, MIT license,
`core24`, strict confinement, GNOME/GPU command chains, icon, and desktop launcher.
The bundled `app.asar` SHA-256 matches the unpacked desktop application that passed
the gameplay and persistence smoke test. Checksums are in `release/SHA256SUMS`.

Snapcraft reported one non-fatal GPU lint warning for Electron's bundled
`app/libvulkan.so.1`; the GNOME GPU content interface and launch wrapper are present.
Revision **1** was uploaded, accepted by Store review, released to `latest/edge`,
then promoted to `latest/stable` on 2026-09-29 under publisher `montasimmamun`.
The exact Store revision was installed with strict confinement in the Ubuntu 24.04
LXD environment. Automated checks passed for startup, local fonts and textures,
renderer isolation, starting and pausing gameplay, and saved difficulty after restart.
The test used Xvfb; hardware GPU/Wayland behavior and audible playback were not tested.

Published Snap SHA-256:
`4d15856d6452ded4fb9743fa76fc3a1762170ef76d5470c4925f9c97461cb299`

Install the stable release:

```bash
sudo snap install air-traffic-control
snap run air-traffic-control
```

## Snap release 0.1.1 (2026-09-30)

Version **0.1.1**, Store revision **2**, is published to `latest/stable` and
`latest/edge`. It includes the visible aiming cursor, mobile aircraft sizing and
touch selection improvements, preserved shifts during viewport resizing, and
rotation/practice layout improvements.

Validation passed: 322 automated tests, the desktop production build, and the
packaged Electron smoke test. The Snap's bundled `app.asar` matches the tested
unpacked application. The exact Store revision was tested under strict confinement
in Ubuntu 24.04 with Xvfb: upgrading from revision 1 retained the saved difficulty;
renderer isolation, bundled assets, gameplay, and pause checks passed. Hardware
GPU/Wayland behavior and audible playback were not tested. The existing nonfatal
Electron Vulkan-library lint warning remains.

Artifact: `release/air-traffic-control_0.1.1_amd64.snap` (106 MiB).
SHA-256: `904545573064db01a7a0d9082711adf28c516e8bcefdca7906a61b61ba20344d`.
This release updates the Snap package; no 0.1.1 AppImage was built.

```bash
sudo snap refresh air-traffic-control
```

## Snap release 0.1.2 (2026-10-01)

Version **0.1.2**, Store revision **3**, is published to `latest/stable` and
`latest/edge`. It includes optional, saved two-end runway landing with approach
guidance, active-shift resize improvements, and aligned airplane app icons.
The source was built from `10fd069` with the package version bumped to 0.1.2.

Validation passed: 414 automated tests, web and desktop production builds, and the
packaged Electron smoke test, including resize/resume and saved settings. The
Store-downloaded Snap matches the uploaded artifact, and its `app.asar` matches
the tested unpacked application. The signed Store revision was installed under
strict confinement in Ubuntu 24.04 LXD with Xvfb. Upgrading from revision 2 retained
saved difficulty; bundled assets, renderer isolation, gameplay, pause, the default-off
runway option, and settings persistence after restart passed. Hardware GPU/Wayland
behavior and audible playback were not tested.

The normal LXD build failed because the fresh container could not reach external
services and timed out during `snap unset system proxy.http`. No host firewall
changes were made. This release was packed with `snapcraft pack` from the verified
0.1.1 Snap runtime: a recursive comparison confirmed that the Electron runtime was
identical to the newly packaged application except for `app/resources/app.asar`.
That bundle, both metadata icons, and the version in `meta/snap.yaml` were replaced
with the 0.1.2 outputs; the existing strict-confinement configuration and command
chains were retained. Future normal builds still require the LXD connectivity fix
below.

Artifact: `release/air-traffic-control_0.1.2_amd64.snap` (111,714,304 bytes).
SHA-256: `2801f12c7e5cbade1f5d15f518c009f0594dc762651dff533ca673ffef7ee2bf`.
This release updates the Snap package; no 0.1.2 AppImage was built.

## Snap release 0.1.3 (2026-10-02)

Version **0.1.3**, Store revision **4**, is published to `latest/stable` and
`latest/edge`. It includes the wider responsive start screen, Microsoft Store
and Snap Store badges, the external SupportKori link in Settings, and clearing
practice routes after a successful landing. The source is `c7e0f3c` with the
package version bumped to 0.1.3.

Validation passed: 414 automated tests, web and desktop production builds, and
the packaged Electron smoke test (startup, assets, isolation, gameplay,
resize/resume, and settings persistence). Additional checks verified both store
badge assets, all three allowed external links, and practice-route cleanup in
the packaged application. Store review accepted revision 4. The downloaded
Store Snap is byte-for-byte identical to the uploaded artifact, and its bundled
`app.asar` matches the tested unpacked application.

The normal LXD build again timed out at `snap unset system proxy.http`; a
container request to `api.snapcraft.io` also timed out. As with 0.1.2, this
release uses `snapcraft pack` with the verified published runtime. The 0.1.2
Snap's checksum was verified before extraction. A complete file-set and
SHA-256 comparison of its `app/` directory against the new Electron output
found only `resources/app.asar` changed. That application bundle and
`meta/snap.yaml` version were updated; the Electron runtime, strict confinement,
interfaces, and command chains remain unchanged. No firewall changes were made.
A fresh installed strict-confinement run, hardware GPU/Wayland behavior, and
audible playback were not retested for this release. No 0.1.3 AppImage was built.

Artifact: `release/air-traffic-control_0.1.3_amd64.snap` (111,722,496 bytes).
SHA-256: `601b5f9816d40d2fc52df18d00be63b0adc93e330d96daf38182f2f8e1fabc00`.

Update an existing installation:

```bash
sudo snap refresh air-traffic-control
```

## Snap release 0.1.4 (2026-10-02)

Version **0.1.4**, Store revision **5**, is published to `latest/stable` and
`latest/edge`. It adds the shared SupportKori footer to Help, Career, and Practice,
unifies the four utility pages at a 1040px maximum content width, and matches
Practice's background and text colors to the other pages. Source: `b256a0b`
with the package version bumped to 0.1.4.

Validation passed: 414 automated tests, web and desktop production builds, and
the packaged Electron smoke test covering gameplay, resize/resume, assets,
renderer isolation, and persistent settings. Release-specific desktop checks
confirmed matching widths and backgrounds, functional external support links on
all four pages, and no support footer in the airfield picker. Store review passed;
the downloaded revision 5 Snap is byte-for-byte identical to the uploaded file.
The Snap's bundled `app.asar` matches the tested desktop application.

Packaging used the documented `snapcraft pack` fallback because of the LXD
network failure observed during the preceding 0.1.3 release. The normal LXD build
was not retried for 0.1.4. The published 0.1.3 Snap's checksum was verified before
extraction; complete file-set and SHA-256 comparison against the new Electron
output found only `resources/app.asar` changed. Only that application bundle and
the version in `meta/snap.yaml` were replaced. The runtime, strict confinement,
interfaces, and command chains are unchanged. A fresh installed strict-confinement
run, hardware GPU/Wayland behavior, and audible playback were not retested.
No 0.1.4 AppImage was built.

Artifact: `release/air-traffic-control_0.1.4_amd64.snap` (111,722,496 bytes).
SHA-256: `532ab85be84036ef41c093f1c95df3579c9bdf234ff110cd3afbca111daf337e`.

```bash
sudo snap refresh air-traffic-control
```

## Local build environment troubleshooting

The first Snap build failed when the managed LXD container could resolve DNS but
could not reach external services. Snapcraft initially timed out at
`snap unset system proxy.http`, then failed at `apt update`.

Applying ISPCine's forwarding rules below restored connectivity on 2026-09-29;
a request from the build container to `https://api.snapcraft.io` returned HTTP 200.
The `iptables -C` commands report “Bad rule” when a rule is absent; the commands
after `||` then insert that rule. That initial message alone does not mean the
repair failed.

ISPCine's release guide documents LXD forwarding problems on the same host.
Have an administrator check the firewall's forwarding policy for `lxdbr0` and
restore container access to the Snap Store and Ubuntu package repositories.
For an iptables-managed host, that guide uses these narrowly scoped checks/rules:

```bash
sudo iptables -C FORWARD -i lxdbr0 -j ACCEPT || sudo iptables -I FORWARD 1 -i lxdbr0 -j ACCEPT
sudo iptables -C FORWARD -o lxdbr0 -j ACCEPT || sudo iptables -I FORWARD 1 -o lxdbr0 -j ACCEPT
```

If UFW or another firewall manager owns these rules, configure its routed-traffic
policy instead. These direct rules may not survive a reboot. Then retry
`npm run package:snap`. Avoid disabling the firewall globally.

### Electron Builder launcher path

Electron Builder 26.15.3 emits `desktop: meta/gui/air-traffic-control.desktop`
in its generated core24 recipe, but that path exists only in the finished Snap.
Snapcraft 9.1.3 consequently fails while generating the desktop file.
`scripts/package-snap.mjs` removes that redundant recipe entry before Snapcraft
runs. Snapcraft discovers the generated `snap/gui/air-traffic-control.desktop`
automatically, matching ISPCine's working package. The script also includes the
license, support links, source repository, and website from `package.json`. Keep using `npm run package:snap`
so this workaround runs; reassess it when upgrading Electron Builder.

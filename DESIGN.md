---
name: Vector Approach
description: "A local-first regional-airport atlas descended from the raised saltmarsh airfield."
colors:
  interface-ink: "#101a18"
  panel-glass: "rgba(13, 26, 25, 0.9)"
  panel-solid: "#122321"
  control-glass: "rgba(12, 24, 23, 0.76)"
  bone: "#f2f0e8"
  muted: "#b5c0b9"
  interface-accent: "#72d3c5"
  interface-accent-hover: "#8cddd1"
  marsh-deep: "#263e38"
  marsh: "#3c5a4f"
  marsh-high: "#526b5d"
  water-deep: "#21464d"
  water-shallow: "#416866"
  polder-shadow: "#132b28"
  raised-turf: "#4b5951"
  asphalt: "#273431"
  marking-bone: "#e4e0cc"
  taxiway-amber: "#b79b55"
  aircraft-cyan: "#8bdeda"
  aircraft-amber: "#f0bd66"
  aircraft-coral: "#f0836f"
  guidance-invalid: "#f3a08d"
  gateway-ground: "#293c34"
  gateway-water: "#315359"
  river-ground: "#323a31"
  river-water: "#38565a"
  desert-ground: "#8a7658"
  desert-water: "#314f53"
  twin-west-ground: "#76694b"
  twin-east-ground: "#435b48"
  twin-river: "#244d54"
  roster-river: "#315b5b"
  roster-desert: "#8a7048"
  roster-twin-west: "#81683f"
  roster-twin-river: "#356167"
  roster-twin-east: "#466445"
typography:
  display:
    fontFamily: '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", sans-serif'
    fontSize: "clamp(2.125rem, 7.5vmin, 3.5rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.015em"
  headline:
    fontFamily: '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", sans-serif'
    fontSize: "clamp(2rem, 6.5vmin, 2.75rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.015em"
  body:
    fontFamily: '"Atkinson Hyperlegible", "Segoe UI", "Noto Sans", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  control:
    fontFamily: '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", sans-serif'
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.015em"
  hud-label:
    fontFamily: '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", sans-serif'
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.06em"
  hud-value:
    fontFamily: '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", sans-serif'
    fontSize: "clamp(1.5rem, 4vmin, 2rem)"
    fontWeight: 700
    lineHeight: 1
    fontFeature: '"lnum" 1, "tnum" 1'
rounded:
  compact: "12px"
  standard: "14px"
spacing:
  label-gap: "4px"
  action-gap: "10px"
  edge: "12px"
  frame: "16px"
  control-inline: "20px"
  panel: "clamp(22px, 5vw, 34px)"
components:
  button-primary:
    backgroundColor: "{colors.interface-accent}"
    textColor: "{colors.interface-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.standard}"
    padding: "0 20px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.interface-accent-hover}"
    textColor: "{colors.interface-ink}"
    rounded: "{rounded.standard}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    typography: "{typography.control}"
    rounded: "{rounded.standard}"
    padding: "0 20px"
    height: "52px"
  atlas-panel:
    backgroundColor: "{colors.panel-glass}"
    textColor: "{colors.bone}"
    rounded: "{rounded.standard}"
    padding: "{spacing.panel}"
    width: "min(100%, 880px)"
  modal-panel:
    backgroundColor: "{colors.panel-glass}"
    textColor: "{colors.bone}"
    rounded: "{rounded.standard}"
    padding: "{spacing.panel}"
    width: "min(100%, 410px)"
  career-summary:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    padding: "12px 0"
    width: "100%"
  map-roster-card:
    backgroundColor: "rgba(242, 240, 232, 0.045)"
    textColor: "{colors.bone}"
    rounded: "{rounded.standard}"
    padding: "49px 12px 12px"
    height: "136px"
  audio-toggle:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    typography: "{typography.body}"
    rounded: "{rounded.standard}"
    padding: "0 13px"
    height: "44px"
  hud-stat:
    backgroundColor: "{colors.control-glass}"
    textColor: "{colors.bone}"
    rounded: "{rounded.standard}"
    padding: "7px 10px 8px"
  pause-control:
    backgroundColor: "{colors.control-glass}"
    textColor: "{colors.bone}"
    rounded: "{rounded.standard}"
    size: "48px"
  route-coachmark:
    backgroundColor: "rgba(13, 30, 28, 0.94)"
    textColor: "{colors.bone}"
    rounded: "{rounded.compact}"
    padding: "11px 14px 12px"
    width: "min(calc(100% - 112px), 380px)"
---

# Design System: Vector Approach

## Overview

**Creative North Star: "The Raised Saltmarsh Airfield Atlas"**

Vector Approach expands one proven visual world into a regional atlas. The original raised saltmarsh airfield remains the parent language: muted mineral geography, operationally credible civil infrastructure, bone paint, amber taxiway detail, and deliberately open routing space. Saltmarsh Gateway, River Bend, Desert Parallel, and Twin Banks change the terrain story and airfield arrangement without changing the product's visual grammar.

The interface is a quiet clearance desk laid over the selected map. One wide opening panel presents career state, a four-field roster, sound controls, and the play decision; active play removes that shell and leaves only score, orientation-aware best, route coaching, and pause. Everything visible or audible is bundled, synthesized, or drawn from deterministic code so the atlas keeps its identity offline.

**Key Characteristics:**

- Four distinct geographic fields held together by one civil-airfield construction language.
- Dark glass, bone type, condensed operational labels, and restrained cyan selection.
- Muted biome colors beneath invariant cyan, amber, and coral aircraft signals.
- A responsive map roster that stays readable instead of collapsing into miniature cards.
- Code-native static worlds composited once, with semantic audio synthesized locally.

## Colors

The atlas grows outward from tidal green into olive river fields, a mineral desert basin, and a two-bank ochre/green split; interface and aircraft colors remain stable across every field.

### Primary

- **Saltmarsh Family** (`marsh-deep`, `marsh`, `marsh-high`, `raised-turf`, `gateway-ground`): the incumbent coastal ground language and Saltmarsh Gateway's engineered field.
- **River Field** (`river-ground`): the olive-neutral ground that distinguishes River Bend without leaving the muted regional family.
- **Mineral Basin** (`desert-ground`): Desert Parallel's dry ochre field and the warm band in its roster preview.
- **Twin Bank Grounds** (`twin-west-ground`, `twin-east-ground`): the asymmetric ochre and green halves that make Twin Banks readable at a glance.

### Secondary

- **Atlas Water** (`water-deep`, `water-shallow`, `gateway-water`, `river-water`, `desert-water`, `twin-river`): pools, river bends, coast fragments, and the dividing river; every water is quieter than an active route.
- **Runway Asphalt** (`asphalt`): the dark structural ground shared by runways and taxiways.
- **Bone Marking** (`marking-bone`): thresholds, centerlines, designators, helipads, labels, and field detail.
- **Taxiway Amber** (`taxiway-amber`): low-saturation civil ground markings, visually distinct from the brighter commuter signal.
- **Roster Geography** (`marsh`, `roster-river`, `roster-desert`, `roster-twin-west`, `roster-twin-river`, `roster-twin-east`): compact top bands that preview each map's dominant geographic split.

### Tertiary

- **Aircraft Cyan** (`aircraft-cyan`): liner silhouettes, compatible runway beacons, and matching route guidance.
- **Aircraft Amber** (`aircraft-amber`): commuter silhouettes and their contextual destination cues.
- **Aircraft Coral** (`aircraft-coral`): rotorcraft silhouettes and helipad cues; `guidance-invalid` appears only for missed acquisition.
- **Interface Cyan** (`interface-accent`, `interface-accent-hover`): the selected roster card, range input, primary action, promotion emphasis, and focus-worthy confirmation.

### Neutral

- **Interface Ink** (`interface-ink`): the browser background and darkest UI ground.
- **Bone** (`bone`): primary UI text, focus outlines, and high-contrast controls.
- **Muted Sage** (`muted`): descriptions, career progress, card detail, and HUD labels.
- **Panel and Control Glass** (`panel-glass`, `control-glass`): translucent operational overlays; `panel-solid` is the reduced-transparency fallback.
- **Polder Shadow** (`polder-shadow`): the dark construction edge inherited from the raised-airfield world.

### Named Rules

**The Signal Reservation Rule.** Cyan, amber, and coral belong to aircraft, selected destination beacons, transient guidance, and narrowly scoped interface confirmation; scenery never borrows their saturation.

**The Atlas Family Rule.** A map earns identity through terrain hue, water geometry, and field arrangement; runway asphalt, bone paint, amber taxiway detail, interface glass, and aircraft signals do not change by biome.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow, Roboto Condensed, and sans-serif fallbacks)  
**Body Font:** Atkinson Hyperlegible (with Segoe UI, Noto Sans, and sans-serif fallbacks)

**Character:** Barlow Condensed makes map names, ranks, scores, runway identifiers, headings, signs, and controls feel compact and operational. Atkinson Hyperlegible keeps descriptions, career progress, instructions, and route coaching calm and readable at small sizes. Both families are bundled locally.

### Hierarchy

- **Display** (700, responsive 2.125–3.5rem, 0.98): the product title in the atlas panel.
- **Headline** (700, responsive 2–2.75rem, 0.98): pause and game-over state names.
- **Body** (400, 1rem, 1.45): modal explanation, held to a readable 34ch.
- **Control** (600, 1.0625rem, 1): primary and secondary action labels, map names, and rank names.
- **HUD Label** (600, 0.6875rem, 0.06em tracking): uppercase score, best, clearance, roster legend, difficulty, and effects labels.
- **HUD Value** (700, responsive 1.5–2rem, 1): lining, tabular score numerals.

### Named Rules

**The Two-Voice Rule.** Barlow Condensed names the field, clearance, state, and action; Atkinson Hyperlegible explains what the player should understand.

## Layout

The game frame is fixed to the safe-area-aware dynamic viewport (`100dvw × 100dvh`) with no gameplay scrolling. Score and current-orientation best anchor to the upper safe-area corners; pause anchors to the lower-right; the coachmark sits low and centered without entering that target. Opening, pause, and game-over layers may scroll vertically when their content cannot fit.

The atlas panel is the wide modal variant, capped at 880px. Its normal desktop sequence is title and instruction, a full-width career summary, a four-column map roster with 10px gutters, sound controls, then one full-width play action. Compact pause and game-over panels remain capped at 410px. The career summary pairs a small uppercase label with the earned rank and a progress sentence; the result panel reuses that progress line or replaces it with the promotion.

At 720px wide or below, the map roster becomes one horizontal row with 220px-to-78vw cards, inline overscroll containment, center snap points, and a visible accent scrollbar. The card width preserves name, state, and description rather than forcing four compressed columns. Career content stacks into one column and sound controls stack into two readable rows.

At 480px landscape height or below, the atlas panel widens to 820px, moves to the top of the scrollable scrim, reduces padding, shortens cards from 136px to 88px, hides card descriptions, keeps all four cards in one row, places career progress beside the rank, keeps sound controls inline, and uses two columns for paired modal actions. The route coachmark moves to the lower-right routing-safe area. Coarse pointers retain at least 48 × 48px controls, and every overlay edge respects safe-area insets.

Logical worlds are 1600 × 900 in landscape and 900 × 1600 in portrait; near-square viewports use a third authored map variant where supplied. Geometry, not camera cropping, preserves each field's spatial story. Detail is a separate responsive axis: a shortest viewport dimension below 520px uses mobile detail; a longest dimension of at least 1200px together with a shortest dimension of at least 700px uses desktop detail; everything else uses tablet detail. Map-specific budgets reduce field bands, trees or scrub, water marks, wear, coast fragments, service props, and labels without removing playable infrastructure.

### Four Map Invariants

- **Saltmarsh Gateway:** keep the connected intersecting runways, shared apron and helipad in the high/right region; quiet tidal pools, field seams, and access geometry surround at least 35% clear routing airspace below or away from the airport.
- **River Bend:** keep the compact civil airport high/right and the broad, scenery-only river bending along the left and lower edge; the river is an orientation landmark, never a permanent guidance overlay or collision rule.
- **Desert Parallel:** keep two long offset runway approaches, a compact shared apron and helipad, the remote operations landmark, dry washes, scrub, stones, and only small coast fragments; mineral ground dominates the view.
- **Twin Banks:** keep asymmetric west and east fields separated by a continuous river corridor, with bridge, secondary scenic strip, dual aprons, and the helipad on the east side; the two ground colors and central water split must remain visible in every orientation.

### Named Rules

**The Open Airspace Rule.** Preserve each map's authored airfield footprint and reserved routing area in every orientation; never enlarge geography or infrastructure until it consumes active approach space.

**The Readable Roster Rule.** Show one complete card per map in registry order; on narrow screens scroll the roster horizontally instead of shrinking or wrapping cards into an unreadable grid.

## Elevation & Depth

Depth is a hybrid of tonal construction and restrained overlay lift. Map geography uses nested tonal bands, pavement shoulders, surface wear, roof highlights, water shelves, and small south-east structural offsets rather than photorealistic texture. DOM HUD controls use a quiet 0 4px 18px shadow, roster selection adds a bounded 0 7px 24px lift and inner cyan line, and modal content uses a deeper 0 22px 60px shadow. Translucent blur switches to the solid panel token when reduced transparency is requested.

Every selected map paints its terrain, water, pavements, runway surfaces, wear, markings, facilities, and bounded labels into one native-size static render texture at depth -20. Temporary vector graphics are destroyed after composition; live aircraft, selection, routes, warnings, and guidance remain separate and visually dominant.

### Shadow Vocabulary

- **HUD Low** (`0 4px 18px rgba(7, 16, 15, 0.2)`): quiet lift beneath score and best.
- **Control Low** (`0 4px 18px rgba(7, 16, 15, 0.24)`): lift beneath the lower-right pause control.
- **Roster Selected** (`0 7px 24px rgba(4, 12, 11, 0.24)`): selection acknowledgment paired with an inset cyan line.
- **Modal Structural** (`0 22px 60px rgba(4, 12, 11, 0.34)`): separates modal content from the paused map.

### Named Rules

**The One-Texture World Rule.** Build each map's scenery depth once from deterministic code-native layers; never add decorative per-frame scenery work, remote textures, or image-backed terrain.

## Shapes

The atlas pairs organic geography with straight engineered infrastructure. Saltmarsh pools and field polygons, the River Bend curve, Desert Parallel's washes and coast fragments, and Twin Banks' dividing river use irregular or smoothed geometry. Runways, shoulders, taxiways, thresholds, hold lines, stands, aprons, bridges, signs, and facilities stay crisp and civil. Aircraft remain sharp vector silhouettes with restrained shadows.

Interface surfaces use gently rounded operational rectangles: 14px for panels, roster cards, career/result regions, buttons, audio controls, HUD tiles, and pause; 12px for the smaller coachmark. Map cards reserve a 36px rectangular geographic band at the top rather than using image thumbnails. Avoid pills and ornamental containers. Canvas circles remain functional capture areas, selection rings, helipad geometry, lights, or guidance anchors.

## Components

### Atlas Start Panel

The opening panel is the system's widest container: dark glass, a thin bone line, 14px corners, responsive 22–34px padding, and one 220ms rise/fade. It shows the selected map behind a blurred scrim and presents the title, career, roster, sound controls, and play action as one decision flow. Reduced transparency uses the solid panel token.

### Career Summary

The summary is a full-width, border-block strip between the introduction and roster. Desktop aligns “Current clearance” with the rank and places progress beneath the rank; mobile stacks all three lines; short landscape places label, rank, and progress on one compact row. The result panel uses the same restrained supporting copy and changes to interface cyan only for “Promoted — [rank].”

### Map Roster Cards

Four radio-style buttons follow registry order. Each card has a 36px geographic band, map name, uppercase difficulty plus best score, and one-line-to-short-paragraph description. Locked cards keep their map identity at 58% opacity and replace best score with the unlock rank; clicking one announces the requirement without selecting it. The selected unlocked card uses a cyan border, an inset cyan line, and restrained lift. Hover strengthens the neutral surface and border; press scales to 0.985.

Saltmarsh Gateway uses a marsh band, River Bend a blue-green band, Desert Parallel a mineral ochre band, and Twin Banks a three-part west-ground/river/east-ground diagonal. These bands are abstract atlas keys, not screenshots or decorative gradients elsewhere.

### Audio Controls

The sound toggle is a 44px-high transparent bordered control with a 19px Hugeicons volume or mute glyph and explicit “Sound on/off” copy. Effects volume pairs an uppercase 0.6875rem label with a full-width range control using interface cyan. Start and pause copies stay synchronized; settings persist locally. Visible state must remain sufficient without sound.

Synthesized cues carry semantics: a brief connection chirp, a two-tone landing rise, an interrupting low collision alarm, a three-step promotion ascent, and a quiet interface confirmation. Collision has priority over lower cues, and all cues obey the saved sound toggle and volume.

### Buttons

- **Primary:** a full-width 52px action in interface cyan with dark ink text, 14px corners, and 20px horizontal padding; hover lightens cyan, active scales to 0.98, and focus uses a 3px bone outline with 3px offset.
- **Secondary:** the same geometry and typography on transparent glass with a bone border; hover adds a faint bone wash and active scales to 0.98.
- **Icons:** play, restart, map, pause, volume, and mute are Hugeicons-compatible inline SVG mounted into fixed 18–22px slots; labeled decisions retain text.

### HUD Stats

Score and best are compact translucent tiles with a minimum 68px width, 7px 10px 8px padding, a quiet bone border, an 8px blur, and tabular Barlow Condensed numerals. Best is the selected map's record for the active portrait or landscape profile, not the cross-orientation roster best. A successful landing uses one bounded 520ms pulse.

### Modal Panels

Pause and game-over use panels no wider than 410px with the same glass, border, 14px corners, shadow, and 220ms entrance as the atlas panel. Pause includes synchronized sound controls. Game-over shows score, the current-orientation map best, career progress or promotion, and Play again / Choose map decisions.

### Pause Control

The pause control is a 48px square glass button fixed to the lower-right safe area. It swaps the Hugeicons pause/play glyph with run state, reveals only when playable, and retains hover, press, focus, coarse-pointer, and reduced-transparency behavior.

### Route Coachmark and Guidance

The coachmark is a single-session, non-interactive strip up to 380px wide with a cyan category label and Atkinson body copy. It advances through selected, acquired, and route-set messages, then dismisses after the route is learned. In-world guidance is contextual: nothing is drawn at neutral; compatible targets show a faint capture ring and approach geometry; locked targets strengthen the rails or pad ticks; invalid acquisition uses four separated coral corners; confirmation lasts 360ms and landing feedback 820ms before returning to neutral. Reduced motion keeps the state change while removing travel.

### Named Rules

**The Contextual Guidance Rule.** Show target graphics only in response to selection, acquisition, confirmation, or landing; never leave permanent target art over a physical runway or helipad.

**The Redundant Audio Rule.** Every synthesized cue confirms a state already expressed visually or textually; muting sound never removes required information.

## Do's and Don'ts

### Do:

- Do preserve the raised saltmarsh system as the atlas parent: credible civil infrastructure, mineral terrain, bone paint, amber taxiway detail, dark glass, and open airspace.
- Do make all four maps recognizable through the documented geographic invariant while keeping aircraft and guidance behavior visually consistent.
- Do keep roster names, difficulty or unlock state, record state, and descriptions bound to the map registry and local career.
- Do show the higher cross-orientation best in the roster and the current-orientation best in active HUD and result surfaces.
- Do use the horizontal snap roster at 720px and below and the shipped short-landscape compaction at 480px height and below.
- Do adapt scenery density through mobile, tablet, and desktop budgets while preserving playable geometry.
- Do use bundled fonts, inline Hugeicons, synthesized Web Audio, and code-native map geometry so the complete system works offline.

### Don't:

- Don't flatten the atlas into four recolored copies of Saltmarsh Gateway or abandon the incumbent civil-airfield family for unrelated visual worlds.
- Don't spend cyan, amber, or coral on decorative terrain, facilities, water, or roster preview bands.
- Don't treat rivers, pools, coast fragments, bridges, or desert strata as permanent target graphics or undisclosed gameplay hazards.
- Don't squeeze the mobile roster into four columns, wrap it into miniature cards, or hide map lock and record state.
- Don't enlarge a map landmark until it crowds routes, aircraft, HUD exclusions, or touch targets.
- Don't introduce remote terrain, font, icon, texture, or audio dependencies, or recurring per-frame work for static scenery.

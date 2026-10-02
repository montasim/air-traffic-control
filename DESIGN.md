---
name: Vector Approach
description: "An illustrated aviation arcade game with cream controls and miniature civil airfields."
colors:
  paper: "#fff5df"
  ink: "#203d39"
  muted: "#566656"
  accent: "#ebaa44"
  accent-hover: "#f3bd5a"
  line: "#d4cfb8"
  secondary: "#e8e6d4"
  focus: "#147c88"
  meadow: "#819667"
  meadow-light: "#a3b680"
  meadow-dark: "#6b835c"
  sand: "#cbb48a"
  west-bank: "#b2a477"
  east-bank: "#829b6e"
  water: "#719fa4"
  asphalt: "#505e60"
  marking: "#f4efda"
  taxiway: "#d4c29b"
  aircraft-body: "#f3ead5"
  aircraft-keyline: "#102a3a"
  aircraft-cyan: "#8bdeda"
  aircraft-amber: "#f0bd66"
  aircraft-coral: "#f0836f"
  route-outline: "#0c1716"
typography:
  display:
    fontFamily: '"Barlow Condensed", sans-serif'
    fontSize: "clamp(4rem, 7.6vw, 6.5rem)"
    fontWeight: 700
    lineHeight: 0.82
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"Barlow Condensed", sans-serif'
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.05
  body:
    fontFamily: '"Atkinson Hyperlegible", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: '"Barlow Condensed", sans-serif'
    fontSize: "1.25rem"
    fontWeight: 700
  hud-value:
    fontFamily: '"Barlow Condensed", sans-serif'
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1
  label:
    fontFamily: '"Barlow Condensed", sans-serif'
    fontSize: "0.75rem"
rounded:
  utility: "8px"
  control: "10px"
  card: "12px"
  board: "14px"
  dialog: "16px"
spacing:
  small: "8px"
  action-gap: "10px"
  grid-gap: "12px"
  edge: "16px"
  board: "24px"
  dialog: "30px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#293d32"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "12px 22px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "12px 22px"
  utility-navigation:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.utility}"
    padding: "8px 14px"
  departure-board:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.board}"
    padding: "{spacing.board}"
    width: "390px"
  utility-dialog:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
    padding: "{spacing.dialog}"
    width: "min(560px, calc(100% - 32px))"
  hud-stat:
    backgroundColor: "#fff5dfee"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 15px"
  pause-control:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "50%"
    size: "50px"
---

# Design System: Vector Approach

## Overview

**Creative North Star: "The Illustrated Aviation Arcade"**

Vector Approach is a colorful miniature civil-airfield world with clear aircraft, readable routes, and tactile cream-and-amber controls. Meadow and sand materials, softly shaded geography, crisp airport construction, and recognizable aircraft belong to the same illustrated family. The selected airfield leads the opening screen; controls occupy small, purposeful areas around it.

The user-approved `docs/game-ui-redesign-plan.md` replaces the earlier graphite-panel and muted saltmarsh presentation. This document records the implementation in the map renderers, aircraft renderers, `src/styles.css`, `index.html`, and `src/main.ts`; no separate approved visual comp exists. The bundled fonts, original map identities, civil aviation theme, aircraft class signals, and offline operation remain durable commitments.

**Key Characteristics:**

- Illustrated meadow and mineral terrain beneath code-native operational geometry.
- Cream surfaces, forest ink, amber primary actions, and compact condensed headings.
- Cyan, amber, and coral aircraft identities reinforced by silhouettes and L/C/H destination signs.
- A visible selected airfield with actual rendered map thumbnails and one dominant Play action.
- Small gameplay HUD, Resume-first pause, native utility dialogs, and explicit career counters.

## Colors

Warm paper and amber controls sit against green meadow, sandy mineral ground, and soft blue water; dark route casing keeps gameplay readable across them.

### Primary

- **Flight Amber** (`accent`, `accent-hover`): Play, Resume, retry, and their hover feedback. Selection borders use a related warm amber rather than the former interface cyan.
- **Cream Paper** (`paper`): departure board, utility dialogs, coachmark, and pause control. Cream makes interactive surfaces distinct from the illustrated map without covering it with a dark shell.

### Secondary

- **Meadow Family** (`meadow`, `meadow-light`, `meadow-dark`): Saltmarsh Gateway and River Bend geography, with the shared meadow material also used by Twin Banks.
- **Mineral Sand** (`sand`): Desert Parallel ground beneath the shared mineral material.
- **Twin Grounds** (`west-bank`, `east-bank`): the warmer west bank and greener east bank remain recognizably different.
- **Water and Civil Infrastructure** (`water`, `asphalt`, `marking`, `taxiway`): cool waterways, asphalt runways, cream markings, and restrained taxiway paint. Individual maps retain related local palette variants.

### Tertiary

- **Aircraft Cyan, Amber, and Coral** (`aircraft-cyan`, `aircraft-amber`, `aircraft-coral`): liner, commuter, and helicopter livery and matching guidance. Help chips repeat the mapping with category letters.
- **Focus Teal** (`focus`): visible keyboard focus on cream UI surfaces.

### Neutral

- **Forest Ink** (`ink`): primary interface text. **Muted Green** (`muted`) and related local green values support explanatory text.
- **Paper Divider and Secondary Surface** (`line`, `secondary`): restrained separators and lower-priority actions.
- **Aircraft Paint and Keyline** (`aircraft-body`, `aircraft-keyline`): cream aircraft bodies and cool dark perimeters over every biome.
- **Route Casing** (`route-outline`): a dark contrast underlay beneath semantic route strokes.

**The Signal Reservation Rule.** Keep saturated class colors for aircraft and compatible destination feedback; the brighter scenery remains quieter than routes and warnings.

## Typography

**Display Font:** Barlow Condensed, sans-serif fallback.
**Body Font:** Atkinson Hyperlegible, sans-serif fallback.

Both families are bundled locally. The display face gives the title, actions, map names, and numbers an approachable aviation character; the body face carries instructions and detailed progress. No remote font service is required.

The title is tightly stacked, with cream “Vector” and amber “Approach.” Display sizing adapts substantially on small screens; the frontmatter records the desktop base. Modal headlines use the headline role, primary actions the control role, and tabular score numerals the HUD role. Supporting descriptions generally sit around 0.8–0.95rem; small map state labels are secondary to map names and thumbnails.

**The Two-Voice Rule.** Barlow Condensed names the field, state, and action; Atkinson Hyperlegible explains what the player should understand.

## Layout

The fixed full-viewport game canvas supplies the main scene. The launch layer is transparent except for a gentle directional gradient and its local controls. Desktop places the title and utility navigation upper-left, the departure board lower-left, and the horizontally arranged map selector along the remaining lower edge. The board contains the selected name, difficulty, description, overall map best or lock requirements, and full-width Play.

At widths up to 1000px, the board narrows and spacing contracts. Portrait up to 650px uses a compact title, utility buttons, a bottom departure board, and a horizontal snap-scrolling selector with 158px cards. The home canvas is shifted down 48px in that portrait range; active gameplay is not shifted. The selected card is scrolled into view. Short landscape up to 600px high and above 650px wide splits the title and board across the top and places the selector below; the board may scroll internally. Short/narrow screens hide secondary description and career summary rather than displacing Play.

Active score and orientation-specific best occupy opposite upper safe-area corners; the circular pause control sits lower-right. The centered lower coachmark reserves space beside pause. Compact overlays are centered, capped at 430px normally, and scroll within the viewport. Native utility dialogs cap at 560px. Short-landscape overlays use a wider 540px layout with wrapping action rows. Preserve safe-area positioning and avoid adding permanent UI over approach paths.

Authored portrait, landscape, and near-square map geometry remains authoritative. Saltmarsh keeps its connected intersecting airfield and tidal drainage; River Bend keeps its broad river landmark; Desert Parallel keeps its offset approaches and dry geography; Twin Banks keeps the continuous river split and asymmetric fields. Scenery never changes landing or collision geometry.

## Elevation & Depth

Depth combines soft illustrated material texture, tonal geography, crisp airport edges, and consistent south-east object shadows from north-west light. Two bundled repeating meadow/mineral WebP materials give the atlas a shared texture vocabulary. Static scenery and civil infrastructure are composited into a cached map texture; live aircraft, routes, guidance, and warning effects remain separate.

Cream UI uses modest structural shadows: primary actions lift by a small warm shadow, the departure board and map cards sit above the scene, and dialogs carry the strongest separation. The game remains visible beneath overlay scrims. Reduced transparency makes the HUD opaque and removes the launch gradient.

**The Static World Rule.** Compose scenery once, preserve code-native operational geometry, and keep decorative texture work out of the frame loop.

## Shapes

Use soft organic geography alongside straight runways, aprons, thresholds, taxiways, and miniature buildings. Cream rounded rectangles identify controls and supporting information: utility controls use the smallest corners, cards and departure boards slightly larger ones, and dialogs the broadest corners. Pause is a functional circular control, not a card.

Aircraft use a bundled original transparent sprite atlas: cream-and-cyan swept jet, amber turboprop, coral helicopter, and a separate animated rotor. Fine material shading and restrained runtime shadows replace the former thick sticker outlines. Display scale is shared with conservative heading-aware airframe collision outlines; selection targets and proximity warnings remain separate. Runways carry numbered thresholds, touchdown blocks, edge lights, narrow shoulders, and subdued tire wear.

## Components

### Launch and Map Selection

The start screen uses a centered, scrollable green surface with a maximum 1080px content width. A compact header pairs the title and description with labeled How to play, Career, and Settings controls. One cream board places the actual selected-airfield preview, name, description, record, and Change airfield control on the left; difficulty, the optional two-end runway rule, and the amber Start flight action sit on the right. Existing selection, unlocking, and persistence behavior remains authoritative.

At 700px and below, the board stacks in source order and the preview becomes compact. The panel scrolls on short screens without shrinking controls. The secondary footer links to Windows and Linux listings using locally bundled Microsoft Store and Snap Store badges at their original proportions. The requested Snap treatment removes its border and matches the Microsoft badge’s corner radius. Store links retain visible keyboard focus and open externally.

### Buttons and Navigation

Primary amber and secondary pale-green buttons have condensed bold labels, rounded corners, and a normal minimum height of 50px. Hover changes the surface; press moves down 2px. Focus uses a 3px teal outline with a 4px offset. Utility navigation uses small cream buttons for How to play, Your career, and Settings; portrait and short-landscape overrides provide 44px minimum heights. Disabled primary actions use subdued opaque colors and no shadow.

### HUD and Route Feedback

Cream score tiles contain compact uppercase labels and tabular values. Landing triggers a bounded score pulse; the canvas supplies landing feedback and readable routes. The coachmark and visible flight message explain routing state without intercepting pointer input, while a polite live region provides the same semantic support. Cyan/amber/coral destination signals include L/C/H signage; stronger acquisition emphasis remains contextual.

### Pause, Results, and Confirmation

Pause leads with Resume, followed by Choose airfield, Restart, and How to play; sound controls remain available below. Orientation interruption copy explains the need for a new shift. Abandoning a shift uses a native confirmation dialog with Keep playing first. Results pair score and best in two cream-green regions, then record/career feedback and retry/map actions. Existing save and scoring semantics remain authoritative.

### Native Utility Dialogs

Settings, Your career, and How to play share a native dialog with a clear Back to game action. Native focus containment and Escape behavior support the utility layer. Sound uses a toggle and labeled range input with a numeric percentage. Help uses separate category chips and a short ordered pointer tutorial; do not imply full keyboard route drawing.

### Career Counters

Each next-rank prerequisite has its own label, current/required count, and native progress element: safe landings, completed shifts, and airfields meeting the qualifying best. Values are capped visually at the target while text retains the actual count. Orientation-specific map records and lock rank names follow. Highest rank has explicit completion copy. These are prerequisite counters, not a single invented XP scale.

### Motion

UI button transitions last 160ms. The score pulse lasts 450ms with ease-out and reaches a restrained 1.15 scale. Map-card hover lifts 3px. Reduced motion disables CSS animation, transitions, and smooth scrolling; additional gameplay presentation motion must honor the existing preference path without changing simulation speed.

## Do's and Don'ts

### Do:

- **Do** let the selected airfield occupy the main composition and keep Play unmistakable.
- **Do** use actual map renderings for selection thumbnails.
- **Do** reinforce aircraft color with silhouette and category lettering.
- **Do** keep all fonts, materials, sounds, and maps usable offline.
- **Do** preserve authored geometry, selection semantics, score scope, and local career rules.
- **Do** show separate, truthful career prerequisite counters.

### Don't:

- **Don't** restore the opaque graphite launch panel or the former muted saltmarsh identity as the global design direction.
- **Don't** bake runways, capture zones, or aircraft into terrain materials.
- **Don't** let bright scenery compete with aircraft, route casing, or urgent warnings.
- **Don't** enlarge collision geometry to match decorative aircraft scale.
- **Don't** present locked previews as playable or imply full keyboard gameplay.

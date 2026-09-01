---
target: runway realism and surrounding scenery
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-31T15-56-01Z
slug: src-game-rendering-saltmarshrenderer-ts
---
Method: dual-agent (A: critique_design_review · B: critique_detector_evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3 | Core HUD and route feedback exist, but destination guidance is visually subdued. |
| 2 | Match System / Real World | 2 | Aviation markings are recognizable; proportions, terrain, and operational geography are not convincing. |
| 3 | User Control and Freedom | 2 | Pause/restart work, but assigned routes cannot be edited or undone. |
| 4 | Consistency and Standards | 3 | Strong palette and interaction grammar; mobile scenery falls below the desktop legibility standard. |
| 5 | Error Prevention | 2 | Capture assistance helps, but aircraft-to-zone mapping is not persistently taught. |
| 6 | Recognition Rather Than Recall | 2 | Color and form help, but players must remember the destination mapping after the intro. |
| 7 | Flexibility and Efficiency | 1 | Gameplay is pointer-only and has no reroute workflow. |
| 8 | Aesthetic and Minimalist Design | 2 | Clean shell, but the airport-to-empty-space imbalance and micro-detail noise weaken hierarchy. |
| 9 | Error Recovery | 2 | Failure actions are clear, but players cannot inspect or correct a failed route. |
| 10 | Help and Documentation | 1 | One sentence explains play; there is no demonstration, legend, or guided first route. |
| **Total** | | **20/40** | **Acceptable, but significant improvement needed** |

## Design Specificity Verdict

The game is authored rather than generic: runway identifiers, thresholds, taxiway signs, helipad, service props, and the coastal palette clearly belong to an air-traffic game. Specificity stops at “aviation diagram over marsh,” however. Elliptical islets, diamond-like mudflats, zigzag channels, uniformly scattered reed marks, and annotation-like facility labels do not form a believable place.

The deterministic HTML detector returned zero findings, but it ran in degraded regex mode and cannot inspect Phaser canvas geometry. This is an undercount, not evidence that the runway design is healthy. Browser evidence at 1920×910 and 390×844 supplied the useful signals instead.

No reliable user-visible overlay was created: mutable injection was rejected by browser URL security policy, and the available Playwright evaluation surface was read-only. Direct screenshots, canvas measurements, runtime logs, and source inspection were used as fallback evidence.

## Overall Impression

The user is correct that realism is still missing, but widening is not the solution. The asphalt strips are already broad relative to their length. The long runway is roughly 603×49.5 logical pixels (12.2:1) and its visible shoulder expands to about 83 pixels wide. The fixed-wing glyph is approximately one runway width, while the long runway is only about 9.4 aircraft lengths. Widening would make the field more toy-like.

The perceived narrowness comes from the whole airport occupying a small part of a huge empty map, dense markings consuming the runway width, and the surrounding ground failing to establish scale. The strongest move is to lengthen the runway axes 30–45%, enlarge and recenter the airport footprint, keep the asphalt width similar, and decouple forgiving landing hit areas from the physical pavement.

## What's Working

- The HUD, typography, pause control, and modal shell remain disciplined and subordinate to gameplay.
- Runway numbers, thresholds, aiming marks, taxiway signs, hold-short markings, lighting, fuel, operations, windsock, and helipad provide genuine aviation vocabulary.
- Color-coded aircraft, capture feedback, coarse-pointer assistance, reduced-motion behavior, and live announcements provide a solid interaction foundation.

## Priority Issues

### [P1] Runway and aircraft proportions create a toy airport

**Why it matters:** Dense markings and oversized aircraft make the runways appear short and schematic despite their existing width.

**Fix:** Preserve approximately the current asphalt width; lengthen the main runway 30–45% and the crosswind runway proportionally. Recompose the airport to occupy about 45–55% of desktop width. Keep capture radii and input hit areas generous independently of the rendered asphalt.

**Suggested command:** `$impeccable layout`

### [P1] The airport lacks operational geography

**Why it matters:** A single apron polygon, a short fence, and a service road without a meaningful destination make the airport feel placed on the marsh rather than built into it.

**Fix:** Establish a raised cleared island or polder, graded runway strips, drainage ditches, a complete perimeter road/fence, a causeway, coherent hangar/operations parking, taxiway fillets, runway exits, and approach-clear zones. Every road and path should terminate logically.

**Suggested command:** `$impeccable shape`

### [P1] Ground materials expose their vector primitives

**Why it matters:** Elliptical islets, diamond mudflats, sawtooth channels, and evenly scattered flecks read as constructed shapes rather than tidal terrain.

**Fix:** Use irregular curved channel banks, nested shallow-water and sediment bands, mudflats aligned with water flow, branched creeks, erosion pockets, clumped reeds, and three texture scales: broad marsh variation, shoreline sediment, and sparse close detail.

**Suggested command:** `$impeccable overdrive`

### [P2] Depth and scale cues are too weak

**Why it matters:** Runway, apron, buildings, vehicles, water, and marsh sit on nearly the same flat tonal plane, so tiny props fail to establish scale.

**Fix:** Establish one light direction; add restrained building and aircraft shadows, raised-pavement edge darkening, touchdown rubber, patched asphalt, shoulder vegetation accumulation, and shallow-water tonal gradients. Enlarge the hangar/service cluster as a scale anchor.

**Suggested command:** `$impeccable polish`

### [P2] Desktop and phone need separate scenery detail levels

**Why it matters:** Desktop leaves excessive empty airspace, while phone rendering compresses runway IDs to about 7 CSS pixels and facility signs to roughly 5.5 pixels. Portrait also clips the main runway shoulder slightly at the right edge.

**Fix:** Add renderer LOD tiers. On phones, suppress parking labels, minor signs, fence posts, and low-value lights while preserving runway IDs, thresholds, aircraft, and destination state with minimum screen-space strokes. Refit portrait geometry so the complete runway remains in bounds.

**Suggested command:** `$impeccable adapt`

## Cognitive Load

Moderate: three checklist failures.

- Visual hierarchy fails because the airport is internally noisy while useful targets are subdued.
- Working memory fails because the aircraft-to-zone mapping disappears with the intro.
- Progressive disclosure fails because every facility label and small prop remains visible even when it collapses into noise.

## Emotional Journey

Entry is calm and approachable. The first route introduces uncertainty because “matching landing zone” is described but not demonstrated. Successful capture can be satisfying, but its visual peak is subdued. Mid-game tension works mechanically, though the flat world does not deepen the fantasy. Failure is specific and restartable, but abrupt; the UI gives failure more emotional weight than successful landings.

## Persona Red Flags

**Jordan, first-timer:** `09`, `32`, and `H` are aviation codes without a guided example. Jordan can fail before learning the color/type mapping.

**Casey, distracted mobile user:** Minor airfield labels collapse below readable size, while a finger covers the active threshold. The generous hit area is not visually communicated.

**Sam, accessibility-dependent user:** Aircraft and destinations exist only in canvas and pointer gestures are the sole routing input. Live announcements confirm actions but cannot make the primary task independently operable.

## Minor Observations

- Permanent capture circles weaken the physical-runway illusion; make them contextual overlays.
- The crosswind intersection reads as a drawing-order overlap rather than designed pavement geometry.
- Facility labels look like map annotations rather than objects within the world.
- Repeated reed angle and distribution reveal procedural regularity.
- The runway shoulder is visually heavy while a believable graded strip is absent.
- Successful landings need a stronger emotional and visual payoff.

## Questions to Consider

- Should realism prioritize aviation operations, coastal geography, or cinematic material depth?
- What if the airfield were unmistakably built on a raised marsh island with one causeway?
- Should capture affordances appear only while a compatible aircraft is selected?
- If aircraft must remain oversized, should the world embrace a tactical-board style instead of pursuing partial literal realism?

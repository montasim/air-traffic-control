# Visual V3 material bible

## Direction

**Hand-painted Regional Operations** combines quiet natural terrain, credible civil-airport construction, and crisp illustrated aircraft. Geography orients the player, airport surfaces explain the task, and aircraft plus active routes command attention.

## Light

- Fixed source: northwest / upper-left.
- Vegetation shadow: 2–4 px toward southeast at 16–20% opacity.
- Building shadow: 5–8 px toward southeast at 22–28% opacity.
- Runtime aircraft shadow: 5–9 CSS px toward southeast at 16–20% opacity with a soft edge.
- Aircraft source art never contains a baked cast shadow.

## Surfaces

- Grass: matte olive with broad low-frequency variation; keep primary routing fields quiet.
- Water: cool slate blue with restrained directional highlights.
- Runway and taxiway: neutral charcoal asphalt, fine aggregate, sparse rubber and wear.
- Apron: warm-gray concrete with low-contrast slab seams.
- Roofs: off-white or blue-gray metal with one lit plane and one shallow shade.
- Markings: warm bone rather than pure white; taxiway paint is muted amber.

## Aircraft

- True top-down orthographic masters point nose toward local `+X` / right.
- Warm-neutral ivory or aluminum occupies 65–75% of the visible body.
- Class accent occupies 15–25%: cyan liner, amber commuter, coral rotorcraft.
- Keyline is desaturated blue-charcoal and resolves to roughly 2–3 CSS px at gameplay scale.
- Shading uses one northwest highlight plane, one body midtone, and one restrained southeast shade.
- Transparent alpha is tightly trimmed with no aura, checkerboard, dark fringe, or baked cast shadow.
- Helicopter body and rotor share normalized hub anchor `(0.500, 0.500)`.

## Runtime hierarchy

1. Aircraft and active route.
2. Selected, warning, compatible and invalid state.
3. Runway and helipad markings.
4. Airport buildings and taxiways.
5. River and major geography.
6. Decorative vegetation and field texture.

## Acceptance gates

- Aircraft perimeter contrast is at least 3:1 over 90% of sampled backgrounds.
- Selected aircraft contrast is at least 4.5:1.
- Runway markings reach at least 4.5:1 against asphalt.
- At least 35% of every viewport remains quiet flyable space.
- Playable-scenery mean HSV saturation does not exceed 0.30; p95 does not exceed 0.48.
- Operational geometry remains aligned within one logical pixel.
- Mobile p95 frame time remains at or below 20 ms.
- Static scenery composes once; only aircraft, rotors, routes and feedback update per frame.

## Approval authority

The actual-size material contact sheet and operational composite are approval evidence. Isolated masters are source material, not proof that a sprite works in the game.

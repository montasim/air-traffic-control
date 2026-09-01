# Regional liner production master — v1

## Generation

- Tool mode: built-in ImageGen
- Use case: `stylized-concept`
- Asset type: production master sprite for a top-down air-traffic-control game
- Subject reference: `art/aircraft/approved-sources/regional-jet-coral.png`
- Reference role: silhouette and aircraft-subject reference only; not finish, palette, shadow, or material authority

## Primary prompt

Create one polished regional passenger jet sprite for long-session gameplay. Use a genuinely transparent backdrop with no floor, sky, tile, or halo. Draw a true top-down orthographic regional twin-engine jet with its nose pointing exactly toward +X/right, centered with generous transparent padding. Use a long narrow fuselage, clearly swept wings, two under-wing engines, a compact tailplane, readable cockpit canopy, and restrained cabin windows.

The finish is mature natural realistic-cartoon game art: clean hand-painted cel illustration with believable proportions and restrained detail, professional, calm, and operational rather than childlike. Give it shallow illustrated volume from a fixed northwest/upper-left light, using one soft highlight plane and one restrained lower-right shade while keeping the view unmistakably orthographic.

Use matte warm-neutral ivory and aluminum over 65–75% of the visible aircraft. Reserve muted cyan for 15–25% of the aircraft on the tail, a narrow fuselage stripe, and small wing or engine details. Use a desaturated blue-charcoal keyline equivalent to 2–3 CSS pixels at gameplay size. Materials are matte painted aluminum with subtle panel divisions, dark blue-gray cockpit glass, small readable windows, and restrained engine-intake depth.

Requirements: the complete aircraft remains inside the canvas; the airframe is symmetric; there is no baked shadow, text, logo, registration, watermark, glow, or border. Preserve clean antialiased alpha with no dark or light fringe. Avoid three-quarter perspective, tilt, dramatic foreshortening, a saturated cyan body, coral/red/orange, a thick sticker outline, glossy candy reflections, toy proportions, cute facial treatment, photorealism, and excessive panel noise.

## Targeted correction

The first generation returned the correct aircraft but rendered a checkerboard into an RGB image. A single targeted background-extraction pass requested genuine transparent alpha while preserving the aircraft exactly. Because the corrected built-in output still encoded the checkerboard, the final project-bound PNG received deterministic connected-background alpha cleanup only; the aircraft artwork, dimensions, orientation, colors, and placement were not changed.

## Output

- File: `liner-v1.png`
- Dimensions: 1536 × 1024 px
- Format: 8-bit RGBA PNG
- Orientation: nose +X/right
- Baked shadow: none

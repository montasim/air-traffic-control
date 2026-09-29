# Arcade terrain materials

Generated with the built-in imagegen tool on 2026-09-29 for Vector Approach. Original outputs are retained in the Codex generated-images directory. Shipping WebP copies are 768×768, encoded at quality 82 with ffmpeg. These are material textures, not map plates: all geography, airport geometry, and targets remain code-native.

- `meadow.webp`: original `exec-70ba074d-11e7-4210-976a-4ccbc0d85993.png`
- `mineral.webp`: original `exec-c5a5884c-094a-405c-9602-659281aa62d2.png`

Exact generation prompts are preserved in the adjacent `.webp.json` provenance files. Both textures are applied at 20% multiply opacity beneath airport geometry and cached into the static map render texture. They are never repainted per frame.

## Aircraft sprites

`aircraft-atlas.png` is an original transparent atlas created using the built-in imagegen tool on 2026-09-29, sourced from `exec-56047bd9-234d-4c4d-9632-11e17cbe2658.png`. It contains the cyan passenger jet, amber turboprop, coral helicopter body and separate main rotor. Runtime frame coordinates account for the generated 1254×1254 image rather than assuming the requested resolution. Shadows are added by Phaser. The exact prompt is recorded in `aircraft-atlas.png.json`.

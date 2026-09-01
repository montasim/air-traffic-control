export const FONT_FAMILIES = {
  display: 'Barlow Condensed',
  interface: 'Atkinson Hyperlegible'
} as const;

/** Canvas-safe stacks shared by every Phaser text surface. */
export const PHASER_FONT_STACKS = {
  display: '"Barlow Condensed", "Arial Narrow", Arial, sans-serif',
  interface: '"Atkinson Hyperlegible", "Segoe UI", Arial, sans-serif'
} as const;

/** Stable import used by airfield and gameplay renderers. */
export const DISPLAY_FONT_STACK = PHASER_FONT_STACKS.display;

/**
 * Base text roles for Phaser. Consumers add only context-specific properties
 * such as color and responsive fontSize.
 */
export const PHASER_TEXT_STYLES = {
  airfieldMarking: {
    fontFamily: PHASER_FONT_STACKS.display,
    fontStyle: 'bold'
  },
  interfaceCopy: {
    fontFamily: PHASER_FONT_STACKS.interface,
    fontStyle: 'normal'
  }
} as const;

/** Descriptors the bootstrap should load before Phaser rasterizes canvas text. */
export const GAME_FONT_LOAD_DESCRIPTORS = [
  '600 16px "Barlow Condensed"',
  '700 32px "Barlow Condensed"',
  '400 16px "Atkinson Hyperlegible"'
] as const;

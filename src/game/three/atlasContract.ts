export const ATLAS_SIDE = 512;
export const ATLAS_RGBA_BYTES = ATLAS_SIDE * ATLAS_SIDE * 4;
export const MAX_ATLAS_FILE_BYTES = 2_000_000;

/** Reject oversized/mismatched PNGs before handing them to the browser's image decoder. */
export function validateAtlasPng(bytes: ArrayBuffer): void {
  if (bytes.byteLength < 33 || bytes.byteLength > MAX_ATLAS_FILE_BYTES) throw new Error('Blender atlas exceeds the file budget or is incomplete');
  const header = new DataView(bytes);
  if (header.getUint32(0) !== 0x89504e47 || header.getUint32(4) !== 0x0d0a1a0a ||
      header.getUint32(8) !== 13 || header.getUint32(12) !== 0x49484452 ||
      header.getUint32(16) !== ATLAS_SIDE || header.getUint32(20) !== ATLAS_SIDE ||
      header.getUint8(24) !== 8 || header.getUint8(25) !== 6) {
    throw new Error('Blender atlas must be a 512 × 512, 8-bit RGBA PNG');
  }
}
